"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/Toast";
import { RoleGuard } from "@/components/layout/RoleGuard";
import { Card } from "@/components/ui/Card";
import api, { parseApiError } from "@/lib/api";
import { Assignment, CustomFieldDefinition, CustomFieldValue } from "@/types/masterdata";

interface AssignmentsListResponse {
  items: Assignment[];
  total: number;
}

interface CFDefinitionsResponse {
  items: CustomFieldDefinition[];
  total: number;
}

interface CFValuesResponse {
  values: CustomFieldValue[];
}

function MyAssignmentsContent() {
  const router = useRouter();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);

  // Custom fields state
  const [cfDefinitions, setCfDefinitions] = useState<CustomFieldDefinition[]>([]);
  const [cfValuesByAssignment, setCfValuesByAssignment] = useState<Record<string, CustomFieldValue[]>>({});

  const { showToast, ToastComponent } = useToast();

  useEffect(() => {
    loadAssignments();
  }, []);

  async function loadAssignments() {
    try {
      setLoading(true);
      const res = await api.get<AssignmentsListResponse>("/assignments/my");
      const items = res.data.items;
      setAssignments(items);
      await loadCustomFields(items);
    } catch (err: any) {
      showToast(parseApiError(err, "Failed to load assignments"), "error");
    } finally {
      setLoading(false);
    }
  }

  async function loadCustomFields(items: Assignment[]) {
    try {
      const defRes = await api.get<CFDefinitionsResponse>(
        "/custom-fields/definitions?entity_type=assignment"
      );
      const defs = defRes.data.items.filter((d) => d.is_active);
      setCfDefinitions(defs);

      if (defs.length === 0 || items.length === 0) return;

      const valueResults = await Promise.all(
        items.map((a) =>
          api
            .get<CFValuesResponse>(`/custom-fields/values/assignment/${a.id}`)
            .then((r) => ({ id: a.id, values: r.data.values }))
            .catch(() => ({ id: a.id, values: [] }))
        )
      );

      const map: Record<string, CustomFieldValue[]> = {};
      for (const r of valueResults) {
        map[r.id] = r.values;
      }
      setCfValuesByAssignment(map);
    } catch {
      // Non-critical
    }
  }

  function getFieldValue(assignmentId: string, definitionId: number): string | null {
    const values = cfValuesByAssignment[assignmentId] ?? [];
    return values.find((v) => v.definition_id === definitionId)?.value ?? null;
  }

  function formatFieldValue(def: CustomFieldDefinition, raw: string | null): string {
    if (raw === null || raw === "") return "—";
    if (def.field_type === "boolean") return raw === "true" ? "Yes" : "No";
    return raw;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-text-primary">My Assignments</h1>

      {loading ? (
        <div className="text-center py-12 text-text-secondary">Loading assignments...</div>
      ) : assignments.length === 0 ? (
        <Card padding="md">
          <p className="text-center text-text-secondary">You have no active assignments yet.</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {assignments.map((assignment) => (
            <Card key={assignment.id} padding="md">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div>
                  <p className="text-xs text-text-secondary uppercase">Account</p>
                  <p className="font-semibold text-text-primary">
                    {assignment.account_name ?? assignment.account_id.substring(0, 8) + "…"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-text-secondary uppercase">Program</p>
                  <p className="font-semibold text-text-primary">
                    {assignment.program_name ?? assignment.program_id.substring(0, 8) + "…"}
                  </p>
                </div>
                <div className="flex justify-end">
                  <button
                    onClick={() => router.push(`/dashboard/admin/contacts?account_id=${assignment.account_id}`)}
                    className="text-sm text-brand hover:underline font-medium"
                  >
                    View Account Contacts →
                  </button>
                </div>
              </div>

              {/* Custom Fields — read-only */}
              {cfDefinitions.length > 0 && (
                <div className="border-t border-border pt-4 mt-4">
                  <p className="text-xs font-medium text-text-secondary uppercase mb-2">Custom Fields</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-sm">
                    {cfDefinitions.map((def) => {
                      const raw = getFieldValue(assignment.id, def.id);
                      return (
                        <div key={def.id} className="flex gap-2">
                          <span className="text-text-secondary shrink-0">{def.field_name}:</span>
                          <span className="text-text-primary font-medium">
                            {formatFieldValue(def, raw)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      <ToastComponent />
    </div>
  );
}

export default function MyAssignmentsPage() {
  return (
    <RoleGuard allowedRoles={["bdm"]} fallback={<p className="text-red-600">Only BDMs can access this page</p>}>
      <MyAssignmentsContent />
    </RoleGuard>
  );
}
