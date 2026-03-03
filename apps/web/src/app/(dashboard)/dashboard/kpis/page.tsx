"use client";

import { useEffect, useState, useCallback } from "react";
import { RoleGuard } from "@/components/layout/RoleGuard";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import api, { parseApiError } from "@/lib/api";
import type { KpiResponse, KpiDiagnosis } from "@/types/ai";
import type { Account } from "@/types/masterdata";

interface UserOption {
  id: string;
  full_name: string;
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function defaultFrom(): string {
  const d = new Date();
  d.setMonth(d.getMonth() - 3);
  return isoDate(d);
}

function KpisContent() {
  const { showToast, ToastComponent } = useToast();

  /* ── Filters ───────────────────────────────────────── */
  const [dateFrom, setDateFrom] = useState(defaultFrom);
  const [dateTo, setDateTo] = useState(() => isoDate(new Date()));
  const [accountId, setAccountId] = useState("");
  const [bdmId, setBdmId] = useState("");

  /* ── Filter options ────────────────────────────────── */
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [bdms, setBdms] = useState<UserOption[]>([]);

  /* ── KPI data ──────────────────────────────────────── */
  const [kpi, setKpi] = useState<KpiResponse | null>(null);
  const [loading, setLoading] = useState(true);

  /* ── AI Diagnosis ──────────────────────────────────── */
  const [diagnosisOpen, setDiagnosisOpen] = useState(false);
  const [diagnosis, setDiagnosis] = useState<KpiDiagnosis | null>(null);
  const [diagnosisLoading, setDiagnosisLoading] = useState(false);

  /* ── Load filter options on mount ──────────────────── */
  useEffect(() => {
    api.get<Account[]>("/accounts").then((r) => setAccounts(r.data)).catch(() => {});
    api.get<UserOption[]>("/users", { params: { role: "bdm" } }).then((r) => setBdms(r.data)).catch(() => {});
  }, []);

  /* ── Fetch KPIs ────────────────────────────────────── */
  const loadKpis = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { date_from: dateFrom, date_to: dateTo };
      if (accountId) params.account_id = accountId;
      if (bdmId) params.bdm_id = bdmId;
      const res = await api.get<KpiResponse>("/kpis", { params });
      setKpi(res.data);
    } catch (err: any) {
      showToast(parseApiError(err, "Failed to load KPIs"), "error");
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, accountId, bdmId, showToast]);

  useEffect(() => {
    loadKpis();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Export ─────────────────────────────────────────── */
  async function handleExport() {
    try {
      const res = await api.get("/kpis/export", {
        params: { date_from: dateFrom, date_to: dateTo },
        responseType: "blob",
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement("a");
      a.href = url;
      a.download = `kpis_${dateFrom}_${dateTo}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      showToast(parseApiError(err, "Export failed"), "error");
    }
  }

  /* ── AI Diagnosis ──────────────────────────────────── */
  async function handleDiagnosis() {
    setDiagnosisOpen(true);
    setDiagnosisLoading(true);
    setDiagnosis(null);
    try {
      const body: Record<string, string> = { date_from: dateFrom, date_to: dateTo };
      if (accountId) body.account_id = accountId;
      const res = await api.post<KpiDiagnosis>("/kpis/diagnosis", body);
      setDiagnosis(res.data);
    } catch (err: any) {
      showToast(parseApiError(err, "Diagnosis failed"), "error");
    } finally {
      setDiagnosisLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* ── Header ───────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-xl font-semibold text-text-primary">KPIs &amp; Analytics</h1>
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" onClick={handleExport}>
            Export Excel
          </Button>
          <Button size="sm" variant="primary" onClick={handleDiagnosis}>
            AI Diagnosis
          </Button>
        </div>
      </div>

      {/* ── Filters ──────────────────────────────────── */}
      <Card>
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Date From</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="rounded border border-border bg-surface text-text-primary px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Date To</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="rounded border border-border bg-surface text-text-primary px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Account</label>
            <select
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              className="rounded border border-border bg-surface text-text-primary px-3 py-2 text-sm min-w-[160px]"
            >
              <option value="">All accounts</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">BDM</label>
            <select
              value={bdmId}
              onChange={(e) => setBdmId(e.target.value)}
              className="rounded border border-border bg-surface text-text-primary px-3 py-2 text-sm min-w-[160px]"
            >
              <option value="">All BDMs</option>
              {bdms.map((u) => (
                <option key={u.id} value={u.id}>{u.full_name}</option>
              ))}
            </select>
          </div>
          <Button size="sm" variant="primary" onClick={loadKpis} loading={loading}>
            Apply
          </Button>
        </div>
      </Card>

      {/* ── Summary Cards ────────────────────────────── */}
      {loading ? (
        <div className="text-center py-10 text-text-secondary text-sm">Loading KPIs...</div>
      ) : kpi ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="border-l-4 border-l-green-500">
              <p className="text-sm font-medium text-text-secondary">On-Time Completions</p>
              <p className="text-3xl font-semibold text-green-600 mt-1">{kpi.completed_on_time}</p>
              <p className="text-xs text-green-500 mt-1">{kpi.completion_rate}% completion rate</p>
            </Card>
            <Card className="border-l-4 border-l-amber-500">
              <p className="text-sm font-medium text-text-secondary">Late Completions</p>
              <p className="text-3xl font-semibold text-amber-600 mt-1">{kpi.completed_late}</p>
            </Card>
            <Card className="border-l-4 border-l-red-500">
              <p className="text-sm font-medium text-text-secondary">Overdue Pending</p>
              <p className="text-3xl font-semibold text-red-600 mt-1">{kpi.overdue_pending}</p>
            </Card>
            <Card className="border-l-4 border-l-gray-400">
              <p className="text-sm font-medium text-text-secondary">Open Reminders</p>
              <p className="text-3xl font-semibold text-text-primary mt-1">{kpi.total_open}</p>
            </Card>
          </div>

          {/* ── By Reminder Type ─────────────────────── */}
          <Card padding="none">
            <div className="px-4 py-3 border-b border-border">
              <h2 className="font-medium text-text-primary">By Reminder Type</h2>
            </div>
            {kpi!.by_type.length === 0 ? (
              <div className="text-center py-8 text-text-secondary text-sm">No data</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="px-4 py-3 text-xs font-semibold text-text-secondary uppercase tracking-wide">Type</th>
                    <th className="px-4 py-3 text-xs font-semibold text-text-secondary uppercase tracking-wide">Total</th>
                    <th className="px-4 py-3 text-xs font-semibold text-text-secondary uppercase tracking-wide">Completed</th>
                    <th className="px-4 py-3 text-xs font-semibold text-text-secondary uppercase tracking-wide">Overdue</th>
                  </tr>
                </thead>
                <tbody>
                  {kpi!.by_type.map((t) => (
                    <tr key={t.type_id} className="border-b border-border last:border-0 hover:bg-surface-hover">
                      <td className="px-4 py-3 text-text-primary flex items-center gap-2">
                        <span
                          className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0"
                          style={{ backgroundColor: t.type_color || "#9ca3af" }}
                        />
                        {t.type_name}
                      </td>
                      <td className="px-4 py-3 text-text-primary">{t.total}</td>
                      <td className="px-4 py-3 text-text-primary">{t.completed}</td>
                      <td className="px-4 py-3 text-text-primary">{t.overdue}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>

          {/* ── By Account ───────────────────────────── */}
          <Card padding="none">
            <div className="px-4 py-3 border-b border-border">
              <h2 className="font-medium text-text-primary">By Account</h2>
            </div>
            {kpi!.by_account.length === 0 ? (
              <div className="text-center py-8 text-text-secondary text-sm">No data</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="px-4 py-3 text-xs font-semibold text-text-secondary uppercase tracking-wide">Account</th>
                    <th className="px-4 py-3 text-xs font-semibold text-text-secondary uppercase tracking-wide">Total</th>
                    <th className="px-4 py-3 text-xs font-semibold text-text-secondary uppercase tracking-wide">Completed</th>
                    <th className="px-4 py-3 text-xs font-semibold text-text-secondary uppercase tracking-wide">Overdue</th>
                    <th className="px-4 py-3 text-xs font-semibold text-text-secondary uppercase tracking-wide">On-Time %</th>
                  </tr>
                </thead>
                <tbody>
                  {kpi!.by_account.map((a) => (
                    <tr key={a.account_id} className="border-b border-border last:border-0 hover:bg-surface-hover">
                      <td className="px-4 py-3 font-medium text-text-primary">{a.account_name}</td>
                      <td className="px-4 py-3 text-text-primary">{a.total}</td>
                      <td className="px-4 py-3 text-text-primary">{a.completed}</td>
                      <td className="px-4 py-3 text-text-primary">{a.overdue}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`font-medium ${
                            a.on_time_pct >= 80
                              ? "text-green-600"
                              : a.on_time_pct >= 50
                              ? "text-amber-600"
                              : "text-red-600"
                          }`}
                        >
                          {a.on_time_pct}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>

          {/* ── By BDM ───────────────────────────────── */}
          <Card padding="none">
            <div className="px-4 py-3 border-b border-border">
              <h2 className="font-medium text-text-primary">By BDM</h2>
            </div>
            {kpi!.by_bdm.length === 0 ? (
              <div className="text-center py-8 text-text-secondary text-sm">No data</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="px-4 py-3 text-xs font-semibold text-text-secondary uppercase tracking-wide">BDM</th>
                    <th className="px-4 py-3 text-xs font-semibold text-text-secondary uppercase tracking-wide">Total</th>
                    <th className="px-4 py-3 text-xs font-semibold text-text-secondary uppercase tracking-wide">Completed</th>
                    <th className="px-4 py-3 text-xs font-semibold text-text-secondary uppercase tracking-wide">Overdue</th>
                    <th className="px-4 py-3 text-xs font-semibold text-text-secondary uppercase tracking-wide">Messages</th>
                    <th className="px-4 py-3 text-xs font-semibold text-text-secondary uppercase tracking-wide">Tokens</th>
                  </tr>
                </thead>
                <tbody>
                  {kpi!.by_bdm.map((b) => (
                    <tr key={b.user_id} className="border-b border-border last:border-0 hover:bg-surface-hover">
                      <td className="px-4 py-3 font-medium text-text-primary">{b.user_name}</td>
                      <td className="px-4 py-3 text-text-primary">{b.total}</td>
                      <td className="px-4 py-3 text-text-primary">{b.completed}</td>
                      <td className="px-4 py-3 text-text-primary">{b.overdue}</td>
                      <td className="px-4 py-3 text-text-primary">{b.messages_generated}</td>
                      <td className="px-4 py-3 text-text-secondary">{b.tokens_used.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>

          {/* ── AI Diagnosis (collapsible) ───────────── */}
          {diagnosisOpen && (
            <Card>
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-medium text-text-primary">AI Diagnosis</h2>
                <button
                  onClick={() => setDiagnosisOpen(false)}
                  className="text-text-secondary hover:text-text-primary text-sm"
                >
                  Close
                </button>
              </div>
              {diagnosisLoading ? (
                <div className="flex items-center gap-2 py-6 justify-center text-text-secondary text-sm">
                  <svg className="h-5 w-5 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Generating diagnosis...
                </div>
              ) : diagnosis ? (
                <div>
                  <div className="prose prose-sm max-w-none text-text-primary whitespace-pre-wrap">
                    {diagnosis.diagnosis}
                  </div>
                  <p className="text-xs text-text-secondary mt-4">
                    Tokens used: {diagnosis.tokens_used.toLocaleString()}
                  </p>
                </div>
              ) : null}
            </Card>
          )}
        </>
      ) : (
        <div className="text-center py-10 text-text-secondary text-sm">No KPI data available.</div>
      )}

      <ToastComponent />
    </div>
  );
}

export default function KpisPage() {
  return (
    <RoleGuard allowedRoles={["admin", "director"]} fallback={<p className="text-red-600">Access denied</p>}>
      <KpisContent />
    </RoleGuard>
  );
}
