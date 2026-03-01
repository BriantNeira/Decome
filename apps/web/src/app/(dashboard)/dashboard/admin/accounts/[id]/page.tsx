"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/components/ui/Toast";
import { RoleGuard } from "@/components/layout/RoleGuard";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { FileUpload } from "@/components/ui/FileUpload";
import api, { parseApiError } from "@/lib/api";
import {
  AccountDetail,
  AccountNote,
  ContactSummary,
  CustomFieldDefinition,
  CustomFieldValue,
} from "@/types/masterdata";

function AccountDetailContent() {
  const params = useParams();
  const router = useRouter();
  const accountId = params.id as string;
  const { user } = useAuth();
  const { showToast, ToastComponent } = useToast();

  const [activeTab, setActiveTab] = useState<"overview" | "logo" | "notes">("overview");
  const [account, setAccount] = useState<AccountDetail | null>(null);
  const [loading, setLoading] = useState(true);

  // Notes state
  const [noteContent, setNoteContent] = useState("");
  const [submittingNote, setSubmittingNote] = useState(false);
  const [editingNote, setEditingNote] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingNote, setDeletingNote] = useState<string | null>(null);

  // Logo state
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoDeleting, setLogoDeleting] = useState(false);

  // Custom fields state
  const [cfDefinitions, setCfDefinitions] = useState<CustomFieldDefinition[]>([]);
  const [cfValues, setCfValues] = useState<Record<number, string>>({});
  const [editingCF, setEditingCF] = useState(false);
  const [cfEditData, setCfEditData] = useState<Record<number, string>>({});
  const [cfSaving, setCfSaving] = useState(false);

  useEffect(() => {
    loadAccount();
    loadCustomFields();
  }, [accountId]);

  async function loadAccount() {
    try {
      setLoading(true);
      const res = await api.get<AccountDetail>(`/accounts/${accountId}`);
      setAccount(res.data);
    } catch (err: any) {
      showToast(parseApiError(err, "Failed to load account"), "error");
    } finally {
      setLoading(false);
    }
  }

  async function loadCustomFields() {
    try {
      const [defsRes, valRes] = await Promise.all([
        api.get<{ items: CustomFieldDefinition[] }>("/custom-fields/definitions?entity_type=account"),
        api.get<{ values: CustomFieldValue[] }>(`/custom-fields/values/account/${accountId}`),
      ]);
      setCfDefinitions(defsRes.data.items);
      const valMap: Record<number, string> = {};
      for (const v of valRes.data.values) {
        valMap[v.definition_id] = v.value ?? "";
      }
      setCfValues(valMap);
    } catch {
      // non-critical
    }
  }

  // Logo upload
  async function handleLogoUpload(file: File) {
    setLogoUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      await api.post(`/accounts/${accountId}/logo`, form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      showToast("Logo uploaded", "success");
      await loadAccount();
    } catch (err: any) {
      showToast(parseApiError(err, "Failed to upload logo"), "error");
    } finally {
      setLogoUploading(false);
    }
  }

  async function handleLogoDelete() {
    setLogoDeleting(true);
    try {
      await api.delete(`/accounts/${accountId}/logo`);
      showToast("Logo removed", "success");
      await loadAccount();
    } catch (err: any) {
      showToast(parseApiError(err, "Failed to remove logo"), "error");
    } finally {
      setLogoDeleting(false);
    }
  }

  // Custom fields
  function startEditCF() {
    setCfEditData({ ...cfValues });
    setEditingCF(true);
  }

  async function handleSaveCF() {
    setCfSaving(true);
    try {
      const values = Object.entries(cfEditData).map(([defId, value]) => ({
        definition_id: parseInt(defId),
        value: value || null,
      }));
      await api.put(`/custom-fields/values/account/${accountId}`, { values });
      showToast("Custom fields saved", "success");
      setEditingCF(false);
      await loadCustomFields();
    } catch (err: any) {
      showToast(parseApiError(err, "Failed to save custom fields"), "error");
    } finally {
      setCfSaving(false);
    }
  }

  // Notes
  async function handleAddNote() {
    if (!noteContent.trim()) {
      showToast("Note content is required", "error");
      return;
    }
    setSubmittingNote(true);
    try {
      await api.post(`/accounts/${accountId}/notes`, { content: noteContent.trim() });
      showToast("Note added", "success");
      setNoteContent("");
      await loadAccount();
    } catch (err: any) {
      showToast(parseApiError(err, "Failed to add note"), "error");
    } finally {
      setSubmittingNote(false);
    }
  }

  function startEditNote(note: AccountNote) {
    setEditingNote(note.id);
    setEditContent(note.content);
  }

  function cancelEditNote() {
    setEditingNote(null);
    setEditContent("");
  }

  async function handleSaveEditNote(noteId: string) {
    if (!editContent.trim()) {
      showToast("Note content is required", "error");
      return;
    }
    setSavingEdit(true);
    try {
      await api.patch(`/accounts/${accountId}/notes/${noteId}`, { content: editContent.trim() });
      showToast("Note updated", "success");
      setEditingNote(null);
      setEditContent("");
      await loadAccount();
    } catch (err: any) {
      showToast(parseApiError(err, "Failed to update note"), "error");
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleDeleteNote(noteId: string) {
    setDeletingNote(noteId);
    try {
      await api.delete(`/accounts/${accountId}/notes/${noteId}`);
      showToast("Note deleted", "success");
      await loadAccount();
    } catch (err: any) {
      showToast(parseApiError(err, "Failed to delete note"), "error");
    } finally {
      setDeletingNote(null);
    }
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleString();
  }

  function renderCFInput(def: CustomFieldDefinition) {
    const val = cfEditData[def.id] ?? "";
    if (def.field_type === "boolean") {
      return (
        <input
          type="checkbox"
          checked={val === "true"}
          onChange={(e) =>
            setCfEditData({ ...cfEditData, [def.id]: e.target.checked ? "true" : "false" })
          }
          className="rounded"
        />
      );
    }
    if (def.field_type === "dropdown" && def.options?.choices) {
      return (
        <select
          value={val}
          onChange={(e) => setCfEditData({ ...cfEditData, [def.id]: e.target.value })}
          className="w-full rounded border border-border bg-surface text-text-primary px-3 py-2 text-sm"
        >
          <option value="">— Select —</option>
          {def.options.choices.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      );
    }
    return (
      <input
        type={def.field_type === "number" ? "number" : def.field_type === "date" ? "date" : "text"}
        value={val}
        onChange={(e) => setCfEditData({ ...cfEditData, [def.id]: e.target.value })}
        className="w-full rounded border border-border bg-surface text-text-primary px-3 py-2 text-sm"
      />
    );
  }

  function formatContactName(c: ContactSummary): string {
    const parts = [c.title, c.first_name, c.last_name].filter(Boolean);
    return parts.join(" ") || "Unnamed Contact";
  }

  const currentUserId = user?.id;
  const isAdmin = user?.role === "admin";
  const canManageLogo = user?.role === "admin" || user?.role === "director";

  if (loading) {
    return <div className="text-center py-12 text-text-secondary">Loading account...</div>;
  }

  if (!account) {
    return (
      <div className="text-center py-12">
        <p className="text-text-secondary">Account not found.</p>
        <Button onClick={() => router.push("/dashboard/admin/accounts")} variant="secondary" size="sm" className="mt-4">
          Back to Accounts
        </Button>
      </div>
    );
  }

  const activeAssignments = account.assignments.filter((a) => a.is_active);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.push("/dashboard/admin/accounts")}
          className="text-text-secondary hover:text-text-primary transition-colors text-sm"
        >
          &larr; Accounts
        </button>
        <div className="flex-1 flex items-center gap-4">
          {account.logo_url && (
            <img
              src={account.logo_url}
              alt={account.name}
              className="w-14 h-14 rounded-lg object-contain border border-border bg-surface flex-shrink-0"
            />
          )}
          <div>
            <h1 className="text-2xl font-semibold text-text-primary">{account.name}</h1>
            <div className="flex items-center gap-3 mt-1">
              {account.code && (
                <span className="text-sm text-text-secondary font-mono">{account.code}</span>
              )}
              <span
                className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                  account.is_active ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"
                }`}
              >
                {account.is_active ? "Active" : "Inactive"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex border-b border-border">
        {(["overview", "logo", "notes"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-5 py-2.5 text-sm font-medium capitalize border-b-2 -mb-px transition-colors ${
              activeTab === tab
                ? "border-sidebar-active text-sidebar-active"
                : "border-transparent text-text-secondary hover:text-text-primary"
            }`}
          >
            {tab === "notes" ? `Notes (${account.notes.length})` : tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Tab: Overview */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* Description */}
          {account.description && (
            <Card padding="md">
              <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wide mb-2">
                Description
              </h2>
              <p className="text-text-primary text-sm">{account.description}</p>
            </Card>
          )}

          {/* Programs & BDMs (Assignments) */}
          <Card padding="md">
            <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wide mb-4">
              Programs &amp; BDMs ({activeAssignments.length})
            </h2>

            {activeAssignments.length === 0 ? (
              <p className="text-text-secondary text-sm">No assignments yet.</p>
            ) : (
              <div className="space-y-3">
                {activeAssignments.map((a) => (
                  <div key={a.id} className="border border-border rounded-lg p-4 flex flex-wrap gap-6 items-start">
                    {/* Program */}
                    <div className="min-w-[150px]">
                      <p className="text-xs font-medium text-text-secondary uppercase tracking-wide mb-1">
                        Program
                      </p>
                      {isAdmin ? (
                        <Link
                          href="/dashboard/admin/programs"
                          className="text-sm font-medium text-sidebar-active hover:underline"
                        >
                          {a.program_name || "---"}
                        </Link>
                      ) : (
                        <p className="text-sm font-medium text-text-primary">{a.program_name || "---"}</p>
                      )}
                    </div>

                    {/* BDM */}
                    <div className="min-w-[150px]">
                      <p className="text-xs font-medium text-text-secondary uppercase tracking-wide mb-1">
                        BDM
                      </p>
                      <p className="text-sm text-text-primary">{a.bdm_name || "---"}</p>
                      {a.bdm_email && (
                        <p className="text-xs text-text-secondary">{a.bdm_email}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Contacts */}
          <Card padding="md">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wide">
                Contacts ({account.contacts?.length ?? 0})
              </h2>
              <Link
                href={`/dashboard/admin/contacts?account_id=${accountId}`}
                className="text-sm text-brand hover:underline font-medium"
              >
                Manage Contacts &rarr;
              </Link>
            </div>

            {!account.contacts || account.contacts.length === 0 ? (
              <p className="text-text-secondary text-sm">No contacts for this account.</p>
            ) : (
              <div className="space-y-2">
                {account.contacts.map((c: ContactSummary) => (
                  <div
                    key={c.id}
                    className="border border-border rounded-lg px-4 py-3 flex items-center justify-between hover:bg-bg transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div>
                        <Link
                          href={`/dashboard/admin/contacts/${c.id}`}
                          className="text-sm font-medium text-brand hover:underline"
                        >
                          {formatContactName(c)}
                        </Link>
                        {c.email && (
                          <p className="text-xs text-text-secondary">{c.email}</p>
                        )}
                      </div>
                    </div>
                    {c.is_decision_maker && (
                      <span className="inline-block px-2 py-0.5 rounded text-[10px] font-medium bg-blue-100 text-blue-800 shrink-0">
                        DM
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Custom Fields */}
          <Card padding="md">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wide">
                Custom Fields
              </h2>
              {isAdmin && cfDefinitions.length > 0 && !editingCF && (
                <button
                  onClick={startEditCF}
                  className="text-sm text-brand hover:underline font-medium"
                >
                  Edit Fields
                </button>
              )}
            </div>

            {cfDefinitions.length === 0 ? (
              <p className="text-text-secondary text-sm">No custom fields defined.</p>
            ) : editingCF ? (
              <div className="space-y-3">
                {cfDefinitions.map((def) => (
                  <div key={def.id}>
                    <label className="block text-sm font-medium text-text-primary mb-1">
                      {def.field_name}
                      {def.is_required && <span className="text-red-500 ml-1">*</span>}
                    </label>
                    {renderCFInput(def)}
                  </div>
                ))}
                <div className="flex gap-2 pt-2">
                  <Button onClick={handleSaveCF} loading={cfSaving} variant="primary" size="sm">
                    Save Fields
                  </Button>
                  <Button onClick={() => setEditingCF(false)} variant="secondary" size="sm">
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {cfDefinitions.map((def) => {
                  const val = cfValues[def.id];
                  return (
                    <div key={def.id} className="flex gap-2 text-sm">
                      <span className="font-medium text-text-secondary min-w-[160px]">{def.field_name}:</span>
                      <span className="text-text-primary">
                        {val !== undefined && val !== "" ? (
                          def.field_type === "boolean" ? (val === "true" ? "Yes" : "No") : val
                        ) : (
                          <span className="italic text-text-secondary">---</span>
                        )}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* Tab: Logo */}
      {activeTab === "logo" && (
        <Card padding="md">
          <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wide mb-4">
            Account Logo
          </h2>

          {canManageLogo ? (
            account.logo_url ? (
              <div className="flex items-center gap-4">
                <img
                  src={account.logo_url}
                  alt="Logo"
                  className="w-24 h-24 rounded-lg object-contain border border-border bg-surface"
                />
                <div className="space-y-2">
                  <div className="w-48">
                    <FileUpload
                      accept=".svg,.png"
                      maxSizeMB={2}
                      label="Replace logo"
                      onFile={handleLogoUpload}
                    />
                  </div>
                  <button
                    onClick={handleLogoDelete}
                    disabled={logoDeleting}
                    className="text-sm text-red-500 hover:underline disabled:opacity-50"
                  >
                    {logoDeleting ? "Removing..." : "Remove logo"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="max-w-sm">
                <FileUpload
                  accept=".svg,.png"
                  maxSizeMB={2}
                  label="Upload logo"
                  onFile={handleLogoUpload}
                />
                {logoUploading && (
                  <p className="mt-2 text-xs text-text-secondary">Uploading...</p>
                )}
              </div>
            )
          ) : (
            <div className="flex items-center gap-4">
              {account.logo_url ? (
                <img
                  src={account.logo_url}
                  alt="Logo"
                  className="w-24 h-24 rounded-lg object-contain border border-border bg-surface"
                />
              ) : (
                <div className="w-24 h-24 rounded-lg border border-border bg-surface flex items-center justify-center">
                  <span className="text-text-secondary text-2xl font-bold">
                    {account.name.charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
              <p className="text-sm text-text-secondary italic">
                {account.logo_url ? "Logo is set." : "No logo uploaded."} Only admins and directors can manage logos.
              </p>
            </div>
          )}
        </Card>
      )}

      {/* Tab: Notes */}
      {activeTab === "notes" && (
        <Card padding="md">
          <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wide mb-4">
            Notes ({account.notes.length})
          </h2>

          <div className="mb-4 space-y-2">
            <textarea
              value={noteContent}
              onChange={(e) => setNoteContent(e.target.value)}
              className="w-full rounded border border-border bg-surface text-text-primary px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
              rows={3}
              placeholder="Write a note about this account..."
            />
            <Button onClick={handleAddNote} loading={submittingNote} variant="primary" size="sm">
              Add Note
            </Button>
          </div>

          {account.notes.length === 0 ? (
            <p className="text-text-secondary text-sm">No notes yet.</p>
          ) : (
            <div className="space-y-3">
              {account.notes.map((note) => {
                const isOwner = note.user_id === currentUserId;
                const canEdit = isOwner || isAdmin;
                const isEditing = editingNote === note.id;

                return (
                  <div key={note.id} className="border border-border rounded-lg p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="text-xs text-text-secondary">
                        <span className="font-medium text-text-primary">
                          {note.author_name || "Unknown"}
                        </span>{" "}
                        &middot; {formatDate(note.created_at)}
                        {note.updated_at !== note.created_at && (
                          <span className="ml-1 italic">(edited)</span>
                        )}
                      </div>
                      {canEdit && !isEditing && (
                        <div className="flex gap-2 shrink-0">
                          <button
                            onClick={() => startEditNote(note)}
                            className="text-xs text-brand hover:underline"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteNote(note.id)}
                            disabled={deletingNote === note.id}
                            className="text-xs text-red-600 hover:underline disabled:opacity-50"
                          >
                            {deletingNote === note.id ? "Deleting..." : "Delete"}
                          </button>
                        </div>
                      )}
                    </div>

                    {isEditing ? (
                      <div className="mt-2 space-y-2">
                        <textarea
                          value={editContent}
                          onChange={(e) => setEditContent(e.target.value)}
                          className="w-full rounded border border-border bg-surface text-text-primary px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
                          rows={3}
                        />
                        <div className="flex gap-2">
                          <Button
                            onClick={() => handleSaveEditNote(note.id)}
                            loading={savingEdit}
                            variant="primary"
                            size="sm"
                          >
                            Save
                          </Button>
                          <Button onClick={cancelEditNote} variant="secondary" size="sm">
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <p className="mt-2 text-sm text-text-primary whitespace-pre-wrap">
                        {note.content}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      )}

      <ToastComponent />
    </div>
  );
}

export default function AccountDetailPage() {
  return (
    <RoleGuard allowedRoles={["admin", "bdm", "director"]} fallback={<p className="text-red-600">Access denied</p>}>
      <AccountDetailContent />
    </RoleGuard>
  );
}
