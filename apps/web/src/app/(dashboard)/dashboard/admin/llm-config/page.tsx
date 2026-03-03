"use client";

import { useEffect, useState } from "react";
import { RoleGuard } from "@/components/layout/RoleGuard";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import api, { parseApiError } from "@/lib/api";
import { LLMConfig, BudgetUsageSummary } from "@/types/ai";

function LLMConfigContent() {
  const { showToast, ToastComponent } = useToast();
  const [config, setConfig] = useState<LLMConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [provider, setProvider] = useState("openai");
  const [model, setModel] = useState("gpt-4o-mini");
  const [apiKey, setApiKey] = useState("");
  const [maxTokens, setMaxTokens] = useState(1500);
  const [isActive, setIsActive] = useState(false);
  const [usageSummary, setUsageSummary] = useState<BudgetUsageSummary[]>([]);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);

  useEffect(() => { loadConfig(); loadUsage(); }, []);

  async function loadModels() {
    setLoadingModels(true);
    try {
      const res = await api.get<{ models: string[] }>("/llm-config/models");
      setAvailableModels(res.data.models);
    } catch {
      setAvailableModels([]);
    } finally {
      setLoadingModels(false);
    }
  }

  async function loadConfig() {
    try {
      const res = await api.get<LLMConfig>("/llm-config");
      setConfig(res.data);
      setProvider(res.data.provider);
      setModel(res.data.model);
      setMaxTokens(res.data.max_tokens_per_request);
      setIsActive(res.data.is_active);
      // Auto-load models if API key is already configured
      if (res.data.api_key_set) {
        loadModels();
      }
    } catch (err: any) {
      // 404 is fine
    } finally { setLoading(false); }
  }

  async function loadUsage() {
    try {
      const res = await api.get<BudgetUsageSummary[]>("/token-budgets");
      setUsageSummary(res.data);
    } catch {}
  }

  async function handleSave() {
    setSaving(true);
    try {
      const payload: any = { provider, model, max_tokens_per_request: maxTokens, is_active: isActive };
      if (apiKey) payload.api_key = apiKey;
      await api.patch("/llm-config", payload);
      showToast("LLM configuration saved", "success");
      setApiKey("");
      await loadConfig();
      // Reload available models with the (possibly new) API key
      loadModels();
    } catch (err: any) {
      showToast(parseApiError(err, "Failed to save configuration"), "error");
    } finally { setSaving(false); }
  }

  async function handleTest() {
    setTesting(true);
    try {
      const res = await api.post<{ ok: boolean; message: string }>("/llm-config/test");
      if (res.data.ok) { showToast(res.data.message, "success"); }
      else { showToast(res.data.message, "error"); }
    } catch (err: any) {
      showToast(parseApiError(err, "Connection test failed"), "error");
    } finally { setTesting(false); }
  }

  const totalTokensThisMonth = usageSummary.reduce((s, u) => s + u.tokens_used_this_month, 0);

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-semibold text-text-primary">LLM Settings</h1>

      <Card>
        <h2 className="font-medium text-text-primary mb-4">Provider Configuration</h2>
        {loading ? (
          <p className="text-text-secondary text-sm">Loading...</p>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1">Provider</label>
              <select
                value={provider}
                onChange={(e) => {
                  setProvider(e.target.value);
                  setModel(e.target.value === "openai" ? "gpt-4o-mini" : "claude-3-5-haiku-20241022");
                  // Clear cached models — they belong to the previous provider/key combo
                  setAvailableModels([]);
                }}
                className="w-full rounded border border-border bg-surface text-text-primary px-3 py-2 text-sm"
              >
                <option value="openai">OpenAI</option>
                <option value="anthropic">Anthropic (Claude)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-text-primary mb-1">
                Model
                {loadingModels && (
                  <span className="ml-2 text-xs font-normal text-text-secondary animate-pulse">Loading models…</span>
                )}
              </label>
              {availableModels.length > 0 ? (
                <select
                  value={availableModels.includes(model) ? model : ""}
                  onChange={(e) => setModel(e.target.value)}
                  disabled={loadingModels}
                  className="w-full rounded border border-border bg-surface text-text-primary px-3 py-2 text-sm"
                >
                  {!availableModels.includes(model) && (
                    <option value="" disabled>Select a model…</option>
                  )}
                  {availableModels.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  placeholder={provider === "openai" ? "gpt-4o-mini" : "claude-3-5-haiku-20241022"}
                  className="w-full rounded border border-border bg-surface text-text-primary px-3 py-2 text-sm"
                />
              )}
              <p className="mt-1 text-xs text-text-secondary">
                {availableModels.length > 0
                  ? `${availableModels.length} models available from ${provider === "openai" ? "OpenAI" : "Anthropic"}`
                  : config?.api_key_set
                    ? "Save configuration to refresh the model list."
                    : "Set an API key and save to load available models."}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-text-primary mb-1">
                API Key {config?.api_key_set && <span className="text-green-600 font-normal">(currently set)</span>}
              </label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={config?.api_key_set ? "Leave blank to keep current key" : "Enter API key..."}
                className="w-full rounded border border-border bg-surface text-text-primary px-3 py-2 text-sm"
                autoComplete="new-password"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-text-primary mb-1">
                Max Tokens per Request: <span className="font-semibold">{maxTokens}</span>
              </label>
              <input
                type="range"
                min={100}
                max={4000}
                step={100}
                value={maxTokens}
                onChange={(e) => setMaxTokens(parseInt(e.target.value))}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-text-secondary mt-1">
                <span>100</span><span>4000</span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setIsActive(!isActive)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${isActive ? "bg-brand" : "bg-border"}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isActive ? "translate-x-6" : "translate-x-1"}`} />
              </button>
              <span className="text-sm text-text-primary">
                {isActive ? "Active — AI generation enabled" : "Inactive — AI generation disabled"}
              </span>
            </div>

            <div className="flex gap-2 pt-1">
              <Button variant="primary" size="sm" loading={saving} onClick={handleSave}>
                Save Configuration
              </Button>
              <Button variant="secondary" size="sm" loading={testing} onClick={handleTest} disabled={!config?.api_key_set && !apiKey}>
                Test Connection
              </Button>
            </div>
          </div>
        )}
      </Card>

      <Card>
        <h2 className="font-medium text-text-primary mb-3">
          Team Token Usage This Month
          <span className="ml-2 text-sm font-normal text-text-secondary">Total: {totalTokensThisMonth.toLocaleString()}</span>
        </h2>
        {usageSummary.length === 0 ? (
          <p className="text-text-secondary text-sm">No usage data yet.</p>
        ) : (
          <div className="space-y-2">
            {usageSummary.filter((u) => u.tokens_used_this_month > 0).map((u) => (
              <div key={u.user_id} className="flex items-center gap-3 text-sm">
                <div className="w-32 truncate text-text-primary font-medium">{u.user_name}</div>
                <div className="flex-1 h-2 bg-border rounded-full overflow-hidden">
                  <div
                    className="h-full bg-brand rounded-full"
                    style={{
                      width: u.monthly_limit > 0
                        ? `${Math.min(100, (u.tokens_used_this_month / u.monthly_limit) * 100)}%`
                        : "20%",
                    }}
                  />
                </div>
                <div className="text-text-secondary text-xs whitespace-nowrap">
                  {u.tokens_used_this_month.toLocaleString()}
                  {u.monthly_limit > 0 ? ` / ${u.monthly_limit.toLocaleString()}` : " (no limit)"}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
      <ToastComponent />
    </div>
  );
}

export default function LLMConfigPage() {
  return (
    <RoleGuard allowedRoles={["admin"]} fallback={<p className="text-red-600">Access denied</p>}>
      <LLMConfigContent />
    </RoleGuard>
  );
}
