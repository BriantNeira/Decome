"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useToast } from "@/components/ui/Toast";
import { RoleGuard } from "@/components/layout/RoleGuard";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import api, { parseApiError } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { Program, Account, Assignment } from "@/types/masterdata";

interface ProgramsListResponse {
  items: Program[];
  total: number;
}

interface AccountsListResponse {
  items: Account[];
  total: number;
}

interface AssignmentsListResponse {
  items: Assignment[];
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

function ProgramsContent() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  // Active tab — default "programs" for admin, "assignments" for BDM
  // We start with "assignments" as a safe default until user loads;
  // once we know the role we switch to "programs" for admin.
  const [activeTab, setActiveTab] = useState<"programs" | "assignments">("assignments");
  const [tabInitialized, setTabInitialized] = useState(false);

  useEffect(() => {
    if (user && !tabInitialized) {
      setActiveTab(user.role === "admin" ? "programs" : "assignments");
      setTabInitialized(true);
    }
  }, [user, tabInitialized]);

  // ── Programs state ────────────────────────────────────────────────────
  const [programs, setPrograms] = useState<Program[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [formData, setFormData] = useState({ name: "", description: "", account_id: "" });
  const [accountSearch, setAccountSearch] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState({ name: "", description: "", account_id: "" });
  const [editAccountSearch, setEditAccountSearch] = useState("");
  const [editAccountSelected, setEditAccountSelected] = useState(false);

  // Delete state
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // ── Assignments state ─────────────────────────────────────────────────
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [bdmUsers, setBdmUsers] = useState<BdmUser[]>([]);
  const [assignmentsLoading, setAssignmentsLoading] = useState(false);
  const [assignmentsLoaded, setAssignmentsLoaded] = useState(false);

  const { showToast, ToastComponent } = useToast();

  // ── Boot — wait for user to be available ─────────────────────────────
  useEffect(() => {
    if (!user) return; // auth not ready yet
    if (user.role === "admin") {
      loadPrograms();
      loadAccounts();
    } else {
      // BDM starts on assignments tab — load their own assignments
      loadAssignments();
    }
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load assignments lazily when admin switches to assignments tab
  useEffect(() => {
    if (activeTab === "assignments" && user?.role === "admin" && !assignmentsLoaded) {
      loadAssignments();
    }
  }, [activeTab, user?.role, assignmentsLoaded]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Data loaders ──────────────────────────────────────────────────────
  async function loadPrograms() {
    try {
      setLoading(true);
      const res = await api.get<ProgramsListResponse>("/programs");
      setPrograms(res.data.items);
      setTotal(res.data.total);
    } catch (err: any) {
      showToast(parseApiError(err, "Failed to load programs"), "error");
    } finally {
      setLoading(false);
    }
  }

  async function loadAccounts() {
    try {
      const res = await api.get<AccountsListResponse>("/accounts?limit=200");
      setAccounts(res.data.items);
    } catch {
      // non-critical
    }
  }

  async function loadAssignments() {
    setAssignmentsLoading(true);
    try {
      const role = user?.role;
      if (role === "admin") {
        const [assignRes, userRes] = await Promise.all([
          api.get<AssignmentsListResponse>("/assignments?limit=500"),
          api.get<UsersListResponse>("/users?role=bdm&limit=200"),
        ]);
        setAssignments(assignRes.data.items);
        setBdmUsers(userRes.data.items);
      } else {
        // BDM sees only their own assignments
        const assignRes = await api.get<AssignmentsListResponse>("/assignments/my?limit=500");
        setAssignments(assignRes.data.items);
      }
      setAssignmentsLoaded(true);
    } catch (err: any) {
      showToast(parseApiError(err, "Failed to load assignments"), "error");
    } finally {
      setAssignmentsLoading(false);
    }
  }

  // ── Programs CRUD ─────────────────────────────────────────────────────
  async function handleAddProgram() {
    if (!formData.name.trim()) {
      showToast("Program name is required", "error");
      return;
    }
    setSubmitting(true);
    try {
      const payload: any = { name: formData.name, description: formData.description || null };
      if (formData.account_id) payload.account_id = formData.account_id;
      await api.post("/programs", payload);
      showToast("Program created", "success");
      setFormData({ name: "", description: "", account_id: "" });
      setAccountSearch("");
      setShowAdd(false);
      await loadPrograms();
    } catch (err: any) {
      showToast(parseApiError(err, "Failed to create program"), "error");
    } finally {
      setSubmitting(false);
    }
  }

  function startEdit(program: Program) {
    setEditingId(program.id);
    setEditData({
      name: program.name,
      description: program.description || "",
      account_id: program.account_id ?? "",
    });
    const acctName = program.account_name ?? "";
    setEditAccountSearch(acctName);
    setEditAccountSelected(!!acctName);
  }

  async function handleSaveEdit(programId: string) {
    setSubmitting(true);
    try {
      const payload: any = {
        name: editData.name,
        description: editData.description || null,
        account_id: editData.account_id || null,
      };
      await api.patch(`/programs/${programId}`, payload);
      showToast("Program updated", "success");
      setEditingId(null);
      await loadPrograms();
    } catch (err: any) {
      showToast(parseApiError(err, "Failed to update program"), "error");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(programId: string) {
    setSubmitting(true);
    try {
      await api.delete(`/programs/${programId}`);
      showToast("Program deleted", "success");
      setDeletingId(null);
      await loadPrograms();
      // Reset assignments cache so they reload next visit
      setAssignmentsLoaded(false);
    } catch (err: any) {
      showToast(parseApiError(err, "Failed to delete program"), "error");
    } finally {
      setSubmitting(false);
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────
  const filteredAccounts = accounts.filter((a) =>
    a.name.toLowerCase().includes(accountSearch.toLowerCase())
  );

  function getBdmName(userId: string) {
    const u = bdmUsers.find((u) => u.id === userId);
    return u ? u.full_name : "—";
  }

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-semibold text-text-primary">Programs</h1>
          {isAdmin && activeTab === "programs" && (
            <span className="text-sm text-text-secondary">Total: {total}</span>
          )}
          {activeTab === "assignments" && (
            <span className="text-sm text-text-secondary">
              {assignments.length} assignment{assignments.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>
        {isAdmin && activeTab === "programs" && (
          <Button onClick={() => setShowAdd(!showAdd)} variant="primary">
            {showAdd ? "Cancel" : "+ Add Program"}
          </Button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border">
        {isAdmin && (
          <button
            onClick={() => setActiveTab("programs")}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === "programs"
                ? "border-action text-action"
                : "border-transparent text-text-secondary hover:text-text-primary"
            }`}
          >
            Programs
          </button>
        )}
        <button
          onClick={() => setActiveTab("assignments")}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
            activeTab === "assignments"
              ? "border-action text-action"
              : "border-transparent text-text-secondary hover:text-text-primary"
          }`}
        >
          Assignments
        </button>
      </div>

      {/* ── PROGRAMS TAB ──────────────────────────────────────────────── */}
      {activeTab === "programs" && isAdmin && (
        <>
          {showAdd && (
            <Card padding="md">
              <div className="space-y-4">
                <Input
                  label="Program Name *"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Enter program name"
                />
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-1">Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full rounded border border-border bg-surface text-text-primary px-3 py-2 text-sm"
                    rows={3}
                    placeholder="Optional description"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-1">Account</label>
                  <Input
                    placeholder="Search account..."
                    value={accountSearch}
                    onChange={(e) => {
                      setAccountSearch(e.target.value);
                      setFormData({ ...formData, account_id: "" });
                    }}
                  />
                  {accountSearch && !formData.account_id && (
                    <div className="mt-1 border border-border rounded bg-surface max-h-40 overflow-y-auto shadow-sm">
                      {filteredAccounts.length === 0 ? (
                        <div className="px-3 py-2 text-sm text-text-secondary">No accounts found</div>
                      ) : (
                        filteredAccounts.map((a) => (
                          <button
                            key={a.id}
                            type="button"
                            onClick={() => {
                              setFormData({ ...formData, account_id: a.id });
                              setAccountSearch(a.name);
                            }}
                            className="w-full text-left px-3 py-2 text-sm hover:bg-bg text-text-primary"
                          >
                            {a.name}
                          </button>
                        ))
                      )}
                    </div>
                  )}
                  {formData.account_id && (
                    <p className="mt-1 text-xs text-text-secondary">
                      Selected:{" "}
                      <span className="font-medium text-text-primary">
                        {accounts.find((a) => a.id === formData.account_id)?.name}
                      </span>{" "}
                      <button
                        type="button"
                        onClick={() => { setFormData({ ...formData, account_id: "" }); setAccountSearch(""); }}
                        className="text-red-500 hover:underline ml-1"
                      >
                        Clear
                      </button>
                    </p>
                  )}
                </div>
                <Button onClick={handleAddProgram} loading={submitting} variant="primary" size="md">
                  Create Program
                </Button>
              </div>
            </Card>
          )}

          {loading ? (
            <div className="text-center py-12 text-text-secondary">Loading programs...</div>
          ) : programs.length === 0 ? (
            <Card padding="md">
              <p className="text-center text-text-secondary">No programs found.</p>
            </Card>
          ) : (
            <Card padding="sm">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-3 px-4 font-medium text-text-secondary">Name</th>
                      <th className="text-left py-3 px-4 font-medium text-text-secondary">Account</th>
                      <th className="text-left py-3 px-4 font-medium text-text-secondary">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {programs.map((program) => (
                      <tr key={program.id} className="border-b border-border hover:bg-bg">
                        {editingId === program.id ? (
                          <>
                            <td className="py-3 px-4">
                              <Input
                                value={editData.name}
                                onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                              />
                            </td>
                            <td className="py-3 px-4">
                              <div className="relative">
                                <input
                                  value={editAccountSearch}
                                  onChange={(e) => {
                                    setEditAccountSearch(e.target.value);
                                    setEditData({ ...editData, account_id: "" });
                                    setEditAccountSelected(false);
                                  }}
                                  placeholder="Search account…"
                                  className="w-full rounded border border-border bg-surface text-text-primary px-2 py-1 text-sm"
                                />
                                {editAccountSearch && !editAccountSelected && (
                                  <div className="absolute z-10 mt-0.5 w-full border border-border rounded bg-surface shadow-md max-h-36 overflow-y-auto">
                                    {accounts
                                      .filter((a) => a.name.toLowerCase().includes(editAccountSearch.toLowerCase()))
                                      .map((a) => (
                                        <button
                                          key={a.id}
                                          type="button"
                                          onClick={() => {
                                            setEditData({ ...editData, account_id: a.id });
                                            setEditAccountSearch(a.name);
                                            setEditAccountSelected(true);
                                          }}
                                          className="w-full text-left px-2 py-1.5 text-sm hover:bg-bg text-text-primary"
                                        >
                                          {a.name}
                                        </button>
                                      ))}
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setEditData({ ...editData, account_id: "" });
                                        setEditAccountSearch("");
                                        setEditAccountSelected(false);
                                      }}
                                      className="w-full text-left px-2 py-1.5 text-xs text-red-500 hover:bg-bg"
                                    >
                                      Clear account
                                    </button>
                                  </div>
                                )}
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleSaveEdit(program.id)}
                                  disabled={submitting}
                                  className="text-sm text-green-600 hover:underline font-medium"
                                >
                                  Save
                                </button>
                                <button
                                  onClick={() => setEditingId(null)}
                                  className="text-sm text-text-secondary hover:underline"
                                >
                                  Cancel
                                </button>
                              </div>
                            </td>
                          </>
                        ) : deletingId === program.id ? (
                          <>
                            <td colSpan={3} className="py-4 px-4">
                              <div className="rounded-lg border border-red-200 bg-red-50 p-3 space-y-2">
                                <p className="text-sm font-semibold text-red-700">
                                  Delete &ldquo;{program.name}&rdquo;?
                                </p>
                                <p className="text-xs text-red-600">
                                  ⚠️ All BDM / Account / Program assignments linked to this program will also be
                                  permanently deleted. This action cannot be undone.
                                </p>
                                <div className="flex gap-2 pt-1">
                                  <button
                                    onClick={() => handleDelete(program.id)}
                                    disabled={submitting}
                                    className="text-sm text-white bg-red-600 hover:bg-red-700 px-3 py-1 rounded font-medium disabled:opacity-50"
                                  >
                                    {submitting ? "Deleting…" : "Confirm Delete"}
                                  </button>
                                  <button
                                    onClick={() => setDeletingId(null)}
                                    className="text-sm text-text-secondary hover:underline px-2"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="py-3 px-4 font-medium">{program.name}</td>
                            <td className="py-3 px-4 text-text-secondary">{program.account_name ?? "—"}</td>
                            <td className="py-3 px-4">
                              <div className="flex gap-2">
                                <button
                                  onClick={() => startEdit(program)}
                                  className="text-sm text-brand hover:underline font-medium"
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={() => setDeletingId(program.id)}
                                  className="text-sm text-red-500 hover:underline font-medium"
                                >
                                  Delete
                                </button>
                              </div>
                            </td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </>
      )}

      {/* ── ASSIGNMENTS TAB ────────────────────────────────────────────── */}
      {activeTab === "assignments" && (
        <>
          {/* Info banner — read-only notice for admin */}
          {isAdmin && (
            <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-lg border border-blue-200 bg-blue-50 text-sm text-blue-800">
              <span>Read-only view. To create, edit or delete assignments use the Assignments page.</span>
              <Link
                href="/dashboard/admin/assignments"
                className="whitespace-nowrap font-medium text-blue-600 hover:underline"
              >
                Go to Assignments →
              </Link>
            </div>
          )}

          {assignmentsLoading ? (
            <div className="text-center py-12 text-text-secondary">Loading assignments…</div>
          ) : assignments.length === 0 ? (
            <Card padding="md">
              <p className="text-center text-text-secondary">No assignments found.</p>
              {isAdmin && (
                <div className="text-center mt-2">
                  <Link
                    href="/dashboard/admin/assignments"
                    className="text-sm text-brand hover:underline"
                  >
                    Create assignments →
                  </Link>
                </div>
              )}
            </Card>
          ) : (
            <Card padding="sm">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      {isAdmin && (
                        <th className="text-left py-3 px-4 font-medium text-text-secondary">BDM</th>
                      )}
                      <th className="text-left py-3 px-4 font-medium text-text-secondary">Account</th>
                      <th className="text-left py-3 px-4 font-medium text-text-secondary">Program</th>
                      <th className="text-left py-3 px-4 font-medium text-text-secondary">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {assignments.map((a) => (
                      <tr key={a.id} className="border-b border-border hover:bg-bg">
                        {isAdmin && (
                          <td className="py-3 px-4 text-text-primary">{getBdmName(a.user_id)}</td>
                        )}
                        <td className="py-3 px-4 font-medium">{a.account_name ?? "—"}</td>
                        <td className="py-3 px-4 text-text-secondary">{a.program_name ?? "—"}</td>
                        <td className="py-3 px-4">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                              a.is_active
                                ? "bg-green-100 text-green-800"
                                : "bg-gray-100 text-gray-600"
                            }`}
                          >
                            {a.is_active ? "Active" : "Inactive"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </>
      )}

      <ToastComponent />
    </div>
  );
}

export default function ProgramsPage() {
  return (
    <RoleGuard allowedRoles={["admin", "bdm"]} fallback={<p className="text-red-600">Access denied</p>}>
      <ProgramsContent />
    </RoleGuard>
  );
}
