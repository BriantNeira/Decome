"use client";

import { useEffect, useState } from "react";
import { useToast } from "@/components/ui/Toast";
import { RoleGuard } from "@/components/layout/RoleGuard";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import api, { parseApiError } from "@/lib/api";
import { Assignment, Account, Program } from "@/types/masterdata";

interface AssignmentsListResponse {
  items: Assignment[];
  total: number;
}

interface AccountsListResponse {
  items: Account[];
  total: number;
}

interface ProgramsListResponse {
  items: Program[];
  total: number;
}

interface BdmUser {
  id: string;
  full_name: string;
  email: string;
}

interface UsersListResponse {
  items: BdmUser[];
  total: number;
}

function AssignmentsContent() {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [total, setTotal] = useState(0);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [bdmUsers, setBdmUsers] = useState<BdmUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [formData, setFormData] = useState({
    user_id: "",
    account_id: "",
    program_id: "",
  });
  const [submitting, setSubmitting] = useState(false);

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState({ user_id: "", account_id: "", program_id: "", is_active: true });
  const [editSubmitting, setEditSubmitting] = useState(false);

  // Delete state
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const { showToast, ToastComponent } = useToast();

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    setLoading(true);
    try {
      const [assignRes, accRes, progRes, userRes] = await Promise.all([
        api.get<AssignmentsListResponse>("/assignments"),
        api.get<AccountsListResponse>("/accounts"),
        api.get<ProgramsListResponse>("/programs"),
        api.get<UsersListResponse>("/users?role=bdm&limit=200"),
      ]);
      setAssignments(assignRes.data.items);
      setTotal(assignRes.data.total);
      setAccounts(accRes.data.items);
      setPrograms(progRes.data.items);
      setBdmUsers(userRes.data.items);
    } catch (err: any) {
      showToast(parseApiError(err, "Failed to load data"), "error");
    } finally {
      setLoading(false);
    }
  }

  function getAccountName(id: string) {
    return accounts.find((a) => a.id === id)?.name ?? id.substring(0, 8) + "…";
  }

  function getProgramName(id: string) {
    return programs.find((p) => p.id === id)?.name ?? id.substring(0, 8) + "…";
  }

  function getBdmName(id: string) {
    const u = bdmUsers.find((u) => u.id === id);
    return u ? `${u.full_name} (${u.email})` : id.substring(0, 8) + "…";
  }

  async function handleCreate() {
    if (!formData.user_id || !formData.account_id || !formData.program_id) {
      showToast("All fields are required", "error");
      return;
    }
    setSubmitting(true);
    try {
      await api.post("/assignments", formData);
      showToast("Assignment created", "success");
      setFormData({ user_id: "", account_id: "", program_id: "" });
      setShowAdd(false);
      await loadAll();
    } catch (err: any) {
      showToast(parseApiError(err, "Failed to create assignment"), "error");
    } finally {
      setSubmitting(false);
    }
  }

  function startEdit(a: Assignment) {
    setEditingId(a.id);
    setEditData({ user_id: a.user_id, account_id: a.account_id, program_id: a.program_id, is_active: a.is_active });
  }

  async function handleSaveEdit(assignmentId: string) {
    setEditSubmitting(true);
    try {
      await api.patch(`/assignments/${assignmentId}`, editData);
      showToast("Assignment updated", "success");
      setEditingId(null);
      await loadAll();
    } catch (err: any) {
      showToast(parseApiError(err, "Failed to update assignment"), "error");
    } finally {
      setEditSubmitting(false);
    }
  }

  async function handleDelete(assignmentId: string) {
    setDeleting(true);
    try {
      await api.delete(`/assignments/${assignmentId}`);
      showToast("Assignment deleted", "success");
      setDeleteConfirmId(null);
      await loadAll();
    } catch (err: any) {
      showToast(parseApiError(err, "Failed to delete assignment"), "error");
    } finally {
      setDeleting(false);
    }
  }

  async function handleToggleActive(assignment: Assignment) {
    try {
      await api.patch(`/assignments/${assignment.id}`, {
        is_active: !assignment.is_active,
      });
      showToast(`Assignment ${assignment.is_active ? "deactivated" : "activated"}`, "success");
      await loadAll();
    } catch (err: any) {
      showToast(parseApiError(err, "Failed to update assignment"), "error");
    }
  }

  const selectClass =
    "w-full rounded border border-border bg-surface text-text-primary px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sidebar-active";

  // Filter programs by selected account (show programs for that account + programs with no account)
  const filteredPrograms = formData.account_id
    ? programs.filter((p) => !p.account_id || p.account_id === formData.account_id)
    : programs;

  const editFilteredPrograms = editData.account_id
    ? programs.filter((p) => !p.account_id || p.account_id === editData.account_id)
    : programs;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-semibold text-text-primary">Assignments</h1>
          <span className="text-sm text-text-secondary">Total: {total}</span>
        </div>
        <Button onClick={() => setShowAdd(!showAdd)} variant="primary">
          {showAdd ? "Cancel" : "+ Add Assignment"}
        </Button>
      </div>

      {showAdd && (
        <Card padding="md">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1">BDM User *</label>
              <select
                value={formData.user_id}
                onChange={(e) => setFormData({ ...formData, user_id: e.target.value })}
                className={selectClass}
              >
                <option value="">Select BDM user…</option>
                {bdmUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.full_name} — {u.email}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-text-primary mb-1">Account *</label>
              <select
                value={formData.account_id}
                onChange={(e) =>
                  setFormData({ ...formData, account_id: e.target.value, program_id: "" })
                }
                className={selectClass}
              >
                <option value="">Select account…</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} {a.code ? `(${a.code})` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-text-primary mb-1">Program *</label>
              <select
                value={formData.program_id}
                onChange={(e) => setFormData({ ...formData, program_id: e.target.value })}
                className={selectClass}
              >
                <option value="">Select program…</option>
                {filteredPrograms.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            <Button onClick={handleCreate} loading={submitting} variant="primary" size="md">
              Create Assignment
            </Button>
          </div>
        </Card>
      )}

      {loading ? (
        <div className="text-center py-12 text-text-secondary">Loading assignments…</div>
      ) : assignments.length === 0 ? (
        <Card padding="md">
          <p className="text-center text-text-secondary">No assignments found.</p>
        </Card>
      ) : (
        <Card padding="sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-4 font-medium text-text-secondary">BDM</th>
                  <th className="text-left py-3 px-4 font-medium text-text-secondary">Account</th>
                  <th className="text-left py-3 px-4 font-medium text-text-secondary">Program</th>
                  <th className="text-left py-3 px-4 font-medium text-text-secondary">Status</th>
                  <th className="py-3 px-4 text-right font-medium text-text-secondary">Actions</th>
                </tr>
              </thead>
              <tbody>
                {assignments.map((a) => {
                  const isEditing = editingId === a.id;
                  const isConfirmDelete = deleteConfirmId === a.id;

                  return (
                    <tr key={a.id} className="border-b border-border hover:bg-bg">
                      {isEditing ? (
                        <>
                          <td className="py-3 px-4">
                            <select
                              value={editData.user_id}
                              onChange={(e) => setEditData({ ...editData, user_id: e.target.value })}
                              className="rounded border border-border bg-surface text-text-primary px-2 py-1 text-sm w-full"
                            >
                              {bdmUsers.map((u) => (
                                <option key={u.id} value={u.id}>
                                  {u.full_name}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="py-3 px-4">
                            <select
                              value={editData.account_id}
                              onChange={(e) => setEditData({ ...editData, account_id: e.target.value, program_id: "" })}
                              className="rounded border border-border bg-surface text-text-primary px-2 py-1 text-sm w-full"
                            >
                              <option value="">Select account…</option>
                              {accounts.map((ac) => (
                                <option key={ac.id} value={ac.id}>{ac.name}</option>
                              ))}
                            </select>
                          </td>
                          <td className="py-3 px-4">
                            <select
                              value={editData.program_id}
                              onChange={(e) => setEditData({ ...editData, program_id: e.target.value })}
                              className="rounded border border-border bg-surface text-text-primary px-2 py-1 text-sm w-full"
                            >
                              <option value="">Select program…</option>
                              {editFilteredPrograms.map((p) => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                              ))}
                            </select>
                          </td>
                          <td className="py-3 px-4">
                            <label className="flex items-center gap-1 text-xs cursor-pointer">
                              <input
                                type="checkbox"
                                checked={editData.is_active}
                                onChange={(e) =>
                                  setEditData({ ...editData, is_active: e.target.checked })
                                }
                              />
                              Active
                            </label>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                onClick={() => handleSaveEdit(a.id)}
                                loading={editSubmitting}
                                variant="primary"
                                size="sm"
                              >
                                Save
                              </Button>
                              <Button
                                onClick={() => setEditingId(null)}
                                variant="secondary"
                                size="sm"
                              >
                                Cancel
                              </Button>
                            </div>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="py-3 px-4">{getBdmName(a.user_id)}</td>
                          <td className="py-3 px-4 font-medium">{getAccountName(a.account_id)}</td>
                          <td className="py-3 px-4">{getProgramName(a.program_id)}</td>
                          <td className="py-3 px-4">
                            <span
                              className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                                a.is_active
                                  ? "bg-green-100 text-green-800"
                                  : "bg-gray-100 text-gray-800"
                              }`}
                            >
                              {a.is_active ? "Active" : "Inactive"}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            {isConfirmDelete ? (
                              <div className="flex justify-end items-center gap-2">
                                <span className="text-xs text-red-600">Delete assignment?</span>
                                <button
                                  onClick={() => handleDelete(a.id)}
                                  disabled={deleting}
                                  className="text-xs text-red-600 font-semibold hover:underline disabled:opacity-50"
                                >
                                  {deleting ? "Deleting…" : "Confirm"}
                                </button>
                                <button
                                  onClick={() => setDeleteConfirmId(null)}
                                  className="text-xs text-text-secondary hover:underline"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <div className="flex justify-end gap-3">
                                <button
                                  onClick={() => startEdit(a)}
                                  className="text-xs text-brand hover:underline"
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={() => setDeleteConfirmId(a.id)}
                                  className="text-xs text-red-500 hover:underline"
                                >
                                  Delete
                                </button>
                                <button
                                  onClick={() => handleToggleActive(a)}
                                  className="text-xs text-text-secondary hover:text-text-primary underline"
                                >
                                  {a.is_active ? "Deactivate" : "Activate"}
                                </button>
                              </div>
                            )}
                          </td>
                        </>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <ToastComponent />
    </div>
  );
}

export default function AssignmentsPage() {
  return (
    <RoleGuard allowedRoles={["admin"]} fallback={<p className="text-red-600">Access denied</p>}>
      <AssignmentsContent />
    </RoleGuard>
  );
}
