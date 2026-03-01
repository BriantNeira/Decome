"use client";

import { useEffect, useState } from "react";
import { useToast } from "@/components/ui/Toast";
import { RoleGuard } from "@/components/layout/RoleGuard";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import api, { parseApiError } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { Reminder, Account, Program, ReminderType } from "@/types/masterdata";

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

const STATUS_NEXT: Record<string, string> = {
  open: "in_progress",
  in_progress: "completed",
  completed: "open",
  cancelled: "open",
};

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

  useEffect(() => {
    loadReferenceData();
  }, []);

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

  async function handleStatusToggle(r: Reminder) {
    const next = STATUS_NEXT[r.status] ?? "open";
    try {
      await api.patch(`/reminders/${r.id}`, { status: next });
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

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">Reminders</h1>
          <p className="text-sm text-text-secondary mt-0.5">Total: {total}</p>
        </div>
        <Button onClick={() => openAdd()} variant="primary" size="sm">
          + Add Reminder
        </Button>
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
                        onClick={() => handleStatusToggle(r)}
                        title="Click to advance status"
                        className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold cursor-pointer hover:opacity-80 ${statusBadge(r.status, r.start_date)}`}
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

      <ToastComponent />
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
