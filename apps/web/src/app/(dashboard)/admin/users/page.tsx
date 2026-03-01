"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { RoleGuard } from "@/components/layout/RoleGuard";
import api from "@/lib/api";
import type { User } from "@/types/auth";

export default function UsersPage() {
  return (
    <RoleGuard allowedRoles={["admin"]} fallback={<p className="text-red-500">Access denied.</p>}>
      <UsersContent />
    </RoleGuard>
  );
}

function UsersContent() {
  const { showToast, ToastComponent } = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);

  // Add user form
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<"admin" | "bdm" | "director">("bdm");
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState("");

  async function loadUsers() {
    setLoading(true);
    try {
      const res = await api.get<{ items: User[]; total: number }>("/users");
      setUsers(res.data.items);
      setTotal(res.data.total);
    } catch {
      showToast("Failed to load users.", "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadUsers(); }, []);

  async function addUser() {
    setAddLoading(true);
    setAddError("");
    try {
      await api.post("/auth/register", {
        email: newEmail,
        password: newPassword,
        full_name: newName,
        role: newRole,
      });
      showToast("User created.", "success");
      setShowAdd(false);
      setNewEmail(""); setNewName(""); setNewPassword(""); setNewRole("bdm");
      loadUsers();
    } catch (err: any) {
      setAddError(err.response?.data?.detail ?? "Failed to create user.");
    } finally {
      setAddLoading(false);
    }
  }

  async function toggleActive(user: User) {
    try {
      await api.patch(`/users/${user.id}`, { is_active: !user.is_active });
      showToast(`User ${user.is_active ? "deactivated" : "activated"}.`, "success");
      loadUsers();
    } catch {
      showToast("Failed to update user.", "error");
    }
  }

  async function changeRole(user: User, role: string) {
    try {
      await api.patch(`/users/${user.id}`, { role });
      showToast("Role updated.", "success");
      loadUsers();
    } catch {
      showToast("Failed to update role.", "error");
    }
  }

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary">Users</h1>
          <p className="text-sm text-text-secondary">{total} total</p>
        </div>
        <Button size="sm" onClick={() => setShowAdd(!showAdd)}>
          {showAdd ? "Cancel" : "+ Add User"}
        </Button>
      </div>

      {/* Add User Form */}
      {showAdd && (
        <Card className="mb-6">
          <h2 className="font-medium text-text-primary mb-4">New User</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Full Name" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Jane Smith" />
            <Input label="Email" type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="jane@example.com" />
            <Input label="Password" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Min 8 chars" />
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-text-primary">Role</label>
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value as any)}
                className="h-11 rounded-lg border border-border bg-surface text-text-primary px-3 text-sm focus:outline-none focus:ring-2 focus:ring-action"
              >
                <option value="bdm">BDM</option>
                <option value="admin">Admin</option>
                <option value="director">Director</option>
              </select>
            </div>
          </div>
          {addError && <p className="text-sm text-red-500 mt-2">{addError}</p>}
          <div className="flex gap-2 mt-4">
            <Button size="sm" loading={addLoading} onClick={addUser}>Create User</Button>
            <Button size="sm" variant="ghost" onClick={() => setShowAdd(false)}>Cancel</Button>
          </div>
        </Card>
      )}

      {/* Users Table */}
      <Card padding="sm">
        {loading ? (
          <div className="flex justify-center p-8">
            <div className="h-6 w-6 animate-spin rounded-full border-4 border-border border-t-action" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-4 font-medium text-text-secondary">Name</th>
                  <th className="text-left py-3 px-4 font-medium text-text-secondary">Email</th>
                  <th className="text-left py-3 px-4 font-medium text-text-secondary">Role</th>
                  <th className="text-left py-3 px-4 font-medium text-text-secondary">Status</th>
                  <th className="text-left py-3 px-4 font-medium text-text-secondary">2FA</th>
                  <th className="py-3 px-4" />
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-b border-border last:border-0 hover:bg-bg transition-colors">
                    <td className="py-3 px-4 font-medium text-text-primary">{user.full_name}</td>
                    <td className="py-3 px-4 text-text-secondary">{user.email}</td>
                    <td className="py-3 px-4">
                      <select
                        value={user.role}
                        onChange={(e) => changeRole(user, e.target.value)}
                        className="rounded border border-border bg-surface text-text-primary px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-action"
                      >
                        <option value="bdm">BDM</option>
                        <option value="admin">Admin</option>
                        <option value="director">Director</option>
                      </select>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                        user.is_active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                      }`}>
                        {user.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-xs text-text-secondary">
                      {user.totp_enabled ? "✓ On" : "—"}
                    </td>
                    <td className="py-3 px-4">
                      <Button
                        variant={user.is_active ? "danger" : "secondary"}
                        size="sm"
                        onClick={() => toggleActive(user)}
                        className="text-xs"
                      >
                        {user.is_active ? "Deactivate" : "Activate"}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <ToastComponent />
    </div>
  );
}
