"use client";

import { useEffect, useState } from "react";
import { useToast } from "@/components/ui/Toast";
import { RoleGuard } from "@/components/layout/RoleGuard";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import api, { parseApiError } from "@/lib/api";
import { CustomFieldDefinition } from "@/types/masterdata";

interface CustomFieldsListResponse {
  items: CustomFieldDefinition[];
  total: number;
}

const FIELD_TYPES: CustomFieldDefinition["field_type"][] = [
  "text", "number", "date", "boolean", "dropdown",
];

const ENTITY_TYPES: CustomFieldDefinition["entity_type"][] = [
  "account", "assignment", "contact",
];

const FIELD_TYPE_LABELS: Record<string, string> = {
  text: "Text",
  number: "Number",
  date: "Date",
  boolean: "Yes/No",
  dropdown: "Dropdown",
};

const ENTITY_TYPE_LABELS: Record<string, string> = {
  account: "Account",
  assignment: "Assignment",
  contact: "Contact",
};

function CustomFieldsContent() {
  const [fields, setFields] = useState<CustomFieldDefinition[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [formData, setFormData] = useState({
    field_name: "",
    field_type: "text" as CustomFieldDefinition["field_type"],
    entity_type: "account" as CustomFieldDefinition["entity_type"],
    is_required: false,
    sort_order: 0,
    choices: "", // comma-separated, only for dropdown
  });
  const [submitting, setSubmitting] = useState(false);
  const { showToast, ToastComponent } = useToast();

  useEffect(() => {
    loadFields();
  }, []);

  async function loadFields() {
    try {
      setLoading(true);
      const res = await api.get<CustomFieldsListResponse>("/custom-fields/definitions");
      setFields(res.data.items);
      setTotal(res.data.total);
    } catch (err: any) {
      showToast(parseApiError(err, "Failed to load custom fields"), "error");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate() {
    if (!formData.field_name.trim()) {
      showToast("Field name is required", "error");
      return;
    }
    if (formData.field_type === "dropdown" && !formData.choices.trim()) {
      showToast("Dropdown choices are required", "error");
      return;
    }

    const payload: any = {
      field_name: formData.field_name.trim(),
      field_type: formData.field_type,
      entity_type: formData.entity_type,
      is_required: formData.is_required,
      sort_order: formData.sort_order,
    };

    if (formData.field_type === "dropdown") {
      payload.options = {
        choices: formData.choices.split(",").map((s) => s.trim()).filter(Boolean),
      };
    }

    setSubmitting(true);
    try {
      await api.post("/custom-fields/definitions", payload);
      showToast("Custom field created", "success");
      setFormData({
        field_name: "",
        field_type: "text",
        entity_type: "account",
        is_required: false,
        sort_order: 0,
        choices: "",
      });
      setShowAdd(false);
      await loadFields();
    } catch (err: any) {
      showToast(parseApiError(err, "Failed to create custom field"), "error");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggleActive(field: CustomFieldDefinition) {
    try {
      await api.patch(`/custom-fields/definitions/${field.id}`, { is_active: !field.is_active });
      showToast(`Field ${field.is_active ? "deactivated" : "activated"}`, "success");
      await loadFields();
    } catch (err: any) {
      showToast(parseApiError(err, "Failed to update field"), "error");
    }
  }

  async function handleDelete(fieldId: number) {
    setDeleting(true);
    try {
      await api.delete(`/custom-fields/definitions/${fieldId}`);
      showToast("Custom field deleted", "success");
      setDeleteConfirmId(null);
      await loadFields();
    } catch (err: any) {
      showToast(parseApiError(err, "Failed to delete field"), "error");
    } finally {
      setDeleting(false);
    }
  }

  const selectClass =
    "w-full rounded border border-border bg-surface text-text-primary px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sidebar-active";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-semibold text-text-primary">Custom Fields</h1>
          <span className="text-sm text-text-secondary">Total: {total}</span>
        </div>
        <Button onClick={() => setShowAdd(!showAdd)} variant="primary">
          {showAdd ? "Cancel" : "+ Add Field"}
        </Button>
      </div>

      {showAdd && (
        <Card padding="md">
          <div className="space-y-4">
            <Input
              label="Field Name *"
              value={formData.field_name}
              onChange={(e) => setFormData({ ...formData, field_name: e.target.value })}
              placeholder="e.g. Customer Tier"
            />

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-text-primary mb-1">
                  Field Type *
                </label>
                <select
                  value={formData.field_type}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      field_type: e.target.value as CustomFieldDefinition["field_type"],
                    })
                  }
                  className={selectClass}
                >
                  {FIELD_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {FIELD_TYPE_LABELS[t]}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-text-primary mb-1">
                  Entity Type *
                </label>
                <select
                  value={formData.entity_type}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      entity_type: e.target.value as CustomFieldDefinition["entity_type"],
                    })
                  }
                  className={selectClass}
                >
                  {ENTITY_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {ENTITY_TYPE_LABELS[t]}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {formData.field_type === "dropdown" && (
              <Input
                label="Choices (comma-separated) *"
                value={formData.choices}
                onChange={(e) => setFormData({ ...formData, choices: e.target.value })}
                placeholder="e.g. Gold, Silver, Bronze"
              />
            )}

            <div className="flex items-center gap-6">
              <label className="flex items-center gap-2 text-sm text-text-primary cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.is_required}
                  onChange={(e) => setFormData({ ...formData, is_required: e.target.checked })}
                  className="rounded"
                />
                Required field
              </label>

              <div className="flex items-center gap-2">
                <label className="text-sm text-text-primary">Sort order</label>
                <input
                  type="number"
                  value={formData.sort_order}
                  onChange={(e) =>
                    setFormData({ ...formData, sort_order: parseInt(e.target.value) || 0 })
                  }
                  className="w-20 rounded border border-border bg-surface text-text-primary px-2 py-1 text-sm"
                  min={0}
                />
              </div>
            </div>

            <Button onClick={handleCreate} loading={submitting} variant="primary" size="md">
              Create Field
            </Button>
          </div>
        </Card>
      )}

      {loading ? (
        <div className="text-center py-12 text-text-secondary">Loading custom fields…</div>
      ) : fields.length === 0 ? (
        <Card padding="md">
          <p className="text-center text-text-secondary">No custom fields defined yet.</p>
        </Card>
      ) : (
        <Card padding="sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-4 font-medium text-text-secondary">Field Name</th>
                  <th className="text-left py-3 px-4 font-medium text-text-secondary">Type</th>
                  <th className="text-left py-3 px-4 font-medium text-text-secondary">Entity</th>
                  <th className="text-left py-3 px-4 font-medium text-text-secondary">Required</th>
                  <th className="text-left py-3 px-4 font-medium text-text-secondary">Sort</th>
                  <th className="text-left py-3 px-4 font-medium text-text-secondary">Status</th>
                  <th className="py-3 px-4" />
                </tr>
              </thead>
              <tbody>
                {fields.map((f) =>
                  deleteConfirmId === f.id ? (
                    <tr key={f.id} className="border-b border-border bg-red-50">
                      <td className="py-3 px-4 font-medium">{f.field_name}</td>
                      <td colSpan={5} className="py-3 px-4">
                        <p className="text-xs text-red-600 font-medium">
                          ⚠️ Delete this field? All data stored across all entities will be permanently lost. This cannot be undone.
                        </p>
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => handleDelete(f.id)}
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
                  <tr key={f.id} className="border-b border-border hover:bg-bg">
                    <td className="py-3 px-4 font-medium">{f.field_name}</td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded bg-surface-secondary text-text-secondary text-xs font-mono">
                        {FIELD_TYPE_LABELS[f.field_type] ?? f.field_type}
                      </span>
                    </td>
                    <td className="py-3 px-4 capitalize text-text-secondary">{f.entity_type}</td>
                    <td className="py-3 px-4 text-center">
                      {f.is_required ? (
                        <span className="text-red-500 font-semibold">✓</span>
                      ) : (
                        <span className="text-text-secondary">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-text-secondary">{f.sort_order}</td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                          f.is_active ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {f.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex justify-end gap-3">
                        <button
                          onClick={() => handleToggleActive(f)}
                          className="text-xs text-text-secondary hover:text-text-primary underline"
                        >
                          {f.is_active ? "Deactivate" : "Activate"}
                        </button>
                        <button
                          onClick={() => setDeleteConfirmId(f.id)}
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

export default function CustomFieldsPage() {
  return (
    <RoleGuard allowedRoles={["admin"]} fallback={<p className="text-red-600">Access denied</p>}>
      <CustomFieldsContent />
    </RoleGuard>
  );
}
