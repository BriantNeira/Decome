"use client";

import { useEffect, useState } from "react";
import { useToast } from "@/components/ui/Toast";
import { RoleGuard } from "@/components/layout/RoleGuard";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import api, { parseApiError } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { Reminder, Account, Program, ReminderType, CustomerProfile } from "@/types/masterdata";
import { EmailTemplate, GeneratedMessage, Tone, EmailTemplateListResponse, ImportResponse, ImportRowResult, Contact } from "@/types/ai";

const STATUS_OPTIONS = [
  { value: "", label: "All Statuses" },
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In Progress" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
  { value: "overdue", label: "Overdue" },
];

const RECURRENCE_OPTIONS = [
  { value: "", label: "None" },
  { value: "DAILY", label: "Daily" },
  { value: "WEEKLY", label: "Weekly" },
  { value: "BIWEEKLY", label: "Bi-weekly" },
  { value: "MONTHLY", label: "Monthly" },
];


function statusBadge(status: string, startDate: string) {
  const isOverdue =
    (status === "open" || status === "in_progress") && startDate < new Date().toISOString().slice(0, 10);
  if (isOverdue) return "bg-orange-100 text-orange-700";
  const map: Record<string, string> = {
    open: "bg-gray-100 text-gray-600",
    in_progress: "bg-blue-100 text-blue-700",
    completed: "bg-green-100 text-green-700",
    cancelled: "bg-red-100 text-red-600",
  };
  return map[status] ?? "bg-gray-100 text-gray-600";
}

function statusLabel(status: string, startDate: string) {
  const isOverdue =
    (status === "open" || status === "in_progress") && startDate < new Date().toISOString().slice(0, 10);
  if (isOverdue) return "Overdue";
  const map: Record<string, string> = {
    open: "Open",
    in_progress: "In Progress",
    completed: "Completed",
    cancelled: "Cancelled",
  };
  return map[status] ?? status;
}

interface FormData {
  user_id: string;
  account_id: string;
  program_id: string;
  type_id: string;
  title: string;
  notes: string;
  start_date: string;
  status: string;
  recurrence_rule: string;
}

const EMPTY_FORM: FormData = {
  user_id: "",
  account_id: "",
  program_id: "",
  type_id: "",
  title: "",
  notes: "",
  start_date: new Date().toISOString().slice(0, 10),
  status: "open",
  recurrence_rule: "",
};

interface ListResponse {
  items: Reminder[];
  total: number;
}

interface UsersResponse {
  items: { id: string; full_name: string; email: string }[];
  total: number;
}

function RemindersContent() {
  const { user } = useAuth();
  const { showToast, ToastComponent } = useToast();
  const isAdmin = user?.role === "admin";

  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  // Filter state
  const [filterStatus, setFilterStatus] = useState("");
  const [filterAccount, setFilterAccount] = useState("");

  // Reference data
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [reminderTypes, setReminderTypes] = useState<ReminderType[]>([]);
  const [bdmUsers, setBdmUsers] = useState<{ id: string; full_name: string; email: string }[]>([]);

  // Add/Edit form
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<FormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  // Delete confirm
  const [deletingId, setDeletingId] = useState<string | null>(null);
  // Generate Email state
  const [generateReminder, setGenerateReminder] = useState<Reminder | null>(null);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [genTemplateId, setGenTemplateId] = useState("");
  const [genTone, setGenTone] = useState<Tone>("friendly");
  const [genLoading, setGenLoading] = useState(false);
  const [genResult, setGenResult] = useState<GeneratedMessage | null>(null);
  const [genHistory, setGenHistory] = useState<GeneratedMessage[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [customerProfile, setCustomerProfile] = useState<CustomerProfile | null>(null);
  const [genContacts, setGenContacts] = useState<Contact[]>([]);
  const [genContactId, setGenContactId] = useState("");
  const [sendLoading, setSendLoading] = useState(false);

  // Import modal state
  const [showImport, setShowImport] = useState(false);
  const [importStep, setImportStep] = useState<"upload" | "preview" | "done">("upload");
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<ImportResponse | null>(null);
  const [importLoading, setImportLoading] = useState(false);

  useEffect(() => {
    loadReferenceData();
  }, [isAdmin]); // re-run when auth resolves so BDM-user fetch fires for admin

  useEffect(() => {
    loadReminders();
  }, [filterStatus, filterAccount]);

  async function loadReferenceData() {
    try {
      const [accRes, progRes, typeRes] = await Promise.all([
        api.get<{ items: Account[]; total: number }>("/accounts?limit=500"),
        api.get<{ items: Program[]; total: number }>("/programs?limit=500"),
        api.get<{ items: ReminderType[]; total: number }>("/reminder-types?limit=500"),
      ]);
      setAccounts(accRes.data.items.filter((a) => a.is_active));
      setPrograms(progRes.data.items.filter((p) => p.is_active));
      setReminderTypes(typeRes.data.items.filter((t) => t.is_active));

      if (isAdmin) {
        const usersRes = await api.get<UsersResponse>("/users?limit=500");
        setBdmUsers(usersRes.data.items.filter((u: any) => u.role === "bdm"));
      }
    } catch {
      // non-critical
    }
  }

  async function loadReminders() {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filterStatus) params.set("status", filterStatus);
      if (filterAccount) params.set("account_id", filterAccount);
      const res = await api.get<ListResponse>(`/reminders?limit=100&${params}`);
      setReminders(res.data.items);
      setTotal(res.data.total);
    } catch (err: any) {
      showToast(parseApiError(err, "Failed to load reminders"), "error");
    } finally {
      setLoading(false);
    }
  }

  function openAdd(prefillDate?: string) {
    setEditingId(null);
    setFormData({
      ...EMPTY_FORM,
      start_date: prefillDate ?? new Date().toISOString().slice(0, 10),
      user_id: isAdmin ? "" : user?.id ?? "",
    });
    setShowForm(true);
  }

  function openEdit(r: Reminder) {
    setEditingId(r.id);
    setFormData({
      user_id: r.user_id,
      account_id: r.account_id,
      program_id: r.program_id ?? "",
      type_id: r.type_id ? String(r.type_id) : "",
      title: r.title,
      notes: r.notes ?? "",
      start_date: r.start_date,
      status: r.status,
      recurrence_rule: r.recurrence_rule ?? "",
    });
    setShowForm(true);
  }

  async function handleSave() {
    if (!formData.account_id || !formData.title || !formData.start_date) {
      showToast("Account, title, and date are required", "error");
      return;
    }
    setSaving(true);
    try {
      const payload: any = {
        account_id: formData.account_id,
        title: formData.title,
        start_date: formData.start_date,
        notes: formData.notes || null,
        program_id: formData.program_id || null,
        type_id: formData.type_id ? parseInt(formData.type_id) : null,
        recurrence_rule: formData.recurrence_rule || null,
        status: formData.status || "open",
      };
      if (isAdmin) payload.user_id = formData.user_id || user?.id;

      if (editingId) {
        await api.patch(`/reminders/${editingId}`, payload);
        showToast("Reminder updated", "success");
      } else {
        if (!isAdmin) payload.user_id = user?.id;
        await api.post("/reminders", payload);
        showToast("Reminder created", "success");
      }
      setShowForm(false);
      await loadReminders();
    } catch (err: any) {
      showToast(parseApiError(err, "Failed to save reminder"), "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleMarkCompleted(r: Reminder) {
    if (r.status === "completed") return; // already done
    try {
      await api.patch(`/reminders/${r.id}`, { status: "completed" });
      await loadReminders();
    } catch (err: any) {
      showToast(parseApiError(err, "Failed to update status"), "error");
    }
  }

  async function handleDelete(id: string) {
    try {
      await api.delete(`/reminders/${id}`);
      showToast("Reminder deleted", "success");
      setDeletingId(null);
      await loadReminders();
    } catch (err: any) {
      showToast(parseApiError(err, "Failed to delete reminder"), "error");
    }
  }
  async function loadTemplates(typeId?: number | null): Promise<EmailTemplate[]> {
    try {
      const res = await api.get<EmailTemplateListResponse>("/templates?limit=100&active_only=true");
      const items = res.data.items;
      setTemplates(items);
      return items;
    } catch {}
    return [];
  }

  async function loadGeneratePanel(reminderId: string) {
    try {
      const res = await api.get<GeneratedMessage[]>(`/generate?reminder_id=${reminderId}`);
      setGenHistory(res.data);
    } catch {}
  }

  async function openGenerate(r: Reminder) {
    setGenerateReminder(r);
    setGenResult(null);
    setGenHistory([]);
    setShowHistory(false);
    setCustomerProfile(null);
    setGenTemplateId("");
    setGenContacts([]);
    setGenContactId("");

    // Load templates + contacts in parallel
    const [loadedTemplates] = await Promise.all([
      loadTemplates(),
      api.get<{ items: Contact[]; total: number }>(`/contacts?account_id=${r.account_id}&limit=100`)
        .then((res) => {
          const sorted = [...res.data.items].sort((a, b) =>
            (b.is_decision_maker ? 1 : 0) - (a.is_decision_maker ? 1 : 0)
          );
          setGenContacts(sorted);
          // Auto-select first decision-maker (or first contact)
          if (sorted.length > 0) setGenContactId(sorted[0].id);
        })
        .catch(() => {}),
    ]);

    // Auto-select template by reminder type if available
    if (r.type_id != null) {
      const matched = loadedTemplates.find((t) => t.reminder_type_id === r.type_id);
      if (matched) setGenTemplateId(matched.id);
    }
    loadGeneratePanel(r.id);
  }

  async function handleGenerate() {
    if (generateReminder === null) return;
    setGenLoading(true);
    setGenResult(null);
    try {
      const payload: any = { reminder_id: generateReminder.id, tone: genTone };
      if (genTemplateId) payload.template_id = genTemplateId;
      if (genContactId) payload.contact_id = genContactId;
      const res = await api.post<GeneratedMessage>("/generate", payload);
      setGenResult(res.data);
      await loadGeneratePanel(generateReminder.id);
    } catch (err: any) {
      showToast(parseApiError(err, "Failed to generate message"), "error");
    } finally { setGenLoading(false); }
  }

  async function handleSendEmail(msg: GeneratedMessage, recipientEmail: string) {
    setSendLoading(true);
    try {
      const res = await api.post<GeneratedMessage>(`/generate/${msg.id}/send`, {
        recipient_email: recipientEmail,
      });
      // Update the result / history with the sent status
      if (genResult?.id === msg.id) setGenResult(res.data);
      setGenHistory((prev) => prev.map((m) => (m.id === msg.id ? res.data : m)));
      showToast(`Email sent to ${recipientEmail}`, "success");
    } catch (err: any) {
      showToast(parseApiError(err, "Failed to send email"), "error");
    } finally { setSendLoading(false); }
  }

  function openImport() {
    setShowImport(true);
    setImportStep("upload");
    setImportFile(null);
    setImportPreview(null);
  }

  async function handleImportPreview() {
    if (!importFile) return;
    setImportLoading(true);
    try {
      const formData = new FormData();
      formData.append("file", importFile);
      const res = await api.post<ImportResponse>("/reminders/import?dry_run=true", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setImportPreview(res.data);
      setImportStep("preview");
    } catch (err: any) {
      showToast(parseApiError(err, "Failed to parse file"), "error");
    } finally { setImportLoading(false); }
  }

  async function handleImportConfirm() {
    if (!importFile) return;
    setImportLoading(true);
    try {
      const formData = new FormData();
      formData.append("file", importFile);
      const res = await api.post<ImportResponse>("/reminders/import?dry_run=false", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setImportPreview(res.data);
      setImportStep("done");
      await loadReminders();
    } catch (err: any) {
      showToast(parseApiError(err, "Import failed"), "error");
    } finally { setImportLoading(false); }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">Reminders</h1>
          <p className="text-sm text-text-secondary mt-0.5">Total: {total}</p>
        </div>
        <div className="flex items-center gap-2">
          {(isAdmin || user?.role === "bdm") && (
            <Button onClick={openImport} variant="secondary" size="sm">
              ⬆ Import
            </Button>
          )}
          <Button onClick={() => openAdd()} variant="primary" size="sm">
            + Add Reminder
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card padding="sm">
        <div className="flex flex-wrap gap-3 items-center">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="rounded border border-border bg-surface text-text-primary px-3 py-1.5 text-sm"
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <select
            value={filterAccount}
            onChange={(e) => setFilterAccount(e.target.value)}
            className="rounded border border-border bg-surface text-text-primary px-3 py-1.5 text-sm"
          >
            <option value="">All Accounts</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
          {(filterStatus || filterAccount) && (
            <button
              onClick={() => { setFilterStatus(""); setFilterAccount(""); }}
              className="text-xs text-text-secondary hover:text-text-primary"
            >
              Clear filters
            </button>
          )}
        </div>
      </Card>

      {/* Add/Edit Form */}
      {showForm && (
        <Card padding="md">
          <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wide mb-4">
            {editingId ? "Edit Reminder" : "New Reminder"}
          </h2>
          <div className="space-y-4">
            {isAdmin && (
              <div>
                <label className="block text-sm font-medium text-text-primary mb-1">BDM User</label>
                <select
                  value={formData.user_id}
                  onChange={(e) => setFormData({ ...formData, user_id: e.target.value })}
                  className="w-full rounded border border-border bg-surface text-text-primary px-3 py-2 text-sm"
                >
                  <option value="">Select BDM…</option>
                  {bdmUsers.map((u) => (
                    <option key={u.id} value={u.id}>{u.full_name} ({u.email})</option>
                  ))}
                </select>
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-text-primary mb-1">Account *</label>
                <select
                  value={formData.account_id}
                  onChange={(e) => setFormData({ ...formData, account_id: e.target.value, program_id: "" })}
                  className="w-full rounded border border-border bg-surface text-text-primary px-3 py-2 text-sm"
                >
                  <option value="">Select account…</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-text-primary mb-1">Program</label>
                <select
                  value={formData.program_id}
                  onChange={(e) => setFormData({ ...formData, program_id: e.target.value })}
                  className="w-full rounded border border-border bg-surface text-text-primary px-3 py-2 text-sm"
                >
                  <option value="">— None —</option>
                  {programs.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-text-primary mb-1">Type</label>
                <select
                  value={formData.type_id}
                  onChange={(e) => setFormData({ ...formData, type_id: e.target.value })}
                  className="w-full rounded border border-border bg-surface text-text-primary px-3 py-2 text-sm"
                >
                  <option value="">— None —</option>
                  {reminderTypes.map((t) => (
                    <option key={t.id} value={String(t.id)}>{t.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-text-primary mb-1">Date *</label>
                <input
                  type="date"
                  value={formData.start_date}
                  onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                  className="w-full rounded border border-border bg-surface text-text-primary px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-primary mb-1">Status</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className="w-full rounded border border-border bg-surface text-text-primary px-3 py-2 text-sm"
                >
                  <option value="open">Open</option>
                  <option value="in_progress">In Progress</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
            </div>
            <Input
              label="Title *"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Reminder title"
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-text-primary mb-1">Recurrence</label>
                <select
                  value={formData.recurrence_rule}
                  onChange={(e) => setFormData({ ...formData, recurrence_rule: e.target.value })}
                  className="w-full rounded border border-border bg-surface text-text-primary px-3 py-2 text-sm"
                >
                  {RECURRENCE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1">Notes</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
                placeholder="Optional notes…"
                className="w-full rounded border border-border bg-surface text-text-primary px-3 py-2 text-sm resize-y"
              />
            </div>
            <div className="flex gap-2 pt-1">
              <Button onClick={handleSave} loading={saving} variant="primary" size="sm">
                {editingId ? "Save Changes" : "Create Reminder"}
              </Button>
              <Button onClick={() => setShowForm(false)} variant="secondary" size="sm">
                Cancel
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Table */}
      <Card padding="none">
        {loading ? (
          <div className="text-center py-10 text-text-secondary text-sm">Loading…</div>
        ) : reminders.length === 0 ? (
          <div className="text-center py-10 text-text-secondary text-sm">
            No reminders found.{" "}
            <button onClick={() => openAdd()} className="text-brand hover:underline">
              Add one →
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="px-4 py-3 text-xs font-semibold text-text-secondary uppercase tracking-wide">Date</th>
                  <th className="px-4 py-3 text-xs font-semibold text-text-secondary uppercase tracking-wide">Account</th>
                  <th className="px-4 py-3 text-xs font-semibold text-text-secondary uppercase tracking-wide hidden md:table-cell">Program</th>
                  <th className="px-4 py-3 text-xs font-semibold text-text-secondary uppercase tracking-wide hidden lg:table-cell">Type</th>
                  <th className="px-4 py-3 text-xs font-semibold text-text-secondary uppercase tracking-wide">Title</th>
                  <th className="px-4 py-3 text-xs font-semibold text-text-secondary uppercase tracking-wide">Status</th>
                  <th className="px-4 py-3 text-xs font-semibold text-text-secondary uppercase tracking-wide hidden lg:table-cell">Recurrence</th>
                  <th className="px-4 py-3 text-xs font-semibold text-text-secondary uppercase tracking-wide hidden md:table-cell">Edited</th>
                  <th className="px-4 py-3 text-xs font-semibold text-text-secondary uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody>
                {reminders.map((r) => (
                  <tr key={r.id} className="border-b border-border last:border-0 hover:bg-surface-hover">
                    <td className="px-4 py-3 text-text-primary whitespace-nowrap">{r.start_date}</td>
                    <td className="px-4 py-3 font-medium text-text-primary">{r.account_name ?? "—"}</td>
                    <td className="px-4 py-3 text-text-secondary hidden md:table-cell">{r.program_name ?? "—"}</td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      {r.type_name ? (
                        <span
                          className="inline-block px-2 py-0.5 rounded-full text-xs font-medium text-white"
                          style={{ backgroundColor: r.type_color ?? "#6b7280" }}
                        >
                          {r.type_name}
                        </span>
                      ) : (
                        <span className="text-text-secondary">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-text-primary max-w-[200px] truncate">{r.title}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleMarkCompleted(r)}
                        title={r.status === "completed" ? "Already completed" : "Click to mark as completed"}
                        disabled={r.status === "completed"}
                        className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${r.status !== "completed" ? "cursor-pointer hover:opacity-80" : "cursor-default"} ${statusBadge(r.status, r.start_date)}`}
                      >
                        {statusLabel(r.status, r.start_date)}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-text-secondary text-xs hidden lg:table-cell">
                      {r.recurrence_rule ? (
                        <span className="bg-surface border border-border px-2 py-0.5 rounded text-xs">
                          {r.recurrence_rule.charAt(0) + r.recurrence_rule.slice(1).toLowerCase()}
                        </span>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-3 text-text-secondary text-xs hidden md:table-cell">
                      {r.edit_count > 0 ? `${r.edit_count}×` : "—"}
                    </td>
                    <td className="px-4 py-3">
                      {deletingId === r.id ? (
                        <span className="flex items-center gap-2 text-xs">
                          <span className="text-red-500">Delete?</span>
                          <button onClick={() => handleDelete(r.id)} className="text-red-500 font-medium hover:underline">Confirm</button>
                          <button onClick={() => setDeletingId(null)} className="text-text-secondary hover:underline">Cancel</button>
                        </span>
                      ) : (
                        <span className="flex items-center gap-3 text-xs">
                          <button onClick={() => openGenerate(r)} className="text-purple-600 hover:underline">✉ Generate</button>
                          <button onClick={() => openEdit(r)} className="text-brand hover:underline">Edit</button>
                          <button onClick={() => setDeletingId(r.id)} className="text-red-500 hover:underline">Delete</button>
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Generate Email Panel */}
      {generateReminder && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/50">
          <div className="w-full max-w-2xl bg-surface rounded-xl shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div>
                <h2 className="font-semibold text-text-primary">Generate Email</h2>
                <p className="text-xs text-text-secondary mt-0.5">{generateReminder.account_name} &mdash; {generateReminder.title}</p>
              </div>
              <button onClick={() => setGenerateReminder(null)} className="text-text-secondary hover:text-text-primary text-xl leading-none">&times;</button>
            </div>
            <div className="p-5 space-y-4">

              {/* Contact selector */}
              <div>
                <label className="block text-sm font-medium text-text-primary mb-1">
                  Recipient contact
                  {genContacts.length === 0 && <span className="ml-1 text-xs font-normal text-text-secondary">(no contacts on this account)</span>}
                </label>
                {genContacts.length > 0 ? (
                  <select
                    value={genContactId}
                    onChange={(e) => setGenContactId(e.target.value)}
                    className="w-full rounded border border-border bg-surface text-text-primary px-3 py-2 text-sm"
                  >
                    <option value="">— No contact selected —</option>
                    {genContacts.map((c) => {
                      const name = [c.first_name, c.last_name].filter(Boolean).join(" ") || "(no name)";
                      const label = c.email ? `${name} <${c.email}>` : name;
                      return <option key={c.id} value={c.id}>{label}{c.is_decision_maker ? " ★" : ""}</option>;
                    })}
                  </select>
                ) : (
                  <p className="text-xs text-text-secondary">Add contacts to this account to enable recipient selection and auto-fill.</p>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-1">Template (optional)</label>
                  <select value={genTemplateId} onChange={(e) => setGenTemplateId(e.target.value)} className="w-full rounded border border-border bg-surface text-text-primary px-3 py-2 text-sm">
                    <option value="">No template (AI free-form)</option>
                    {templates.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-1">Tone</label>
                  <select value={genTone} onChange={(e) => setGenTone(e.target.value as Tone)} className="w-full rounded border border-border bg-surface text-text-primary px-3 py-2 text-sm">
                    <option value="friendly">Friendly</option>
                    <option value="formal">Formal</option>
                    <option value="direct">Direct</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-2">
                <Button variant="primary" size="sm" loading={genLoading} onClick={handleGenerate}>
                  Generate →
                </Button>
                {genHistory.length > 0 && (
                  <Button variant="secondary" size="sm" onClick={() => setShowHistory((v) => !v)}>
                    {showHistory ? "Hide" : "Show"} History ({genHistory.length})
                  </Button>
                )}
              </div>

              {/* Latest generation result — editable */}
              {genResult && (() => {
                const selectedContact = genContacts.find((c) => c.id === genContactId);
                const recipientEmail = selectedContact?.email ?? genResult.sent_to_email ?? "";
                const isSent = !!genResult.sent_at;
                return (
                  <div className="rounded-lg border border-border bg-surface-hover p-4 space-y-3">
                    <div>
                      <p className="text-xs font-semibold text-text-secondary uppercase mb-1">Subject</p>
                      {isSent ? (
                        <p className="text-sm font-medium text-text-primary">{genResult.subject}</p>
                      ) : (
                        <input
                          type="text"
                          value={genResult.subject}
                          onChange={(e) => setGenResult({ ...genResult, subject: e.target.value })}
                          onBlur={() => {
                            api.patch(`/generate/${genResult.id}`, { subject: genResult.subject }).catch(() => {});
                          }}
                          className="w-full rounded border border-border bg-surface text-text-primary px-3 py-2 text-sm font-medium"
                        />
                      )}
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-text-secondary uppercase mb-1">Body</p>
                      {isSent ? (
                        <pre className="text-sm text-text-primary whitespace-pre-wrap font-sans">{genResult.body}</pre>
                      ) : (
                        <textarea
                          value={genResult.body}
                          onChange={(e) => setGenResult({ ...genResult, body: e.target.value })}
                          onBlur={() => {
                            api.patch(`/generate/${genResult.id}`, { body: genResult.body }).catch(() => {});
                          }}
                          rows={8}
                          className="w-full rounded border border-border bg-surface text-text-primary px-3 py-2 text-sm font-sans"
                        />
                      )}
                    </div>
                    <div className="flex items-center justify-between flex-wrap gap-2 pt-1 border-t border-border">
                      <p className="text-xs text-text-secondary">Tokens: {genResult.tokens_used}</p>
                      {isSent ? (
                        <span className="text-xs text-green-600 font-medium">
                          ✉ Sent to {genResult.sent_to_email} · {new Date(genResult.sent_at!).toLocaleString()}
                        </span>
                      ) : recipientEmail ? (
                        <Button
                          variant="primary"
                          size="sm"
                          loading={sendLoading}
                          onClick={() => handleSendEmail(genResult, recipientEmail)}
                        >
                          ✉ Send to {recipientEmail}
                        </Button>
                      ) : (
                        <span className="text-xs text-text-secondary italic">Select a contact with email to send</span>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* History */}
              {showHistory && genHistory.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-text-secondary">Previous Generations</h3>
                  {genHistory.map((msg) => (
                    <div key={msg.id} className="rounded border border-border p-3 space-y-2 text-sm">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className="font-medium text-text-primary">{msg.subject}</span>
                        <div className="flex items-center gap-2">
                          {msg.sent_at && (
                            <span className="text-xs text-green-600">✉ {msg.sent_to_email}</span>
                          )}
                          <span className="text-xs text-text-secondary">{new Date(msg.generated_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                      <pre className="text-xs text-text-secondary whitespace-pre-wrap font-sans line-clamp-3">{msg.body}</pre>
                      {!msg.sent_at && (() => {
                        const selectedContact = genContacts.find((c) => c.id === genContactId);
                        const recipientEmail = selectedContact?.email ?? "";
                        return recipientEmail ? (
                          <Button
                            variant="secondary"
                            size="sm"
                            loading={sendLoading}
                            onClick={() => handleSendEmail(msg, recipientEmail)}
                          >
                            ✉ Send to {recipientEmail}
                          </Button>
                        ) : null;
                      })()}
                    </div>
                  ))}
                </div>
              )}

            </div>
          </div>
        </div>
      )}
      <ToastComponent />

      {/* Import Modal */}
      {showImport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-surface rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <h2 className="font-semibold text-text-primary">
                {importStep === "upload" && "Import Reminders"}
                {importStep === "preview" && "Import Preview"}
                {importStep === "done" && "Import Complete"}
              </h2>
              <button
                onClick={() => setShowImport(false)}
                className="text-text-secondary hover:text-text-primary text-xl leading-none"
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Step 1: Upload */}
              {importStep === "upload" && (
                <>
                  <p className="text-sm text-text-secondary">
                    Upload a .xlsx file with one reminder per row. Each row must specify account, program, reminder type, title, and due date.
                  </p>
                  <div className="flex items-center gap-3">
                    <a
                      href="/api/reminders/import/template"
                      download
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded border border-border text-sm text-text-primary hover:bg-surface-hover"
                    >
                      ⬇ Download Template
                    </a>
                  </div>
                  <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
                    {importFile ? (
                      <div className="space-y-2">
                        <p className="font-medium text-text-primary text-sm">📄 {importFile.name}</p>
                        <p className="text-xs text-text-secondary">{(importFile.size / 1024).toFixed(1)} KB</p>
                        <button
                          onClick={() => setImportFile(null)}
                          className="text-xs text-red-500 hover:underline"
                        >
                          Remove
                        </button>
                      </div>
                    ) : (
                      <>
                        <p className="text-sm text-text-secondary mb-3">Drag & drop your .xlsx file here</p>
                        <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 rounded bg-brand text-white text-sm font-medium hover:bg-brand/90">
                          Browse files
                          <input
                            type="file"
                            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                            className="hidden"
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) setImportFile(f);
                            }}
                          />
                        </label>
                      </>
                    )}
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <Button variant="secondary" size="sm" onClick={() => setShowImport(false)}>Cancel</Button>
                    <Button
                      variant="primary"
                      size="sm"
                      loading={importLoading}
                      disabled={!importFile}
                      onClick={handleImportPreview}
                    >
                      Preview →
                    </Button>
                  </div>
                </>
              )}

              {/* Step 2: Preview */}
              {importStep === "preview" && importPreview && (
                <>
                  <div className="flex gap-4">
                    <span className="text-sm font-medium text-green-700 bg-green-50 px-3 py-1 rounded-full">
                      ✓ {importPreview.valid_rows} valid
                    </span>
                    {importPreview.error_rows > 0 && (
                      <span className="text-sm font-medium text-red-700 bg-red-50 px-3 py-1 rounded-full">
                        ✗ {importPreview.error_rows} errors
                      </span>
                    )}
                    <span className="text-sm text-text-secondary ml-auto">
                      {importPreview.total_rows} total rows
                    </span>
                  </div>
                  <div className="overflow-x-auto border border-border rounded-lg max-h-72 overflow-y-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-surface-hover border-b border-border text-left">
                          <th className="px-3 py-2 font-semibold text-text-secondary">Row</th>
                          <th className="px-3 py-2 font-semibold text-text-secondary">Account</th>
                          <th className="px-3 py-2 font-semibold text-text-secondary">Program</th>
                          <th className="px-3 py-2 font-semibold text-text-secondary">Title</th>
                          <th className="px-3 py-2 font-semibold text-text-secondary">Due Date</th>
                          <th className="px-3 py-2 font-semibold text-text-secondary">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {importPreview.rows.map((row) => (
                          <tr
                            key={row.row_num}
                            className={`border-b border-border last:border-0 ${row.status === "ok" ? "bg-green-50/30" : "bg-red-50/50"}`}
                          >
                            <td className="px-3 py-2 text-text-secondary">{row.row_num}</td>
                            <td className="px-3 py-2 text-text-primary max-w-[100px] truncate">{row.account}</td>
                            <td className="px-3 py-2 text-text-secondary max-w-[100px] truncate">{row.program}</td>
                            <td className="px-3 py-2 text-text-primary max-w-[150px] truncate">{row.title}</td>
                            <td className="px-3 py-2 text-text-secondary">{row.due_date}</td>
                            <td className="px-3 py-2">
                              {row.status === "ok" ? (
                                <span className="text-green-700 font-medium">✓</span>
                              ) : (
                                <span className="text-red-600" title={row.error_msg ?? ""}>✗ {row.error_msg}</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <Button variant="secondary" size="sm" onClick={() => setImportStep("upload")}>← Back</Button>
                    <Button
                      variant="primary"
                      size="sm"
                      loading={importLoading}
                      disabled={importPreview.valid_rows === 0}
                      onClick={handleImportConfirm}
                    >
                      Import {importPreview.valid_rows} Reminder{importPreview.valid_rows !== 1 ? "s" : ""} →
                    </Button>
                  </div>
                </>
              )}

              {/* Step 3: Done */}
              {importStep === "done" && importPreview && (
                <div className="text-center py-6 space-y-3">
                  <div className="text-4xl">✓</div>
                  <p className="font-semibold text-text-primary text-lg">Import Complete!</p>
                  <p className="text-sm text-green-700">{importPreview.created} reminder{importPreview.created !== 1 ? "s" : ""} created successfully</p>
                  {importPreview.error_rows > 0 && (
                    <p className="text-sm text-red-600">{importPreview.error_rows} row{importPreview.error_rows !== 1 ? "s" : ""} skipped due to errors</p>
                  )}
                  <Button variant="primary" size="sm" onClick={() => setShowImport(false)}>
                    Close
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function RemindersPage() {
  return (
    <RoleGuard
      allowedRoles={["admin", "bdm"]}
      fallback={<p className="text-red-600">Access denied</p>}
    >
      <RemindersContent />
    </RoleGuard>
  );
}
