"use client";

import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/Card";

const ROLE_LABELS: Record<string, string> = {
  admin: "Administrator",
  bdm: "Business Development Manager",
  director: "Director",
};

export default function DashboardPage() {
  const { user } = useAuth();

  return (
    <div className="max-w-4xl">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-text-primary">
          Welcome, {user?.full_name ?? "—"}
        </h1>
        <p className="text-text-secondary mt-1">
          {ROLE_LABELS[user?.role ?? ""] ?? user?.role}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card>
          <p className="text-sm font-medium text-text-secondary">Open Reminders</p>
          <p className="text-3xl font-semibold text-text-primary mt-1">—</p>
          <p className="text-xs text-text-secondary mt-1">Available in Phase 3</p>
        </Card>
        <Card>
          <p className="text-sm font-medium text-text-secondary">Overdue</p>
          <p className="text-3xl font-semibold text-red-500 mt-1">—</p>
          <p className="text-xs text-text-secondary mt-1">Available in Phase 3</p>
        </Card>
        <Card>
          <p className="text-sm font-medium text-text-secondary">Completed This Month</p>
          <p className="text-3xl font-semibold text-accent mt-1">—</p>
          <p className="text-xs text-text-secondary mt-1">Available in Phase 3</p>
        </Card>
      </div>

      <div className="mt-8">
        <Card>
          <h2 className="font-medium text-text-primary mb-2">Platform Status</h2>
          <p className="text-sm text-text-secondary">
            Phase 1 complete — Foundation, Auth, RBAC, and Branding are active.
            Reminders, Calendar, and AI features will be available in upcoming phases.
          </p>
        </Card>
      </div>
    </div>
  );
}
