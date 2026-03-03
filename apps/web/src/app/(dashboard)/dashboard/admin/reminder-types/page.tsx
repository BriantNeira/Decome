"use client";

import { useEffect, useState } from "react";
import { useToast } from "@/components/ui/Toast";
import { RoleGuard } from "@/components/layout/RoleGuard";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import api, { parseApiError } from "@/lib/api";
import { ReminderType } from "@/types/masterdata";

interface ReminderTypesListResponse {
  items: ReminderType[];
  total: number;
}

const PRESET_COLORS = [
  "#9AAE2F", "#3B82F6", "#EF4444", "#F59E0B",
  "#8B5CF6", "#EC4899", "#14B8A6", "#6B7280",
];

function ReminderTypesContent() {
  const [types, setTypes] = useState<ReminderType[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    color: "#9AAE2F",
  });
  const [submitting, setSubmitting] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);
  const { showToast, ToastComponent } = useToast();

  useEffect(() => {
    loadTypes();
  }, []);

  async function loadTypes() {
    try {
      setLoading(true);
      const res = await api.get<ReminderTypesListResponse>("/reminder-types");
      setTypes(res.data.items);
      setTotal(res.data.total);
    } catch (err: any) {
      showToast(parseApiError(err, "Failed to load reminder types"), "error");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate() {
    if (!formData.name.trim()) {
      showToast("Name is required", "error");
      return;
    }
    setSubmitting(true);
    try {
      await api.post("/reminder-types", formData);
      showToast("Reminder type created", "success");
      setFormData({ name: "", description: "", color: "#9AAE2F" });
      setShowAdd(false);
      await loadTypes();
    } catch (err: any) {
      showToast(parseApiError(err, "Failed to create reminder type"), "error");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: number) {
    setDeleting(true);
    try {
      await api.delete(`/reminder-types/${id}`);
      showToast("Reminder type deleted", "success");
      setDeleteConfirmId(null);
      await loadTypes();
    } catch (err: any) {
      showToast(parseApiError(err, "Failed to delete reminder type"), "error");
    } finally {
      setDeleting(false);
    }
  }

  async function handleToggleActive(rt: ReminderType) {
    try {
      await api.patch(`/reminder-types/${rt.id}`, { is_active: !rt.is_active });
      showToast(`Reminder type ${rt.is_active ? "deactivated" : "activated"}`, "success");
      await loadTypes();
    } catch (err: any) {
      showToast(parseApiError(err, "Failed to update reminder type"), "error");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-semibold text-text-primary">Reminder Types</h1>
          <span className="text-sm text-text-secondary">Total: {total}</span>
        </div>
        <Button onClick={() => setShowAdd(!showAdd)} variant="primary">
          {showAdd ? "Cancel" : "+ Add Reminder Type"}
        </Button>
      </div>

      {showAdd && (
        <Card padding="md">
          <div className="space-y-4">
            <Input
              label="Name *"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g. Follow-up Call"
            />
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full rounded border border-border bg-surface text-text-primary px-3 py-2 text-sm"
                rows={2}
                placeholder="Optional description"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">
                Color
              </label>
              <div className="flex items-center gap-3 flex-wrap">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setFormData({ ...formData, color: c })}
                    className="w-8 h-8 rounded-full border-2 transition-all"
                    style={{
                      backgroundColor: c,
                      borderColor: formData.color === c ? "#1a1a1a" : "transparent",
                      transform: formData.color === c ? "scale(1.2)" : "scale(1)",
                    }}
                    title={c}
                  />
                ))}
                <input
                  type="color"
                  value={formData.color}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                  className="w-8 h-8 rounded cursor-pointer border border-border"
                  title="Custom color"
                />
                <span className="text-xs text-text-secondary font-mono">{formData.color}</span>
              </div>
            </div>
            <Button onClick={handleCreate} loading={submitting} variant="primary" size="md">
              Create Reminder Type
            </Button>
          </div>
        </Card>
      )}

      {loading ? (
        <div className="text-center py-12 text-text-secondary">Loading reminder types…</div>
      ) : types.length === 0 ? (
        <Card padding="md">
          <p className="text-center text-text-secondary">No reminder types found.</p>
        </Card>
      ) : (
        <Card padding="sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-4 font-medium text-text-secondary">Color</th>
                  <th className="text-left py-3 px-4 font-medium text-text-secondary">Name</th>
                  <th className="text-left py-3 px-4 font-medium text-text-secondary">Description</th>
                  <th className="text-left py-3 px-4 font-medium text-text-secondary">Status</th>
                  <th className="py-3 px-4" />
                </tr>
              </thead>
              <tbody>
                {types.map((rt) =>
                  deleteConfirmId === rt.id ? (
                    <tr key={rt.id} className="border-b border-border bg-red-50">
                      <td className="py-3 px-4">
                        <span
                          className="inline-block w-5 h-5 rounded-full border border-border"
                          style={{ backgroundColor: rt.color ?? "#ccc" }}
                        />
                      </td>
                      <td className="py-3 px-4 font-medium text-red-700">{rt.name}</td>
                      <td colSpan={2} className="py-3 px-4">
                        <p className="text-xs text-red-600 font-medium">
                          ⚠️ Delete "{rt.name}"? This cannot be undone.
                        </p>
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => handleDelete(rt.id)}
                            disabled={deleting}
                            className="text-xs text-red-600 font-semibold hover:underline disabled:opacity-50"
                          >
                            {deleting ? "Deleting…" : "Confirm Delete"}
                          </button>
                          <button
                            onClick={() => setDeleteConfirmId(null)}
                            className="text-xs text-text-secondary hover:underline"
                          >
                            Cancel
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                  <tr key={rt.id} className="border-b border-border hover:bg-bg">
                    <td className="py-3 px-4">
                      <span
                        className="inline-block w-5 h-5 rounded-full border border-border"
                        style={{ backgroundColor: rt.color ?? "#ccc" }}
                      />
                    </td>
                    <td className="py-3 px-4 font-medium">{rt.name}</td>
                    <td className="py-3 px-4 text-text-secondary">{rt.description ?? "—"}</td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                          rt.is_active ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {rt.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex justify-end gap-3">
                        <button
                          onClick={() => handleToggleActive(rt)}
                          className="text-xs text-text-secondary hover:text-text-primary underline"
                        >
                          {rt.is_active ? "Deactivate" : "Activate"}
                        </button>
                        <button
                          onClick={() => setDeleteConfirmId(rt.id)}
                          className="text-xs text-red-500 hover:underline"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <ToastComponent />
    </div>
  );
}

export default function ReminderTypesPage() {
  return (
    <RoleGuard allowedRoles={["admin"]} fallback={<p className="text-red-600">Access denied</p>}>
      <ReminderTypesContent />
    </RoleGuard>
  );
}
