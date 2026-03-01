"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useToast } from "@/components/ui/Toast";
import { RoleGuard } from "@/components/layout/RoleGuard";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import api, { parseApiError } from "@/lib/api";
import { Contact, Program } from "@/types/masterdata";

const TITLE_OPTIONS = ["Mr", "Mrs", "Miss", "Ms", "Dr"];

interface ProgramsListResponse {
  items: Program[];
  total: number;
}

function ContactDetailContent() {
  const params = useParams();
  const router = useRouter();
  const contactId = params.id as string;
  const { showToast, ToastComponent } = useToast();

  const [contact, setContact] = useState<Contact | null>(null);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);

  // Edit mode
  const [editing, setEditing] = useState(false);
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

  useEffect(() => {
    loadContact();
    loadPrograms();
  }, [contactId]);

  async function loadContact() {
    try {
      setLoading(true);
      const res = await api.get<Contact>(`/contacts/${contactId}`);
      setContact(res.data);
    } catch (err: any) {
      showToast(parseApiError(err, "Failed to load contact"), "error");
    } finally {
      setLoading(false);
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

  function startEdit() {
    if (!contact) return;
    setEditData({
      title: contact.title ?? "",
      first_name: contact.first_name ?? "",
      last_name: contact.last_name ?? "",
      email: contact.email ?? "",
      phone: contact.phone ?? "",
      is_decision_maker: contact.is_decision_maker,
      program_ids: contact.program_ids ?? [],
    });
    setEditing(true);
  }

  async function handleSave() {
    setSaving(true);
    try {
      await api.patch(`/contacts/${contactId}`, {
        title: editData.title || null,
        first_name: editData.first_name || null,
        last_name: editData.last_name || null,
        email: editData.email || null,
        phone: editData.phone || null,
        is_decision_maker: editData.is_decision_maker,
        program_ids: editData.program_ids,
      });
      showToast("Contact updated", "success");
      setEditing(false);
      await loadContact();
    } catch (err: any) {
      showToast(parseApiError(err, "Failed to update contact"), "error");
    } finally {
      setSaving(false);
    }
  }

  function toggleProgramId(list: string[], id: string): string[] {
    return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
  }

  function formatName(c: Contact): string {
    const parts = [c.title, c.first_name, c.last_name].filter(Boolean);
    return parts.join(" ") || "Unnamed Contact";
  }

  if (loading) {
    return <div className="text-center py-12 text-text-secondary">Loading contact...</div>;
  }

  if (!contact) {
    return (
      <div className="text-center py-12">
        <p className="text-text-secondary">Contact not found.</p>
        <Button
          onClick={() => router.push("/dashboard/admin/contacts")}
          variant="secondary"
          size="sm"
          className="mt-4"
        >
          Back to Contacts
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push("/dashboard/admin/contacts")}
            className="text-text-secondary hover:text-text-primary transition-colors text-sm"
          >
            &larr; Contacts
          </button>
          <div>
            <h1 className="text-2xl font-semibold text-text-primary">{formatName(contact)}</h1>
            <div className="flex items-center gap-3 mt-1">
              {contact.account_name && (
                <button
                  onClick={() => router.push(`/dashboard/admin/accounts`)}
                  className="text-sm text-brand hover:underline"
                >
                  {contact.account_name}
                </button>
              )}
              {contact.is_decision_maker && (
                <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                  Decision Maker
                </span>
              )}
            </div>
          </div>
        </div>
        {!editing && (
          <Button onClick={startEdit} variant="primary" size="sm">
            Edit Contact
          </Button>
        )}
      </div>

      {editing ? (
        /* Edit Form */
        <Card padding="md">
          <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wide mb-4">
            Edit Contact
          </h2>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-text-primary mb-1">Title</label>
                <select
                  value={editData.title}
                  onChange={(e) => setEditData({ ...editData, title: e.target.value })}
                  className="w-full rounded border border-border bg-surface text-text-primary px-3 py-2 text-sm"
                >
                  <option value="">--</option>
                  {TITLE_OPTIONS.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <Input
                label="First Name"
                value={editData.first_name}
                onChange={(e) => setEditData({ ...editData, first_name: e.target.value })}
                placeholder="First name"
              />
              <Input
                label="Last Name"
                value={editData.last_name}
                onChange={(e) => setEditData({ ...editData, last_name: e.target.value })}
                placeholder="Last name"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Email"
                type="email"
                value={editData.email}
                onChange={(e) => setEditData({ ...editData, email: e.target.value })}
                placeholder="email@example.com"
              />
              <Input
                label="Phone"
                value={editData.phone}
                onChange={(e) => setEditData({ ...editData, phone: e.target.value })}
                placeholder="+1 555 123 4567"
              />
            </div>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={editData.is_decision_maker}
                onChange={(e) => setEditData({ ...editData, is_decision_maker: e.target.checked })}
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
                      onClick={() =>
                        setEditData({
                          ...editData,
                          program_ids: toggleProgramId(editData.program_ids, p.id),
                        })
                      }
                      className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                        editData.program_ids.includes(p.id)
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
            <div className="flex gap-2 pt-2">
              <Button onClick={handleSave} loading={saving} variant="primary" size="sm">
                Save Changes
              </Button>
              <Button onClick={() => setEditing(false)} variant="secondary" size="sm">
                Cancel
              </Button>
            </div>
          </div>
        </Card>
      ) : (
        /* Read-only view */
        <div className="space-y-6">
          {/* Contact Details */}
          <Card padding="md">
            <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wide mb-4">
              Contact Information
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-y-4 gap-x-8">
              <div>
                <p className="text-xs font-medium text-text-secondary uppercase tracking-wide mb-1">
                  Title
                </p>
                <p className="text-sm text-text-primary">{contact.title || "---"}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-text-secondary uppercase tracking-wide mb-1">
                  Full Name
                </p>
                <p className="text-sm text-text-primary">
                  {[contact.first_name, contact.last_name].filter(Boolean).join(" ") || "---"}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-text-secondary uppercase tracking-wide mb-1">
                  Email
                </p>
                <p className="text-sm text-text-primary">
                  {contact.email ? (
                    <a
                      href={`mailto:${contact.email}`}
                      className="text-brand hover:underline"
                    >
                      {contact.email}
                    </a>
                  ) : (
                    "---"
                  )}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-text-secondary uppercase tracking-wide mb-1">
                  Phone
                </p>
                <p className="text-sm text-text-primary">{contact.phone || "---"}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-text-secondary uppercase tracking-wide mb-1">
                  Account
                </p>
                <p className="text-sm text-text-primary">
                  {contact.account_name || "---"}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-text-secondary uppercase tracking-wide mb-1">
                  Decision Maker
                </p>
                <p className="text-sm text-text-primary">
                  {contact.is_decision_maker ? (
                    <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                      Yes
                    </span>
                  ) : (
                    "No"
                  )}
                </p>
              </div>
            </div>
          </Card>

          {/* Programs */}
          <Card padding="md">
            <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wide mb-4">
              Associated Programs ({contact.program_names?.length ?? 0})
            </h2>
            {contact.program_names && contact.program_names.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {contact.program_names.map((name, i) => (
                  <span
                    key={i}
                    className="px-3 py-1.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700 border border-gray-200"
                  >
                    {name}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-text-secondary text-sm">No programs associated.</p>
            )}
          </Card>
        </div>
      )}

      <ToastComponent />
    </div>
  );
}

export default function ContactDetailPage() {
  return (
    <RoleGuard
      allowedRoles={["admin", "bdm"]}
      fallback={<p className="text-red-600">Access denied</p>}
    >
      <ContactDetailContent />
    </RoleGuard>
  );
}
