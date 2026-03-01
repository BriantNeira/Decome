"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/components/ui/Toast";
import { RoleGuard } from "@/components/layout/RoleGuard";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import api, { parseApiError } from "@/lib/api";
import { Account } from "@/types/masterdata";

interface AccountsListResponse {
  items: Account[];
  total: number;
}

function AccountsContent() {
  const router = useRouter();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [formData, setFormData] = useState({ name: "", code: "", description: "" });
  const [submitting, setSubmitting] = useState(false);
  const { showToast, ToastComponent } = useToast();

  useEffect(() => {
    loadAccounts();
  }, []);

  async function loadAccounts() {
    try {
      setLoading(true);
      const res = await api.get<AccountsListResponse>("/accounts");
      setAccounts(res.data.items);
      setTotal(res.data.total);
    } catch (err: any) {
      showToast(parseApiError(err, "Failed to load accounts"), "error");
    } finally {
      setLoading(false);
    }
  }

  async function handleAddAccount() {
    if (!formData.name.trim()) {
      showToast("Account name is required", "error");
      return;
    }

    setSubmitting(true);
    try {
      await api.post("/accounts", formData);
      showToast("Account created", "success");
      setFormData({ name: "", code: "", description: "" });
      setShowAdd(false);
      await loadAccounts();
    } catch (err: any) {
      showToast(parseApiError(err, "Failed to create account"), "error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-text-primary">Accounts</h1>
        <div className="text-sm text-text-secondary">Total: {total}</div>
        <Button onClick={() => setShowAdd(!showAdd)} variant="primary">
          {showAdd ? "Cancel" : "+ Add Account"}
        </Button>
      </div>

      {showAdd && (
        <Card padding="md">
          <div className="space-y-4">
            <Input
              label="Account Name *"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Enter account name"
            />
            <Input
              label="Account Code"
              value={formData.code}
              onChange={(e) => setFormData({ ...formData, code: e.target.value })}
              placeholder="Optional code"
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
            <Button onClick={handleAddAccount} loading={submitting} variant="primary" size="md">
              Create Account
            </Button>
          </div>
        </Card>
      )}

      {loading ? (
        <div className="text-center py-12 text-text-secondary">Loading accounts...</div>
      ) : accounts.length === 0 ? (
        <Card padding="md">
          <p className="text-center text-text-secondary">No accounts yet. Create one to get started.</p>
        </Card>
      ) : (
        <Card padding="sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-4 font-medium text-text-secondary">Name</th>
                  <th className="text-left py-3 px-4 font-medium text-text-secondary">Code</th>
                  <th className="text-left py-3 px-4 font-medium text-text-secondary">Status</th>
                  <th className="text-left py-3 px-4 font-medium text-text-secondary"></th>
                </tr>
              </thead>
              <tbody>
                {accounts.map((account) => (
                  <tr key={account.id} className="border-b border-border hover:bg-bg">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        {account.logo_url ? (
                          <img
                            src={account.logo_url}
                            alt={account.name}
                            className="w-8 h-8 rounded object-contain bg-surface border border-border flex-shrink-0"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded bg-surface border border-border flex items-center justify-center flex-shrink-0">
                            <span className="text-text-secondary text-xs font-bold">
                              {account.name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                        )}
                        <span className="font-medium">{account.name}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-text-secondary font-mono text-xs">{account.code || "—"}</td>
                    <td className="py-3 px-4">
                      <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${account.is_active ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}`}>
                        {account.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => router.push(`/dashboard/admin/accounts/${account.id}`)}
                        className="text-sm text-brand hover:underline font-medium"
                      >
                        View Details →
                      </button>
                    </td>
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

export default function AccountsPage() {
  return (
    <RoleGuard allowedRoles={["admin", "director"]} fallback={<p className="text-red-600">Access denied</p>}>
      <AccountsContent />
    </RoleGuard>
  );
}
