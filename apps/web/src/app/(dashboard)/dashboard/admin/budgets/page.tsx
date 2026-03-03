"use client";

import { useEffect, useState } from "react";
import { RoleGuard } from "@/components/layout/RoleGuard";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import api, { parseApiError } from "@/lib/api";
import { BudgetUsageSummary } from "@/types/ai";

function BudgetsContent() {
  const { showToast, ToastComponent } = useToast();
  const [budgets, setBudgets] = useState<BudgetUsageSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editLimit, setEditLimit] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadBudgets(); }, []);

  async function loadBudgets() {
    try {
      const res = await api.get<BudgetUsageSummary[]>("/token-budgets");
      setBudgets(res.data);
    } catch (err: any) {
      showToast(parseApiError(err, "Failed to load budgets"), "error");
    } finally { setLoading(false); }
  }

  function startEdit(b: BudgetUsageSummary) {
    setEditingUserId(b.user_id);
    setEditLimit(String(b.monthly_limit));
  }

  async function handleSave(b: BudgetUsageSummary) {
    const limit = parseInt(editLimit) || 0;
    setSaving(true);
    try {
      await api.post("/token-budgets", { user_id: b.user_id, monthly_limit: limit });
      showToast("Budget updated", "success");
      setEditingUserId(null);
      await loadBudgets();
    } catch (err: any) {
      showToast(parseApiError(err, "Failed to update budget"), "error");
    } finally { setSaving(false); }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-text-primary">Token Budgets</h1>
        <p className="text-sm text-text-secondary mt-0.5">Manage monthly AI token limits per user. Set 0 for unlimited.</p>
      </div>

      <Card padding="none">
        {loading ? (
          <div className="text-center py-10 text-text-secondary text-sm">Loading...</div>
        ) : budgets.length === 0 ? (
          <div className="text-center py-10 text-text-secondary text-sm">No users found.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="px-4 py-3 text-xs font-semibold text-text-secondary uppercase tracking-wide">User</th>
                <th className="px-4 py-3 text-xs font-semibold text-text-secondary uppercase tracking-wide">Monthly Limit</th>
                <th className="px-4 py-3 text-xs font-semibold text-text-secondary uppercase tracking-wide">Used This Month</th>
                <th className="px-4 py-3 text-xs font-semibold text-text-secondary uppercase tracking-wide hidden md:table-cell">Remaining</th>
                <th className="px-4 py-3 text-xs font-semibold text-text-secondary uppercase tracking-wide hidden lg:table-cell">Progress</th>
              </tr>
            </thead>
            <tbody>
              {budgets.map((b) => {
                const pct = b.monthly_limit > 0
                  ? Math.min(100, Math.round((b.tokens_used_this_month / b.monthly_limit) * 100))
                  : 0;
                const barColor = pct >= 90 ? "bg-red-500" : pct >= 70 ? "bg-orange-400" : "bg-brand";

                return (
                  <tr key={b.user_id} className="border-b border-border last:border-0 hover:bg-surface-hover">
                    <td className="px-4 py-3">
                      <p className="font-medium text-text-primary">{b.user_name}</p>
                      <p className="text-xs text-text-secondary">{b.user_email}</p>
                    </td>
                    <td className="px-4 py-3">
                      {editingUserId === b.user_id ? (
                        <div className="flex items-center gap-2">
                          <input type="number" value={editLimit} onChange={(e) => setEditLimit(e.target.value)} className="w-24 rounded border border-border bg-surface text-text-primary px-2 py-1 text-sm" min={0} onKeyDown={(e) => e.key === "Enter" && handleSave(b)} autoFocus />
                          <Button size="sm" variant="primary" loading={saving} onClick={() => handleSave(b)}>Save</Button>
                          <Button size="sm" variant="ghost" onClick={() => setEditingUserId(null)}>&times;</Button>
                        </div>
                      ) : (
                        <button onClick={() => startEdit(b)} className="text-text-primary hover:text-brand hover:underline transition-colors" title="Click to edit">
                          {b.monthly_limit === 0 ? <span className="text-text-secondary italic">Unlimited</span> : b.monthly_limit.toLocaleString()}
                          <span className="ml-1 text-xs text-text-secondary">&#9998;</span>
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-3 text-text-primary">{b.tokens_used_this_month.toLocaleString()}</td>
                    <td className="px-4 py-3 text-text-secondary hidden md:table-cell">
                      {b.monthly_limit === 0 ? "—" : b.remaining !== null ? b.remaining.toLocaleString() : "—"}
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      {b.monthly_limit > 0 ? (
                        <div className="flex items-center gap-2">
                          <div className="w-32 h-2 bg-border rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-xs text-text-secondary">{pct}%</span>
                        </div>
                      ) : <span className="text-xs text-text-secondary">—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>
      <ToastComponent />
    </div>
  );
}

export default function BudgetsPage() {
  return (
    <RoleGuard allowedRoles={["admin"]} fallback={<p className="text-red-600">Access denied</p>}>
      <BudgetsContent />
    </RoleGuard>
  );
}
