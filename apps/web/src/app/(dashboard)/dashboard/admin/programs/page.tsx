"use client";

import { useEffect, useState } from "react";
import { useToast } from "@/components/ui/Toast";
import { RoleGuard } from "@/components/layout/RoleGuard";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import api, { parseApiError } from "@/lib/api";
import { Program, Account } from "@/types/masterdata";

interface ProgramsListResponse {
  items: Program[];
  total: number;
}

interface AccountsListResponse {
  items: Account[];
  total: number;
}

function ProgramsContent() {
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

  const { showToast, ToastComponent } = useToast();

  useEffect(() => {
    loadPrograms();
    loadAccounts();
  }, []);

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
    } catch (err: any) {
      showToast(parseApiError(err, "Failed to delete program"), "error");
    } finally {
      setSubmitting(false);
    }
  }

  const filteredAccounts = accounts.filter((a) =>
    a.name.toLowerCase().includes(accountSearch.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-semibold text-text-primary">Programs</h1>
          <span className="text-sm text-text-secondary">Total: {total}</span>
        </div>
        <Button onClick={() => setShowAdd(!showAdd)} variant="primary">
          {showAdd ? "Cancel" : "+ Add Program"}
        </Button>
      </div>

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
                        <td className="py-3 px-4 font-medium text-red-600">Delete "{program.name}"?</td>
                        <td className="py-3 px-4 text-text-secondary">{program.account_name ?? "—"}</td>
                        <td className="py-3 px-4">
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleDelete(program.id)}
                              disabled={submitting}
                              className="text-sm text-red-600 hover:underline font-medium"
                            >
                              Confirm
                            </button>
                            <button
                              onClick={() => setDeletingId(null)}
                              className="text-sm text-text-secondary hover:underline"
                            >
                              Cancel
                            </button>
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

      <ToastComponent />
    </div>
  );
}

export default function ProgramsPage() {
  return (
    <RoleGuard allowedRoles={["admin"]} fallback={<p className="text-red-600">Access denied</p>}>
      <ProgramsContent />
    </RoleGuard>
  );
}
