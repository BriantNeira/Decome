"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useToast } from "@/components/ui/Toast";
import { RoleGuard } from "@/components/layout/RoleGuard";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import api, { parseApiError } from "@/lib/api";
import { Contact, Account, Program } from "@/types/masterdata";

const TITLE_OPTIONS = ["Mr", "Mrs", "Miss", "Ms", "Dr"];

interface ContactsListResponse {
  items: Contact[];
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

function ContactsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showToast, ToastComponent } = useToast();

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [total, setTotal] = useState(0);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter
  const [filterAccountId, setFilterAccountId] = useState(searchParams.get("account_id") || "");

  // Add form — pre-fill from URL params (?account_id=...&add=true)
  const [showAdd, setShowAdd] = useState(searchParams.get("add") === "true");
  const [formData, setFormData] = useState({
    account_id: searchParams.get("account_id") || "",
    title: "",
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    is_decision_maker: false,
    program_ids: [] as string[],
  });
  const [submitting, setSubmitting] = useState(false);

  // Inline edit
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState({
    title: "",
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    is_decision_maker: false,
    program_ids: [] as string[],
  });
  const [saving, setSaving] = useState(false);

  // Inline delete confirm
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    loadAccounts();
    loadPrograms();
  }, []);

  useEffect(() => {
    loadContacts();
  }, [filterAccountId]);

  async function loadAccounts() {
    try {
      const res = await api.get<AccountsListResponse>("/accounts?limit=500");
      setAccounts(res.data.items.filter((a) => a.is_active));
    } catch {
      // non-critical
    }
  }

  async function loadPrograms() {
    try {
      const res = await api.get<ProgramsListResponse>("/programs?limit=500");
      setPrograms(res.data.items.filter((p) => p.is_active));
    } catch {
      // non-critical
    }
  }

  async function loadContacts() {
    try {
      setLoading(true);
      const params = filterAccountId ? `?account_id=${filterAccountId}` : "";
      const res = await api.get<ContactsListResponse>(`/contacts${params}`);
      setContacts(res.data.items);
      setTotal(res.data.total);
    } catch (err: any) {
      showToast(parseApiError(err, "Failed to load contacts"), "error");
    } finally {
      setLoading(false);
    }
  }

  async function handleAddContact() {
    if (!formData.account_id) {
      showToast("Account is required", "error");
      return;
    }
    setSubmitting(true);
    try {
      await api.post("/contacts", {
        account_id: formData.account_id,
        title: formData.title || null,
        first_name: formData.first_name || null,
        last_name: formData.last_name || null,
        email: formData.email || null,
        phone: formData.phone || null,
        is_decision_maker: formData.is_decision_maker,
        program_ids: formData.program_ids,
      });
      showToast("Contact created", "success");
      setFormData({
        account_id: "",
        title: "",
        first_name: "",
        last_name: "",
        email: "",
        phone: "",
        is_decision_maker: false,
        program_ids: [],
      });
      setShowAdd(false);
      await loadContacts();
    } catch (err: any) {
      showToast(parseApiError(err, "Failed to create contact"), "error");
    } finally {
      setSubmitting(false);
    }
  }

  function startEdit(contact: Contact) {
    setEditingId(contact.id);
    setEditData({
      title: contact.title ?? "",
      first_name: contact.first_name ?? "",
      last_name: contact.last_name ?? "",
      email: contact.email ?? "",
      phone: contact.phone ?? "",
      is_decision_maker: contact.is_decision_maker,
      program_ids: contact.program_ids ?? [],
    });
    setConfirmDeleteId(null);
  }

  async function handleSaveEdit(id: string) {
    setSaving(true);
    try {
      await api.patch(`/contacts/${id}`, {
        title: editData.title || null,
        first_name: editData.first_name || null,
        last_name: editData.last_name || null,
        email: editData.email || null,
        phone: editData.phone || null,
        is_decision_maker: editData.is_decision_maker,
        program_ids: editData.program_ids,
      });
      showToast("Contact updated", "success");
      setEditingId(null);
      await loadContacts();
    } catch (err: any) {
      showToast(parseApiError(err, "Failed to update contact"), "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      await api.delete(`/contacts/${id}`);
      showToast("Contact deleted", "success");
      setConfirmDeleteId(null);
      await loadContacts();
    } catch (err: any) {
      showToast(parseApiError(err, "Failed to delete contact"), "error");
    } finally {
      setDeletingId(null);
    }
  }

  function toggleProgramId(list: string[], id: string): string[] {
    return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
  }

  function formatName(c: Contact): string {
    const parts = [c.title, c.first_name, c.last_name].filter(Boolean);
    return parts.join(" ") || "—";
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary">Contacts</h1>
          <p className="text-sm text-text-secondary mt-0.5">Total: {total}</p>
        </div>
        <Button onClick={() => { setShowAdd(!showAdd); setEditingId(null); }} variant="primary">
          {showAdd ? "Cancel" : "+ Add Contact"}
        </Button>
      </div>

      {/* Add Contact form */}
      {showAdd && (
        <Card padding="md">
          <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wide mb-4">New Contact</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1">Account *</label>
              <select
                value={formData.account_id}
                onChange={(e) => setFormData({ ...formData, account_id: e.target.value })}
                className="w-full rounded border border-border bg-surface text-text-primary px-3 py-2 text-sm"
              >
                <option value="">— Select Account —</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-text-primary mb-1">Title</label>
                <select
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full rounded border border-border bg-surface text-text-primary px-3 py-2 text-sm"
                >
                  <option value="">—</option>
                  {TITLE_OPTIONS.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <Input
                label="First Name"
                value={formData.first_name}
                onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                placeholder="First name"
              />
              <Input
                label="Last Name"
                value={formData.last_name}
                onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                placeholder="Last name"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="email@example.com"
              />
              <Input
                label="Phone"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="+1 555 123 4567"
              />
            </div>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={formData.is_decision_maker}
                onChange={(e) => setFormData({ ...formData, is_decision_maker: e.target.checked })}
                className="rounded"
              />
              Decision Maker
            </label>
            {/* Programs multi-select */}
            {programs.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-text-primary mb-1">Programs</label>
                <div className="flex flex-wrap gap-2">
                  {programs.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setFormData({ ...formData, program_ids: toggleProgramId(formData.program_ids, p.id) })}
                      className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                        formData.program_ids.includes(p.id)
                          ? "bg-sidebar-active text-white border-sidebar-active"
                          : "bg-surface text-text-secondary border-border hover:border-text-secondary"
                      }`}
                    >
                      {p.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <Button onClick={handleAddContact} loading={submitting} variant="primary" size="md">
              Create Contact
            </Button>
          </div>
        </Card>
      )}

      {/* Filter */}
      <div className="flex items-center gap-3">
        <label className="text-sm text-text-secondary font-medium shrink-0">Filter by account:</label>
        <select
          value={filterAccountId}
          onChange={(e) => setFilterAccountId(e.target.value)}
          className="rounded border border-border bg-surface text-text-primary px-3 py-1.5 text-sm"
        >
          <option value="">All accounts</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>
        {filterAccountId && (
          <button
            onClick={() => setFilterAccountId("")}
            className="text-xs text-text-secondary hover:text-text-primary"
          >
            Clear
          </button>
        )}
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-center py-12 text-text-secondary">Loading contacts...</div>
      ) : contacts.length === 0 ? (
        <Card padding="md">
          <p className="text-center text-text-secondary">
            {filterAccountId ? "No contacts for this account." : "No contacts yet. Create one to get started."}
          </p>
        </Card>
      ) : (
        <Card padding="sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-4 font-medium text-text-secondary">Account</th>
                  <th className="text-left py-3 px-4 font-medium text-text-secondary">Name</th>
                  <th className="text-left py-3 px-4 font-medium text-text-secondary">Email</th>
                  <th className="text-left py-3 px-4 font-medium text-text-secondary">Phone</th>
                  <th className="text-left py-3 px-4 font-medium text-text-secondary">DM</th>
                  <th className="text-left py-3 px-4 font-medium text-text-secondary">Programs</th>
                  <th className="text-left py-3 px-4 font-medium text-text-secondary"></th>
                </tr>
              </thead>
              <tbody>
                {contacts.map((contact) => {
                  const isEditing = editingId === contact.id;
                  const isConfirmingDelete = confirmDeleteId === contact.id;

                  return (
                    <tr key={contact.id} className="border-b border-border hover:bg-bg">
                      {isEditing ? (
                        <>
                          <td className="py-3 px-4 font-medium text-text-primary">
                            {contact.account_name || "—"}
                          </td>
                          <td className="py-2 px-4">
                            <div className="flex gap-1">
                              <select
                                value={editData.title}
                                onChange={(e) => setEditData({ ...editData, title: e.target.value })}
                                className="w-16 rounded border border-border bg-surface text-text-primary px-1 py-1 text-xs"
                              >
                                <option value="">—</option>
                                {TITLE_OPTIONS.map((t) => (
                                  <option key={t} value={t}>{t}</option>
                                ))}
                              </select>
                              <input
                                type="text"
                                value={editData.first_name}
                                onChange={(e) => setEditData({ ...editData, first_name: e.target.value })}
                                className="w-24 rounded border border-border bg-surface text-text-primary px-2 py-1 text-sm"
                                placeholder="First"
                              />
                              <input
                                type="text"
                                value={editData.last_name}
                                onChange={(e) => setEditData({ ...editData, last_name: e.target.value })}
                                className="w-24 rounded border border-border bg-surface text-text-primary px-2 py-1 text-sm"
                                placeholder="Last"
                              />
                            </div>
                          </td>
                          <td className="py-2 px-4">
                            <input
                              type="email"
                              value={editData.email}
                              onChange={(e) => setEditData({ ...editData, email: e.target.value })}
                              className="w-full rounded border border-border bg-surface text-text-primary px-2 py-1 text-sm"
                              placeholder="email"
                            />
                          </td>
                          <td className="py-2 px-4">
                            <input
                              type="text"
                              value={editData.phone}
                              onChange={(e) => setEditData({ ...editData, phone: e.target.value })}
                              className="w-full rounded border border-border bg-surface text-text-primary px-2 py-1 text-sm"
                              placeholder="phone"
                            />
                          </td>
                          <td className="py-2 px-4">
                            <input
                              type="checkbox"
                              checked={editData.is_decision_maker}
                              onChange={(e) => setEditData({ ...editData, is_decision_maker: e.target.checked })}
                              className="rounded"
                            />
                          </td>
                          <td className="py-2 px-4">
                            <div className="flex flex-wrap gap-1">
                              {programs.map((p) => (
                                <button
                                  key={p.id}
                                  type="button"
                                  onClick={() => setEditData({ ...editData, program_ids: toggleProgramId(editData.program_ids, p.id) })}
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-medium border transition-colors ${
                                    editData.program_ids.includes(p.id)
                                      ? "bg-sidebar-active text-white border-sidebar-active"
                                      : "bg-surface text-text-secondary border-border"
                                  }`}
                                >
                                  {p.name}
                                </button>
                              ))}
                            </div>
                          </td>
                          <td className="py-2 px-4 text-right">
                            <div className="flex gap-2 justify-end">
                              <button
                                onClick={() => handleSaveEdit(contact.id)}
                                disabled={saving}
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
                      ) : isConfirmingDelete ? (
                        <>
                          <td colSpan={6} className="py-3 px-4 text-sm text-red-600 font-medium">
                            Delete contact <span className="font-semibold">{formatName(contact)}</span>? This cannot be undone.
                          </td>
                          <td className="py-2 px-4 text-right">
                            <div className="flex gap-2 justify-end">
                              <button
                                onClick={() => handleDelete(contact.id)}
                                disabled={deletingId === contact.id}
                                className="text-xs font-medium text-red-600 hover:underline disabled:opacity-50"
                              >
                                {deletingId === contact.id ? "Deleting..." : "Confirm"}
                              </button>
                              <button
                                onClick={() => setConfirmDeleteId(null)}
                                className="text-xs text-text-secondary hover:text-text-primary"
                              >
                                Cancel
                              </button>
                            </div>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="py-3 px-4 font-medium text-text-primary">
                            {contact.account_name || "—"}
                          </td>
                          <td className="py-3 px-4 text-text-primary">
                            <button
                              onClick={() => router.push(`/dashboard/admin/contacts/${contact.id}`)}
                              className="text-brand hover:underline font-medium"
                            >
                              {formatName(contact)}
                            </button>
                          </td>
                          <td className="py-3 px-4 text-text-secondary text-xs">
                            {contact.email || "—"}
                          </td>
                          <td className="py-3 px-4 text-text-secondary text-xs">
                            {contact.phone || "—"}
                          </td>
                          <td className="py-3 px-4">
                            {contact.is_decision_maker && (
                              <span className="inline-block px-2 py-0.5 rounded text-[10px] font-medium bg-blue-100 text-blue-800">
                                DM
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex flex-wrap gap-1">
                              {(contact.program_names ?? []).map((name, i) => (
                                <span key={i} className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 text-gray-700 border border-gray-200">
                                  {name}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex gap-3 justify-end">
                              <button
                                onClick={() => startEdit(contact)}
                                className="text-sm text-brand hover:underline font-medium"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => { setConfirmDeleteId(contact.id); setEditingId(null); }}
                                className="text-sm text-red-500 hover:underline font-medium"
                              >
                                Delete
                              </button>
                            </div>
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

export default function ContactsPage() {
  return (
    <RoleGuard allowedRoles={["admin", "bdm"]} fallback={<p className="text-red-600">Access denied</p>}>
      <ContactsContent />
    </RoleGuard>
  );
}
