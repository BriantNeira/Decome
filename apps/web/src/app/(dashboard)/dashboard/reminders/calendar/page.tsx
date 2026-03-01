"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { RoleGuard } from "@/components/layout/RoleGuard";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import api, { parseApiError } from "@/lib/api";
import { CalendarReminder } from "@/types/masterdata";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function getCalendarDays(year: number, month: number): (number | null)[] {
  // month is 1-indexed
  const firstDay = new Date(year, month - 1, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(year, month, 0).getDate();
  // Shift so Monday=0
  const offset = (firstDay + 6) % 7;
  const cells: (number | null)[] = [];
  for (let i = 0; i < offset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  // Pad to complete last row
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function isoDate(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

interface DetailPanel {
  reminder: CalendarReminder;
  occurrenceDate: string;
}

function CalendarContent() {
  const router = useRouter();
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1); // 1-indexed
  const [reminders, setReminders] = useState<CalendarReminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [detail, setDetail] = useState<DetailPanel | null>(null);

  const loadCalendar = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api.get<CalendarReminder[]>(`/reminders/calendar?year=${year}&month=${month}`);
      setReminders(res.data);
    } catch (err: any) {
      setError(parseApiError(err, "Failed to load calendar"));
    } finally {
      setLoading(false);
    }
  }, [year, month]);

  useEffect(() => {
    loadCalendar();
  }, [loadCalendar]);

  function prevMonth() {
    if (month === 1) { setYear(y => y - 1); setMonth(12); }
    else setMonth(m => m - 1);
    setDetail(null);
  }

  function nextMonth() {
    if (month === 12) { setYear(y => y + 1); setMonth(1); }
    else setMonth(m => m + 1);
    setDetail(null);
  }

  // Group reminders by occurrence_date
  const remindersByDate: Record<string, CalendarReminder[]> = {};
  for (const r of reminders) {
    const key = r.occurrence_date;
    if (!remindersByDate[key]) remindersByDate[key] = [];
    remindersByDate[key].push(r);
  }

  const cells = getCalendarDays(year, month);
  const todayStr = today.toISOString().slice(0, 10);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={prevMonth}
            className="w-8 h-8 flex items-center justify-center rounded-lg border border-border text-text-secondary hover:text-text-primary hover:bg-surface-hover transition-colors"
          >
            ‹
          </button>
          <h1 className="text-xl font-semibold text-text-primary min-w-[160px] text-center">
            {MONTH_NAMES[month - 1]} {year}
          </h1>
          <button
            onClick={nextMonth}
            className="w-8 h-8 flex items-center justify-center rounded-lg border border-border text-text-secondary hover:text-text-primary hover:bg-surface-hover transition-colors"
          >
            ›
          </button>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => { setYear(today.getFullYear()); setMonth(today.getMonth() + 1); }}
            variant="secondary"
            size="sm"
          >
            Today
          </Button>
          <Button
            onClick={() => router.push("/dashboard/reminders")}
            variant="primary"
            size="sm"
          >
            + Add Reminder
          </Button>
        </div>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
        {/* Calendar grid */}
        <div className="lg:col-span-2">
          <Card padding="none">
            {/* Day headers */}
            <div className="grid grid-cols-7 border-b border-border">
              {DAY_NAMES.map((d) => (
                <div key={d} className="py-2 text-center text-xs font-semibold text-text-secondary uppercase tracking-wide">
                  {d}
                </div>
              ))}
            </div>
            {/* Cells */}
            {loading ? (
              <div className="h-48 flex items-center justify-center text-text-secondary text-sm">Loading…</div>
            ) : (
              <div className="grid grid-cols-7">
                {cells.map((day, idx) => {
                  const dateStr = day ? isoDate(year, month, day) : null;
                  const dayReminders = dateStr ? (remindersByDate[dateStr] ?? []) : [];
                  const isToday = dateStr === todayStr;
                  return (
                    <div
                      key={idx}
                      className={`min-h-[90px] border-r border-b border-border p-1.5 ${
                        !day ? "bg-surface/40" : "hover:bg-surface-hover cursor-pointer"
                      } ${idx % 7 === 6 ? "border-r-0" : ""}`}
                      onClick={() => {
                        if (day) {
                          // Navigate to reminders with date pre-fill context (link approach)
                          router.push(`/dashboard/reminders?date=${dateStr}`);
                        }
                      }}
                    >
                      {day && (
                        <>
                          <span
                            className={`inline-flex items-center justify-center w-6 h-6 text-xs font-medium rounded-full mb-1 ${
                              isToday
                                ? "bg-sidebar-active text-white"
                                : "text-text-secondary"
                            }`}
                          >
                            {day}
                          </span>
                          <div className="space-y-0.5">
                            {dayReminders.slice(0, 3).map((r, i) => (
                              <button
                                key={`${r.id}-${i}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDetail({ reminder: r, occurrenceDate: r.occurrence_date });
                                }}
                                className="w-full text-left truncate text-[11px] px-1 py-0.5 rounded flex items-center gap-1 hover:opacity-80"
                                style={{
                                  backgroundColor: (r.type_color ?? "#9aae2f") + "30",
                                  color: r.type_color ?? "#5a6e10",
                                }}
                              >
                                <span
                                  className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                                  style={{ backgroundColor: r.type_color ?? "#9aae2f" }}
                                />
                                <span className="truncate">{r.title}</span>
                              </button>
                            ))}
                            {dayReminders.length > 3 && (
                              <span className="text-[10px] text-text-secondary pl-1">
                                +{dayReminders.length - 3} more
                              </span>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>

        {/* Detail / summary panel */}
        <div>
          {detail ? (
            <Card padding="md">
              <div className="flex items-start justify-between mb-3">
                <h2 className="text-sm font-semibold text-text-primary">Reminder Detail</h2>
                <button
                  onClick={() => setDetail(null)}
                  className="text-text-secondary hover:text-text-primary text-lg leading-none"
                >
                  ×
                </button>
              </div>
              <div className="space-y-2 text-sm">
                <div>
                  <p className="text-xs font-medium text-text-secondary uppercase tracking-wide">Title</p>
                  <p className="text-text-primary font-medium">{detail.reminder.title}</p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <p className="text-xs font-medium text-text-secondary uppercase tracking-wide">Date</p>
                    <p className="text-text-primary">{detail.occurrenceDate}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-text-secondary uppercase tracking-wide">Status</p>
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                      detail.reminder.status === "completed" ? "bg-green-100 text-green-700" :
                      detail.reminder.status === "in_progress" ? "bg-blue-100 text-blue-700" :
                      detail.reminder.status === "cancelled" ? "bg-red-100 text-red-600" :
                      "bg-gray-100 text-gray-600"
                    }`}>
                      {detail.reminder.status.replace("_", " ")}
                    </span>
                  </div>
                </div>
                {detail.reminder.account_name && (
                  <div>
                    <p className="text-xs font-medium text-text-secondary uppercase tracking-wide">Account</p>
                    <p className="text-text-primary">{detail.reminder.account_name}</p>
                  </div>
                )}
                {detail.reminder.program_name && (
                  <div>
                    <p className="text-xs font-medium text-text-secondary uppercase tracking-wide">Program</p>
                    <p className="text-text-primary">{detail.reminder.program_name}</p>
                  </div>
                )}
                {detail.reminder.type_name && (
                  <div>
                    <p className="text-xs font-medium text-text-secondary uppercase tracking-wide">Type</p>
                    <span
                      className="inline-block px-2 py-0.5 rounded-full text-xs font-medium text-white"
                      style={{ backgroundColor: detail.reminder.type_color ?? "#6b7280" }}
                    >
                      {detail.reminder.type_name}
                    </span>
                  </div>
                )}
                {detail.reminder.recurrence_rule && (
                  <div>
                    <p className="text-xs font-medium text-text-secondary uppercase tracking-wide">Recurrence</p>
                    <p className="text-text-primary">{detail.reminder.recurrence_rule.charAt(0) + detail.reminder.recurrence_rule.slice(1).toLowerCase()}</p>
                  </div>
                )}
                {detail.reminder.notes && (
                  <div>
                    <p className="text-xs font-medium text-text-secondary uppercase tracking-wide">Notes</p>
                    <p className="text-text-secondary">{detail.reminder.notes}</p>
                  </div>
                )}
                {detail.reminder.edit_count > 0 && (
                  <p className="text-xs text-text-secondary">Edited {detail.reminder.edit_count}×</p>
                )}
                <div className="pt-2">
                  <Button
                    onClick={() => router.push("/dashboard/reminders")}
                    variant="secondary"
                    size="sm"
                  >
                    Manage in List →
                  </Button>
                </div>
              </div>
            </Card>
          ) : (
            <Card padding="md">
              <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wide mb-3">
                This Month
              </h2>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-text-secondary">Total</span>
                  <span className="font-medium text-text-primary">{reminders.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-secondary">Completed</span>
                  <span className="font-medium text-green-600">
                    {reminders.filter(r => r.status === "completed").length}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-secondary">In Progress</span>
                  <span className="font-medium text-blue-600">
                    {reminders.filter(r => r.status === "in_progress").length}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-secondary">Open</span>
                  <span className="font-medium text-text-primary">
                    {reminders.filter(r => r.status === "open").length}
                  </span>
                </div>
                {reminders.length === 0 && !loading && (
                  <p className="text-text-secondary text-xs mt-2">
                    No reminders this month.{" "}
                    <button
                      onClick={() => router.push("/dashboard/reminders")}
                      className="text-brand hover:underline"
                    >
                      Add one →
                    </button>
                  </p>
                )}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

export default function CalendarPage() {
  return (
    <RoleGuard
      allowedRoles={["admin", "bdm"]}
      fallback={<p className="text-red-600">Access denied</p>}
    >
      <CalendarContent />
    </RoleGuard>
  );
}
