"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/Card";
import api from "@/lib/api";
import { ReminderStats } from "@/types/masterdata";

const ROLE_LABELS: Record<string, string> = {
  admin: "Administrator",
  bdm: "Business Development Manager",
  director: "Director",
};

export default function DashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<ReminderStats | null>(null);

  useEffect(() => {
    api
      .get<ReminderStats>("/reminders/stats")
      .then((res) => setStats(res.data))
      .catch(() => {});
  }, []);

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
          <p className="text-3xl font-semibold text-text-primary mt-1">
            {stats ? stats.open : "—"}
          </p>
          {stats && stats.open > 0 && (
            <p className="text-xs text-amber-500 mt-1">{stats.open} pending</p>
          )}
        </Card>
        <Card>
          <p className="text-sm font-medium text-text-secondary">Overdue</p>
          <p className={"text-3xl font-semibold mt-1 " + (stats && stats.overdue > 0 ? "text-red-500" : "text-text-primary")}>
            {stats ? stats.overdue : "—"}
          </p>
          {stats && stats.overdue > 0 && (
            <p className="text-xs text-red-400 mt-1">Needs attention</p>
          )}
        </Card>
        <Card>
          <p className="text-sm font-medium text-text-secondary">Completed This Month</p>
          <p className="text-3xl font-semibold text-accent mt-1">
            {stats ? stats.completed_this_month : "—"}
          </p>
          {stats && stats.in_progress > 0 && (
            <p className="text-xs text-text-secondary mt-1">{stats.in_progress} in progress</p>
          )}
        </Card>
      </div>

      <div className="mt-8">
        <Card>
          <h2 className="font-medium text-text-primary mb-2">Platform Status</h2>
          <p className="text-sm text-text-secondary">
            Phase 2 complete — Master Data, Assignments, Contacts, and Custom Fields are active.
            Reminders and Calendar are live in Phase 3.
          </p>
        </Card>
      </div>
    </div>
  );
}
