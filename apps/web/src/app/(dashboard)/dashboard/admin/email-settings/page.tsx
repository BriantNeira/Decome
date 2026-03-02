"use client";

import { useEffect, useState } from "react";
import { RoleGuard } from "@/components/layout/RoleGuard";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/hooks/useAuth";
import api, { parseApiError } from "@/lib/api";
import { EmailConfig, EmailAlertLog, EmailAlertLogListResponse, AlertRunResult } from "@/types/email";

const ALERT_TYPE_LABELS: Record<string, string> = {
  "7_day": "7-Day",
  "1_day": "1-Day",
  overdue: "Overdue",
};

function EmailSettingsContent() {
  const { user } = useAuth();
  const { showToast, ToastComponent } = useToast();

  const [activeTab, setActiveTab] = useState<"settings" | "logs">("settings");

  // ── Config state ──────────────────────────────────────────────────────
  const [config, setConfig] = useState<EmailConfig>({
    smtp_host: "", smtp_port: 587, smtp_user: "", from_email: "",
    from_name: "Deminder", use_tls: true, is_active: false, updated_at: null,
  });
  const [password, setPassword] = useState("");
  const [configLoading, setConfigLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [running, setRunning] = useState(false);

  // ── Log state ─────────────────────────────────────────────────────────
  const [logs, setLogs] = useState<EmailAlertLog[]>([]);
  const [logsTotal, setLogsTotal] = useState(0);
  const [logsLoading, setLogsLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState("");
  const [retryingId, setRetryingId] = useState<number | null>(null);
  const [expandedLogId, setExpandedLogId] = useState<number | null>(null);

  // ── Boot ──────────────────────────────────────────────────────────────
  useEffect(() => { loadConfig(); }, []);
  useEffect(() => {
    if (activeTab === "logs") loadLogs();
  }, [activeTab, statusFilter]);

  async function loadConfig() {
    setConfigLoading(true);
    try {
      const res = await api.get<EmailConfig>("/email-config");
      setConfig(res.data);
    } catch (err: any) {
      showToast(parseApiError(err, "Failed to load email config"), "error");
    } finally {
      setConfigLoading(false);
    }
  }

  async function loadLogs() {
    setLogsLoading(true);
    try {
      const params = new URLSearchParams({ limit: "100" });
      if (statusFilter) params.set("status", statusFilter);
      const res = await api.get<EmailAlertLogListResponse>(`/email-config/logs?${params}`);
      setLogs(res.data.items);
      setLogsTotal(res.data.total);
    } catch (err: any) {
      showToast(parseApiError(err, "Failed to load logs"), "error");
    } finally {
      setLogsLoading(false);
    }
  }

  // ── Handlers ──────────────────────────────────────────────────────────
  async function handleSave() {
    setSaving(true);
    try {
      const payload: any = {
        smtp_host: config.smtp_host || null,
        smtp_port: config.smtp_port,
        smtp_user: config.smtp_user || null,
        from_email: config.from_email || null,
        from_name: config.from_name || null,
        use_tls: config.use_tls,
        is_active: config.is_active,
      };
      if (password) payload.smtp_password = password;
      const res = await api.patch<EmailConfig>("/email-config", payload);
      setConfig(res.data);
      setPassword("");
      showToast("Email settings saved", "success");
    } catch (err: any) {
      showToast(parseApiError(err, "Failed to save settings"), "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleTestEmail() {
    if (!user?.email) return;
    setTesting(true);
    try {
      await api.post("/email-config/test", { to_email: user.email });
      showToast(`Test email sent to ${user.email}`, "success");
    } catch (err: any) {
      showToast(parseApiError(err, "Failed to send test email"), "error");
    } finally {
      setTesting(false);
    }
  }

  async function handleRunNow() {
    setRunning(true);
    try {
      const res = await api.post<AlertRunResult>("/email-config/run");
      const r = res.data;
      if (r.skipped) {
        showToast(`Skipped: ${r.skipped}`, "error");
      } else {
        showToast(`Alerts sent: ${r.sent}  failed: ${r.failed}`, r.failed > 0 ? "error" : "success");
      }
      if (activeTab === "logs") await loadLogs();
    } catch (err: any) {
      showToast(parseApiError(err, "Failed to run alerts"), "error");
    } finally {
      setRunning(false);
    }
  }

  async function handleRetry(logId: number) {
    setRetryingId(logId);
    try {
      await api.post(`/email-config/logs/${logId}/retry`);
      showToast("Alert retried successfully", "success");
      await loadLogs();
    } catch (err: any) {
      showToast(parseApiError(err, "Retry failed"), "error");
    } finally {
      setRetryingId(null);
    }
  }

  const inputClass = "w-full rounded border border-border bg-surface text-text-primary px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sidebar-active";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-text-primary">Email Settings</h1>
        <div className="flex gap-2">
          <Button onClick={handleRunNow} loading={running} variant="secondary" size="sm">
            Run Alerts Now
          </Button>
        </div>
      </div>

      {/* Active status banner */}
      <div className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium ${
        config.is_active
          ? "bg-green-50 border-green-200 text-green-800"
          : "bg-yellow-50 border-yellow-200 text-yellow-800"
      }`}>
        <span className={`w-2 h-2 rounded-full ${config.is_active ? "bg-green-500" : "bg-yellow-400"}`} />
        {config.is_active
          ? "Email alerts are ACTIVE — scheduler checks every hour"
          : "Email alerts are DISABLED — configure SMTP and enable below"}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border">
        {(["settings", "logs"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px capitalize transition-colors ${
              activeTab === tab
                ? "border-action text-action"
                : "border-transparent text-text-secondary hover:text-text-primary"
            }`}
          >
            {tab === "logs" ? `Alert Logs (${logsTotal})` : "SMTP Settings"}
          </button>
        ))}
      </div>

      {/* ── SETTINGS TAB ───────────────────────────────────────────────── */}
      {activeTab === "settings" && (
        <Card padding="md">
          {configLoading ? (
            <p className="text-text-secondary text-sm">Loading…</p>
          ) : (
            <div className="space-y-5 max-w-lg">
              {/* Toggle */}
              <div className="flex items-center justify-between p-3 rounded-lg bg-bg border border-border">
                <div>
                  <p className="text-sm font-medium text-text-primary">Enable Email Alerts</p>
                  <p className="text-xs text-text-secondary mt-0.5">
                    When enabled, reminders trigger 7-day, 1-day and overdue emails
                  </p>
                </div>
                <button
                  onClick={() => setConfig({ ...config, is_active: !config.is_active })}
                  className={`relative w-11 h-6 rounded-full transition-colors ${
                    config.is_active ? "bg-action" : "bg-gray-300"
                  }`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                    config.is_active ? "translate-x-5" : "translate-x-0"
                  }`} />
                </button>
              </div>

              {/* SMTP fields */}
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-text-primary mb-1">SMTP Host</label>
                  <input
                    value={config.smtp_host || ""}
                    onChange={(e) => setConfig({ ...config, smtp_host: e.target.value })}
                    placeholder="smtp.example.com"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-1">Port</label>
                  <input
                    type="number"
                    value={config.smtp_port ?? 587}
                    onChange={(e) => setConfig({ ...config, smtp_port: parseInt(e.target.value) || 587 })}
                    className={inputClass}
                  />
                </div>
                <div className="flex items-end gap-3 pb-1">
                  <label className="flex items-center gap-2 cursor-pointer text-sm text-text-primary">
                    <input
                      type="checkbox"
                      checked={config.use_tls}
                      onChange={(e) => setConfig({ ...config, use_tls: e.target.checked })}
                      className="w-4 h-4 accent-action"
                    />
                    Use TLS / STARTTLS
                  </label>
                </div>
              </div>

              <Input
                label="SMTP Username"
                value={config.smtp_user || ""}
                onChange={(e) => setConfig({ ...config, smtp_user: e.target.value })}
                placeholder="user@example.com"
              />
              <div>
                <label className="block text-sm font-medium text-text-primary mb-1">
                  SMTP Password
                  <span className="text-text-secondary font-normal ml-1 text-xs">(leave blank to keep current)</span>
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className={inputClass}
                  autoComplete="new-password"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="From Email"
                  value={config.from_email || ""}
                  onChange={(e) => setConfig({ ...config, from_email: e.target.value })}
                  placeholder="noreply@yourcompany.com"
                />
                <Input
                  label="From Name"
                  value={config.from_name || ""}
                  onChange={(e) => setConfig({ ...config, from_name: e.target.value })}
                  placeholder="Deminder"
                />
              </div>

              {/* Alert rules info */}
              <div className="rounded-lg border border-border bg-bg p-3 text-xs text-text-secondary space-y-1">
                <p className="font-medium text-text-primary text-sm mb-1">Alert Rules</p>
                <p>• <strong>7-Day</strong> — sent once when start_date = today + 7</p>
                <p>• <strong>1-Day</strong> — sent once when start_date = tomorrow</p>
                <p>• <strong>Overdue</strong> — sent daily while reminder is open/in-progress past due date</p>
                <p>• Alerts stop automatically once reminder is completed or cancelled</p>
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-3 pt-2">
                <Button onClick={handleSave} loading={saving} variant="primary">
                  Save Settings
                </Button>
                <Button onClick={handleTestEmail} loading={testing} variant="secondary">
                  Send Test Email to {user?.email}
                </Button>
              </div>

              {config.updated_at && (
                <p className="text-xs text-text-secondary">
                  Last updated: {new Date(config.updated_at).toLocaleString()}
                </p>
              )}
            </div>
          )}
        </Card>
      )}

      {/* ── LOGS TAB ────────────────────────────────────────────────────── */}
      {activeTab === "logs" && (
        <>
          <div className="flex items-center gap-3">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded border border-border bg-surface text-text-primary px-3 py-1.5 text-sm"
            >
              <option value="">All Statuses</option>
              <option value="sent">Sent</option>
              <option value="failed">Failed</option>
            </select>
            <Button onClick={loadLogs} variant="secondary" size="sm" loading={logsLoading}>
              Refresh
            </Button>
          </div>

          {logsLoading ? (
            <div className="text-center py-12 text-text-secondary">Loading logs…</div>
          ) : logs.length === 0 ? (
            <Card padding="md">
              <p className="text-center text-text-secondary">No alert logs found.</p>
            </Card>
          ) : (
            <Card padding="sm">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-3 px-4 font-medium text-text-secondary">Date & Time</th>
                      <th className="text-left py-3 px-4 font-medium text-text-secondary">Reminder</th>
                      <th className="text-left py-3 px-4 font-medium text-text-secondary">Type</th>
                      <th className="text-left py-3 px-4 font-medium text-text-secondary">Sent To</th>
                      <th className="text-left py-3 px-4 font-medium text-text-secondary">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((log) => (
                      <tr key={log.id} className="border-b border-border hover:bg-bg">
                        <td className="py-3 px-4 text-text-secondary whitespace-nowrap">
                          {new Date(log.sent_at).toLocaleString()}
                        </td>
                        <td className="py-3 px-4 font-medium max-w-[220px] truncate">
                          {log.reminder_title ?? log.reminder_id.substring(0, 8) + "…"}
                        </td>
                        <td className="py-3 px-4">
                          <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                            {ALERT_TYPE_LABELS[log.alert_type] ?? log.alert_type}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-text-secondary">{log.sent_to}</td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                                log.status === "sent"
                                  ? "bg-green-100 text-green-800"
                                  : "bg-red-100 text-red-800"
                              }`}
                            >
                              {log.status === "sent" ? "✓ Sent" : "✗ Failed"}
                            </span>
                            {log.status === "failed" && (
                              <button
                                onClick={() => handleRetry(log.id)}
                                disabled={retryingId === log.id}
                                className="text-xs text-brand hover:underline font-medium disabled:opacity-50"
                              >
                                {retryingId === log.id ? "Retrying…" : "Retry"}
                              </button>
                            )}
                          </div>
                          {log.error_message && (
                            <div className="mt-1">
                              <button
                                onClick={() =>
                                  setExpandedLogId(expandedLogId === log.id ? null : log.id)
                                }
                                className="text-[10px] text-red-500 hover:underline"
                              >
                                {expandedLogId === log.id ? "Hide error ▲" : "Show error ▼"}
                              </button>
                              {expandedLogId === log.id && (
                                <p className="mt-1 text-xs text-red-700 bg-red-50 rounded p-2 break-all border border-red-200">
                                  {log.error_message}
                                </p>
                              )}
                            </div>
                          )}
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

export default function EmailSettingsPage() {
  return (
    <RoleGuard allowedRoles={["admin"]} fallback={<p className="text-red-600">Access denied</p>}>
      <EmailSettingsContent />
    </RoleGuard>
  );
}
