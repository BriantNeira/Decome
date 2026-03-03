"use client";

import { useEffect, useRef, useState } from "react";
import { RoleGuard } from "@/components/layout/RoleGuard";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/hooks/useAuth";
import api, { parseApiError } from "@/lib/api";
import { EmailTemplate, EmailTemplateListResponse, GeneratedMessage, TEMPLATE_VARIABLES, Tone } from "@/types/ai";
import type { Reminder, ReminderType } from "@/types/masterdata";

function insertAtCursor(
  ref: React.RefObject<HTMLTextAreaElement | HTMLInputElement>,
  text: string
) {
  const el = ref.current;
  if (!el) return;
  const start = el.selectionStart ?? el.value.length;
  const end = el.selectionEnd ?? el.value.length;
  const newVal = el.value.slice(0, start) + text + el.value.slice(end);
  const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    "value"
  )?.set;
  const nativeTextareaValueSetter = Object.getOwnPropertyDescriptor(
    window.HTMLTextAreaElement.prototype,
    "value"
  )?.set;
  if (el instanceof HTMLTextAreaElement && nativeTextareaValueSetter) {
    nativeTextareaValueSetter.call(el, newVal);
  } else if (el instanceof HTMLInputElement && nativeInputValueSetter) {
    nativeInputValueSetter.call(el, newVal);
  } else {
    el.value = newVal;
  }
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.focus();
  el.setSelectionRange(start + text.length, start + text.length);
}

const EMPTY_FORM = {
  name: "",
  description: "",
  subject_template: "",
  body_template: "",
  is_active: true,
  reminder_type_id: "" as string, // "" = no type; number string when selected
};

function TemplatesContent() {
  const { user } = useAuth();
  const { showToast, ToastComponent } = useToast();
  const isAdmin = user?.role === "admin";

  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [reminderTypes, setReminderTypes] = useState<ReminderType[]>([]);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const subjectRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const [activeVarTarget, setActiveVarTarget] = useState<"subject" | "body">("body");

  // Generate panel state
  const [genTemplate, setGenTemplate] = useState<EmailTemplate | null>(null);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [remindersLoaded, setRemindersLoaded] = useState(false);
  const [genReminderId, setGenReminderId] = useState("");
  const [genTone, setGenTone] = useState<Tone>("formal");
  const [genLoading, setGenLoading] = useState(false);
  const [genResult, setGenResult] = useState<GeneratedMessage | null>(null);
  const [copiedField, setCopiedField] = useState<"subject" | "body" | null>(null);

  useEffect(() => { loadTemplates(); loadReminderTypes(); }, []);

  async function loadReminderTypes() {
    try {
      const res = await api.get<{ items: ReminderType[]; total: number }>("/reminder-types?limit=100");
      setReminderTypes((res.data.items ?? []).filter((rt) => rt.is_active));
    } catch {}
  }

  async function loadTemplates() {
    try {
      const res = await api.get<EmailTemplateListResponse>("/templates?limit=100");
      setTemplates(res.data.items);
      setTotal(res.data.total);
    } catch (err: any) {
      showToast(parseApiError(err, "Failed to load templates"), "error");
    } finally { setLoading(false); }
  }

  function openAdd() {
    setEditingId(null);
    setForm({ ...EMPTY_FORM });
    setShowForm(true);
    setGenTemplate(null);
  }

  function openEdit(t: EmailTemplate) {
    setEditingId(t.id);
    setForm({
      name: t.name,
      description: t.description ?? "",
      subject_template: t.subject_template,
      body_template: t.body_template,
      is_active: t.is_active,
      reminder_type_id: t.reminder_type_id != null ? String(t.reminder_type_id) : "",
    });
    setShowForm(true);
    setGenTemplate(null);
  }

  async function handleSave() {
    if (!form.name.trim() || !form.subject_template.trim() || !form.body_template.trim()) {
      showToast("Name, subject, and body are required", "error");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        subject_template: form.subject_template,
        body_template: form.body_template,
        is_active: form.is_active,
        reminder_type_id: form.reminder_type_id ? parseInt(form.reminder_type_id, 10) : null,
      };
      if (editingId) {
        await api.patch(`/templates/${editingId}`, payload);
        showToast("Template updated", "success");
      } else {
        await api.post("/templates", payload);
        showToast("Template created", "success");
      }
      setShowForm(false);
      await loadTemplates();
    } catch (err: any) {
      showToast(parseApiError(err, "Failed to save template"), "error");
    } finally { setSaving(false); }
  }

  async function handleDelete(id: string) {
    try {
      await api.delete(`/templates/${id}`);
      showToast("Template deleted", "success");
      setDeletingId(null);
      await loadTemplates();
    } catch (err: any) {
      showToast(parseApiError(err, "Failed to delete template"), "error");
    }
  }

  // Generate panel helpers
  async function openGenerate(t: EmailTemplate) {
    setGenTemplate(t);
    setGenResult(null);
    setGenReminderId("");
    setShowForm(false);
    if (!remindersLoaded) {
      try {
        const res = await api.get<{ items: Reminder[]; total: number }>("/reminders?limit=200");
        setReminders(res.data.items ?? []);
        setRemindersLoaded(true);
      } catch {}
    }
  }

  async function handleGenerate() {
    if (!genTemplate) return;
    if (!genReminderId) {
      showToast("Select a reminder first", "error");
      return;
    }
    setGenLoading(true);
    setGenResult(null);
    try {
      const res = await api.post<GeneratedMessage>("/generate", {
        reminder_id: genReminderId,
        template_id: genTemplate.id,
        tone: genTone,
      });
      setGenResult(res.data);
    } catch (err: any) {
      showToast(parseApiError(err, "Generation failed — check that LLM is configured and active."), "error");
    } finally {
      setGenLoading(false);
    }
  }

  function copyToClipboard(text: string, field: "subject" | "body") {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  }

  return (
    <div className="space-y-4 pb-24">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">Email Templates</h1>
          <p className="text-sm text-text-secondary mt-0.5">
            Total: {total} — Click <strong>✉ Generate</strong> on any template to create a personalized email using AI.
          </p>
        </div>
        {isAdmin && (
          <Button variant="primary" size="sm" onClick={openAdd}>
            + New Template
          </Button>
        )}
      </div>

      {/* Create / Edit Form */}
      {showForm && (
        <Card padding="md">
          <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wide mb-4">
            {editingId ? "Edit Template" : "New Template"}
          </h2>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-text-primary mb-1">Name *</label>
                <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Q1 Follow-up" className="w-full rounded border border-border bg-surface text-text-primary px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-primary mb-1">Description</label>
                <input type="text" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Optional description" className="w-full rounded border border-border bg-surface text-text-primary px-3 py-2 text-sm" />
              </div>
            </div>

            {/* Reminder Type association */}
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1">
                Associated Reminder Type <span className="font-normal text-text-secondary">(optional — auto-selects this template when generating)</span>
              </label>
              <select
                value={form.reminder_type_id}
                onChange={(e) => setForm({ ...form, reminder_type_id: e.target.value })}
                className="w-full rounded border border-border bg-surface text-text-primary px-3 py-2 text-sm"
              >
                <option value="">— No association —</option>
                {reminderTypes.map((rt) => (
                  <option key={rt.id} value={String(rt.id)}>
                    {rt.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Variable chips */}
            <div>
              <p className="text-xs text-text-secondary mb-1.5">
                Insert variable — click a chip, then type in subject or body to place it at the cursor:
              </p>
              <div className="flex flex-wrap gap-1.5">
                {TEMPLATE_VARIABLES.map((v) => (
                  <button
                    key={v.key}
                    type="button"
                    onClick={() => {
                      if (activeVarTarget === "subject") {
                        insertAtCursor(subjectRef as any, `{{${v.key}}}`);
                        setForm((f) => ({ ...f, subject_template: subjectRef.current?.value ?? f.subject_template }));
                      } else {
                        insertAtCursor(bodyRef as any, `{{${v.key}}}`);
                        setForm((f) => ({ ...f, body_template: bodyRef.current?.value ?? f.body_template }));
                      }
                    }}
                    className="px-2.5 py-1 rounded-full text-xs font-medium bg-surface border border-border text-text-secondary hover:bg-brand/10 hover:border-brand hover:text-brand transition-colors"
                  >
                    {`{{${v.key}}}`}
                  </button>
                ))}
              </div>
            </div>

            {/* Subject */}
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1">Subject Template *</label>
              <input ref={subjectRef} type="text" value={form.subject_template} onFocus={() => setActiveVarTarget("subject")} onChange={(e) => setForm({ ...form, subject_template: e.target.value })} placeholder="e.g. Follow-up: {{account_name}} — {{reminder_title}}" className="w-full rounded border border-border bg-surface text-text-primary px-3 py-2 text-sm" />
            </div>

            {/* Body */}
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1">Body Template *</label>
              <textarea ref={bodyRef} value={form.body_template} onFocus={() => setActiveVarTarget("body")} onChange={(e) => setForm({ ...form, body_template: e.target.value })} rows={8} placeholder={"Dear {{contact_name}},\n\nI hope this message finds you well..."} className="w-full rounded border border-border bg-surface text-text-primary px-3 py-2 text-sm resize-y font-mono" />
            </div>

            {/* Active toggle */}
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => setForm({ ...form, is_active: !form.is_active })} className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${form.is_active ? "bg-brand" : "bg-border"}`}>
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${form.is_active ? "translate-x-6" : "translate-x-1"}`} />
              </button>
              <span className="text-sm text-text-primary">{form.is_active ? "Active" : "Inactive"}</span>
            </div>

            <div className="flex gap-2 pt-1">
              <Button variant="primary" size="sm" loading={saving} onClick={handleSave}>
                {editingId ? "Save Changes" : "Create Template"}
              </Button>
              <Button variant="secondary" size="sm" onClick={() => setShowForm(false)}>Cancel</Button>
            </div>
          </div>
        </Card>
      )}

      {/* Table */}
      <Card padding="none">
        {loading ? (
          <div className="text-center py-10 text-text-secondary text-sm">Loading...</div>
        ) : templates.length === 0 ? (
          <div className="text-center py-10 text-text-secondary text-sm">
            No templates yet.{isAdmin && <> <button onClick={openAdd} className="text-brand hover:underline">Create one &rarr;</button></>}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="px-4 py-3 text-xs font-semibold text-text-secondary uppercase tracking-wide">Name</th>
                <th className="px-4 py-3 text-xs font-semibold text-text-secondary uppercase tracking-wide hidden md:table-cell">Description</th>
                <th className="px-4 py-3 text-xs font-semibold text-text-secondary uppercase tracking-wide hidden lg:table-cell">Type</th>
                <th className="px-4 py-3 text-xs font-semibold text-text-secondary uppercase tracking-wide">Status</th>
                <th className="px-4 py-3 text-xs font-semibold text-text-secondary uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody>
              {templates.map((t) => (
                <tr
                  key={t.id}
                  className={`border-b border-border last:border-0 hover:bg-surface-hover ${genTemplate?.id === t.id ? "bg-brand/5" : ""}`}
                >
                  <td className="px-4 py-3 font-medium text-text-primary">{t.name}</td>
                  <td className="px-4 py-3 text-text-secondary hidden md:table-cell max-w-xs truncate">{t.description ?? "—"}</td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    {t.reminder_type_name ? (
                      <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {t.reminder_type_name}
                      </span>
                    ) : (
                      <span className="text-text-secondary text-xs">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${t.is_active ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"}`}>
                      {t.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {deletingId === t.id ? (
                      <span className="flex items-center gap-2 text-xs">
                        <span className="text-red-500">Delete?</span>
                        <button onClick={() => handleDelete(t.id)} className="text-red-500 font-medium hover:underline">Confirm</button>
                        <button onClick={() => setDeletingId(null)} className="text-text-secondary hover:underline">Cancel</button>
                      </span>
                    ) : (
                      <span className="flex items-center gap-3 text-xs">
                        {/* Generate button for all roles */}
                        <button
                          onClick={() => genTemplate?.id === t.id ? setGenTemplate(null) : openGenerate(t)}
                          className={`font-medium hover:underline ${genTemplate?.id === t.id ? "text-brand underline" : "text-brand"}`}
                        >
                          ✉ Generate
                        </button>
                        {isAdmin && (
                          <>
                            <button onClick={() => openEdit(t)} className="text-text-secondary hover:text-text-primary hover:underline">Edit</button>
                            <button onClick={() => setDeletingId(t.id)} className="text-red-500 hover:underline">Delete</button>
                          </>
                        )}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {/* Generate Email Panel — fixed bottom bar */}
      {genTemplate && (
        <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-surface shadow-2xl">
          <div className="max-w-5xl mx-auto px-4 py-4">
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-text-primary text-sm flex items-center gap-2">
                <span>✉ Generate Email</span>
                <span className="text-text-secondary">·</span>
                <span className="text-brand">{genTemplate.name}</span>
              </h2>
              <button
                onClick={() => { setGenTemplate(null); setGenResult(null); }}
                className="text-text-secondary hover:text-text-primary text-lg leading-none"
              >
                ✕
              </button>
            </div>

            {/* Controls */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-text-secondary mb-1">Select Reminder</label>
                <select
                  value={genReminderId}
                  onChange={(e) => setGenReminderId(e.target.value)}
                  className="w-full rounded border border-border bg-bg text-text-primary px-3 py-2 text-sm"
                >
                  <option value="">Choose a reminder…</option>
                  {reminders.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.account_name} — {r.title}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Tone</label>
                <div className="flex gap-4 mt-1">
                  {(["formal", "friendly", "direct"] as Tone[]).map((tone) => (
                    <label key={tone} className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="template-gen-tone"
                        checked={genTone === tone}
                        onChange={() => setGenTone(tone)}
                        className="accent-brand"
                      />
                      <span className="text-sm text-text-primary capitalize">{tone}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 mb-3">
              <Button size="sm" loading={genLoading} onClick={handleGenerate} disabled={!genReminderId}>
                Generate →
              </Button>
              {genResult && (
                <span className="text-xs text-text-secondary">
                  {genResult.tokens_used} tokens used
                </span>
              )}
            </div>

            {/* Result */}
            {genResult && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-60 overflow-y-auto">
                <div className="border border-border rounded-lg p-3 bg-bg">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-semibold text-text-secondary uppercase tracking-wide">Subject</span>
                    <button
                      onClick={() => copyToClipboard(genResult.subject, "subject")}
                      className="text-xs text-brand hover:underline"
                    >
                      {copiedField === "subject" ? "✓ Copied!" : "Copy"}
                    </button>
                  </div>
                  <p className="text-sm text-text-primary">{genResult.subject}</p>
                </div>
                <div className="border border-border rounded-lg p-3 bg-bg overflow-y-auto">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-semibold text-text-secondary uppercase tracking-wide">Body</span>
                    <button
                      onClick={() => copyToClipboard(genResult.body, "body")}
                      className="text-xs text-brand hover:underline"
                    >
                      {copiedField === "body" ? "✓ Copied!" : "Copy"}
                    </button>
                  </div>
                  <pre className="text-sm text-text-primary whitespace-pre-wrap font-sans leading-relaxed">{genResult.body}</pre>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <ToastComponent />
    </div>
  );
}

export default function TemplatesPage() {
  return (
    <RoleGuard allowedRoles={["admin", "bdm", "director"]} fallback={<p className="text-red-600">Access denied</p>}>
      <TemplatesContent />
    </RoleGuard>
  );
}
