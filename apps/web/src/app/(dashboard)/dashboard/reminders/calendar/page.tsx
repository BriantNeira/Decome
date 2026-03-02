"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { RoleGuard } from "@/components/layout/RoleGuard";
import { Button } from "@/components/ui/Button";
import api from "@/lib/api";
import { CalendarReminder } from "@/types/masterdata";

// ─── Types ─────────────────────────────────────────────────────────────────
type ViewType = "month" | "week";

// ─── Constants ─────────────────────────────────────────────────────────────
const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];
const DAY_SHORT = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

// ─── Helpers ───────────────────────────────────────────────────────────────
function isoDate(y: number, m: number, d: number) {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function getMonthCells(year: number, month: number): (number | null)[] {
  const firstDay = new Date(year, month - 1, 1).getDay();
  const days = new Date(year, month, 0).getDate();
  const offset = (firstDay + 6) % 7; // make Monday = 0
  const cells: (number | null)[] = Array(offset).fill(null);
  for (let d = 1; d <= days; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function getWeekMonday(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
  return d;
}

function getWeekDays(monday: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

function hourLabel(h: number) {
  if (h === 0) return "";
  if (h < 12) return `${h} AM`;
  if (h === 12) return "12 PM";
  return `${h - 12} PM`;
}

// ─── Detail type ────────────────────────────────────────────────────────────
interface Detail {
  reminder: CalendarReminder;
  occurrenceDate: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════
function CalendarContent() {
  const router = useRouter();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().slice(0, 10);

  const [view, setView] = useState<ViewType>("month");
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [weekStart, setWeekStart] = useState(getWeekMonday(today));
  const [reminders, setReminders] = useState<CalendarReminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<Detail | null>(null);

  // ── Data fetching ─────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (view === "month") {
        const r = await api.get<CalendarReminder[]>(
          `/reminders/calendar?year=${year}&month=${month}`
        );
        setReminders(r.data);
      } else {
        const days = getWeekDays(weekStart);
        const y1 = weekStart.getFullYear();
        const m1 = weekStart.getMonth() + 1;
        const y2 = days[6].getFullYear();
        const m2 = days[6].getMonth() + 1;
        const r1 = await api.get<CalendarReminder[]>(
          `/reminders/calendar?year=${y1}&month=${m1}`
        );
        if (m1 !== m2 || y1 !== y2) {
          const r2 = await api.get<CalendarReminder[]>(
            `/reminders/calendar?year=${y2}&month=${m2}`
          );
          setReminders([...r1.data, ...r2.data]);
        } else {
          setReminders(r1.data);
        }
      }
    } catch {
      setReminders([]);
    } finally {
      setLoading(false);
    }
  }, [view, year, month, weekStart]);

  useEffect(() => { load(); }, [load]);

  // ── Navigation ────────────────────────────────────────────────────────
  function prev() {
    setDetail(null);
    if (view === "month") {
      if (month === 1) { setYear(y => y - 1); setMonth(12); }
      else setMonth(m => m - 1);
    } else {
      setWeekStart(d => { const n = new Date(d); n.setDate(d.getDate() - 7); return n; });
    }
  }

  function next() {
    setDetail(null);
    if (view === "month") {
      if (month === 12) { setYear(y => y + 1); setMonth(1); }
      else setMonth(m => m + 1);
    } else {
      setWeekStart(d => { const n = new Date(d); n.setDate(d.getDate() + 7); return n; });
    }
  }

  function goToday() {
    setDetail(null);
    setYear(today.getFullYear());
    setMonth(today.getMonth() + 1);
    setWeekStart(getWeekMonday(today));
  }

  function switchView(v: ViewType) {
    setDetail(null);
    setView(v);
    if (v === "week") {
      const pivot =
        year === today.getFullYear() && month === today.getMonth() + 1
          ? today
          : new Date(year, month - 1, 1);
      setWeekStart(getWeekMonday(pivot));
    } else {
      setYear(weekStart.getFullYear());
      setMonth(weekStart.getMonth() + 1);
    }
  }

  // ── Build lookup: occurrence_date → reminders[] ─────────────────────
  const seen = new Set<string>();
  const deduped = reminders.filter(r => {
    const k = `${r.id}|${r.occurrence_date}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  const byDate: Record<string, CalendarReminder[]> = {};
  for (const r of deduped) {
    (byDate[r.occurrence_date] ??= []).push(r);
  }

  // ── Header title ──────────────────────────────────────────────────────
  const weekDays = getWeekDays(weekStart);
  const title =
    view === "month"
      ? `${MONTH_NAMES[month - 1]} ${year}`
      : weekStart.getMonth() === weekDays[6].getMonth()
      ? `${MONTH_NAMES[weekStart.getMonth()]} ${weekStart.getDate()}–${weekDays[6].getDate()}, ${weekStart.getFullYear()}`
      : `${MONTH_NAMES[weekStart.getMonth()]} ${weekStart.getDate()} – ${MONTH_NAMES[weekDays[6].getMonth()]} ${weekDays[6].getDate()}`;

  return (
    <div className="flex flex-col gap-0" style={{ height: "calc(100vh - 110px)" }}>

      {/* ── Toolbar ─────────────────────────────────────────────────── */}
      <div className="flex items-center gap-1 sm:gap-2 pb-3 border-b border-border flex-shrink-0">
        {/* Prev / Next */}
        <button
          onClick={prev}
          className="w-8 h-8 flex items-center justify-center rounded-full text-text-secondary hover:bg-surface-hover transition-colors"
          aria-label="Previous"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <button
          onClick={next}
          className="w-8 h-8 flex items-center justify-center rounded-full text-text-secondary hover:bg-surface-hover transition-colors"
          aria-label="Next"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>

        {/* Title */}
        <h1 className="text-lg sm:text-xl font-normal text-text-primary ml-1 min-w-0 truncate">
          {title}
        </h1>

        {/* Today */}
        <button
          onClick={goToday}
          className="ml-1 px-3 py-1 rounded-full border border-border text-sm font-medium text-text-primary hover:bg-surface-hover transition-colors whitespace-nowrap"
        >
          Today
        </button>

        <div className="flex-1" />

        {/* Month / Week toggle */}
        <div className="flex rounded-lg border border-border overflow-hidden text-sm">
          {(["month", "week"] as ViewType[]).map((v, i) => (
            <button
              key={v}
              onClick={() => switchView(v)}
              className={`px-3 sm:px-4 py-1.5 font-medium capitalize transition-colors ${
                i > 0 ? "border-l border-border" : ""
              } ${
                view === v
                  ? "bg-sidebar-active text-white"
                  : "text-text-secondary hover:bg-surface-hover"
              }`}
            >
              {v}
            </button>
          ))}
        </div>

        {/* Add Reminder */}
        <Button
          onClick={() => router.push("/dashboard/reminders")}
          variant="primary"
          size="sm"
        >
          + Add Reminder
        </Button>
      </div>

      {/* ── Calendar body ─────────────────────────────────────────────── */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center text-text-secondary text-sm">
          Loading…
        </div>
      ) : (
        <div className="flex flex-1 overflow-hidden border border-border rounded-xl mt-3">
          {view === "month" ? (
            <MonthGrid
              year={year}
              month={month}
              todayStr={todayStr}
              byDate={byDate}
              detail={detail}
              setDetail={setDetail}
              reminders={deduped}
              router={router}
            />
          ) : (
            <WeekGrid
              weekDays={weekDays}
              todayStr={todayStr}
              byDate={byDate}
              detail={detail}
              setDetail={setDetail}
              reminders={deduped}
              router={router}
            />
          )}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MONTH GRID
// ═══════════════════════════════════════════════════════════════════════════
function MonthGrid({
  year, month, todayStr, byDate, detail, setDetail, reminders, router,
}: {
  year: number; month: number; todayStr: string;
  byDate: Record<string, CalendarReminder[]>;
  detail: Detail | null; setDetail: (d: Detail | null) => void;
  reminders: CalendarReminder[]; router: ReturnType<typeof useRouter>;
}) {
  const cells = getMonthCells(year, month);
  const weeks = cells.length / 7;

  return (
    <div className="flex flex-1 min-w-0 overflow-hidden">
      {/* ── Grid ── */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {/* Day-of-week headers */}
        <div className="grid grid-cols-7 border-b border-border bg-background flex-shrink-0">
          {DAY_SHORT.map(d => (
            <div
              key={d}
              className="py-2 text-center text-[11px] font-semibold text-text-secondary uppercase tracking-widest"
            >
              {d}
            </div>
          ))}
        </div>

        {/* Cells */}
        <div
          className="grid grid-cols-7 flex-1 overflow-hidden"
          style={{ gridTemplateRows: `repeat(${weeks}, minmax(0, 1fr))` }}
        >
          {cells.map((day, idx) => {
            const ds = day ? isoDate(year, month, day) : null;
            const rs: CalendarReminder[] = ds ? (byDate[ds] ?? []) : [];
            const isToday = ds === todayStr;
            const isWeekend = idx % 7 >= 5;
            const isLastCol = idx % 7 === 6;

            return (
              <div
                key={idx}
                onClick={() => ds && router.push(`/dashboard/reminders?date=${ds}`)}
                className={[
                  "border-r border-b border-border flex flex-col overflow-hidden transition-colors",
                  isLastCol ? "border-r-0" : "",
                  !day
                    ? "bg-gray-50 dark:bg-gray-900/20"
                    : isWeekend
                    ? "bg-gray-50/40 dark:bg-gray-900/10 hover:bg-surface-hover/60 cursor-pointer"
                    : "hover:bg-surface-hover/40 cursor-pointer",
                ].join(" ")}
              >
                {day && (
                  <>
                    {/* Day number */}
                    <div className="pt-1.5 px-1.5 flex-shrink-0">
                      <span
                        className={[
                          "inline-flex w-7 h-7 items-center justify-center rounded-full text-sm font-medium transition-colors",
                          isToday
                            ? "bg-sidebar-active text-white"
                            : "text-text-secondary",
                        ].join(" ")}
                      >
                        {day}
                      </span>
                    </div>

                    {/* Events */}
                    <div className="px-1 pb-1 flex-1 overflow-hidden space-y-px">
                      {rs.slice(0, 3).map((r, i) => (
                        <button
                          key={`${r.id}-${i}`}
                          onClick={e => {
                            e.stopPropagation();
                            setDetail({ reminder: r, occurrenceDate: r.occurrence_date });
                          }}
                          className="w-full text-left text-[11px] px-1.5 py-[2px] rounded font-medium truncate block hover:opacity-75 transition-opacity"
                          style={{
                            background: `${r.type_color ?? "#9aae2f"}22`,
                            color: r.type_color ?? "#5a6e10",
                            borderLeft: `3px solid ${r.type_color ?? "#9aae2f"}`,
                          }}
                        >
                          {r.title}
                        </button>
                      ))}
                      {rs.length > 3 && (
                        <p className="text-[10px] text-text-secondary px-1.5 py-px">
                          +{rs.length - 3} more
                        </p>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Right panel ── */}
      <div className="w-60 xl:w-64 border-l border-border flex-shrink-0 overflow-y-auto p-4 bg-background">
        {detail ? (
          <ReminderDetail detail={detail} setDetail={setDetail} router={router} />
        ) : (
          <PeriodSummary label="This Month" items={reminders} router={router} />
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// WEEK GRID
// ═══════════════════════════════════════════════════════════════════════════
function WeekGrid({
  weekDays, todayStr, byDate, detail, setDetail, reminders, router,
}: {
  weekDays: Date[]; todayStr: string;
  byDate: Record<string, CalendarReminder[]>;
  detail: Detail | null; setDetail: (d: Detail | null) => void;
  reminders: CalendarReminder[]; router: ReturnType<typeof useRouter>;
}) {
  const TIME_COL = "52px";
  const GRID = `${TIME_COL} repeat(7, minmax(0, 1fr))`;

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* ── Week columns ── */}
      <div className="flex flex-col flex-1 overflow-hidden">

        {/* Day headers */}
        <div
          className="grid border-b border-border flex-shrink-0 bg-background"
          style={{ gridTemplateColumns: GRID }}
        >
          <div className="border-r border-border" />
          {weekDays.map((d, i) => {
            const ds = d.toISOString().slice(0, 10);
            const isToday = ds === todayStr;
            return (
              <div
                key={i}
                className="py-2 text-center border-r border-border last:border-r-0"
              >
                <p className="text-[11px] font-semibold text-text-secondary uppercase tracking-widest">
                  {DAY_SHORT[i]}
                </p>
                <p
                  className={[
                    "mx-auto mt-1 w-9 h-9 flex items-center justify-center rounded-full text-xl font-light",
                    isToday
                      ? "bg-sidebar-active text-white"
                      : "text-text-primary hover:bg-surface-hover transition-colors",
                  ].join(" ")}
                >
                  {d.getDate()}
                </p>
              </div>
            );
          })}
        </div>

        {/* All-day event row */}
        <div
          className="grid border-b border-border flex-shrink-0 bg-background"
          style={{ gridTemplateColumns: GRID }}
        >
          <div className="border-r border-border flex items-center justify-end pr-2 py-1">
            <span className="text-[10px] text-text-secondary">all‑day</span>
          </div>
          {weekDays.map((d, i) => {
            const ds = d.toISOString().slice(0, 10);
            const rs: CalendarReminder[] = byDate[ds] ?? [];
            return (
              <div
                key={i}
                className="border-r border-border last:border-r-0 p-1 min-h-[44px] space-y-px"
              >
                {rs.map((r, ri) => (
                  <button
                    key={`${r.id}-${ri}`}
                    onClick={() => setDetail({ reminder: r, occurrenceDate: r.occurrence_date })}
                    className="w-full text-left text-[11px] px-1.5 py-[3px] rounded font-medium truncate block hover:opacity-75 transition-opacity"
                    style={{
                      background: `${r.type_color ?? "#9aae2f"}22`,
                      color: r.type_color ?? "#5a6e10",
                      borderLeft: `3px solid ${r.type_color ?? "#9aae2f"}`,
                    }}
                  >
                    {r.title}
                  </button>
                ))}
              </div>
            );
          })}
        </div>

        {/* Hourly time grid — scrollable */}
        <div className="flex-1 overflow-y-auto">
          {HOURS.map(h => (
            <div
              key={h}
              className="grid"
              style={{ gridTemplateColumns: GRID, height: "52px" }}
            >
              {/* Time label */}
              <div className="border-r border-border flex items-start justify-end pr-2 -mt-[11px]">
                {h > 0 && (
                  <span className="text-[10px] text-text-secondary whitespace-nowrap">
                    {hourLabel(h)}
                  </span>
                )}
              </div>
              {/* Day columns */}
              {weekDays.map((_, i) => (
                <div
                  key={i}
                  className="border-r border-b border-border last:border-r-0 hover:bg-surface-hover/30 transition-colors"
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* ── Right panel ── */}
      <div className="w-60 xl:w-64 border-l border-border flex-shrink-0 overflow-y-auto p-4 bg-background">
        {detail ? (
          <ReminderDetail detail={detail} setDetail={setDetail} router={router} />
        ) : (
          <PeriodSummary
            label="This Week"
            items={reminders.filter(r =>
              weekDays.some(d => d.toISOString().slice(0, 10) === r.occurrence_date)
            )}
            router={router}
          />
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// DETAIL PANEL
// ═══════════════════════════════════════════════════════════════════════════
function ReminderDetail({
  detail, setDetail, router,
}: {
  detail: Detail;
  setDetail: (d: Detail | null) => void;
  router: ReturnType<typeof useRouter>;
}) {
  const r = detail.reminder;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-text-primary">Details</h2>
        <button
          onClick={() => setDetail(null)}
          className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-surface-hover text-text-secondary transition-colors"
          aria-label="Close"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Color bar */}
      <div
        className="h-1 rounded-full mb-4"
        style={{ backgroundColor: r.type_color ?? "#9aae2f" }}
      />

      {/* Title */}
      <p className="font-semibold text-text-primary text-sm leading-snug mb-4">{r.title}</p>

      {/* Info rows */}
      <div className="space-y-2.5 text-xs">
        <DetailRow icon={
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        }>
          {detail.occurrenceDate}
        </DetailRow>

        {r.account_name && (
          <DetailRow icon={
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-2 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          }>
            {r.account_name}
          </DetailRow>
        )}

        {r.program_name && (
          <DetailRow icon={
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          }>
            {r.program_name}
          </DetailRow>
        )}

        {r.type_name && (
          <div className="flex items-center gap-2 text-text-secondary">
            <span
              className="w-3 h-3 rounded-full flex-shrink-0"
              style={{ backgroundColor: r.type_color ?? "#9aae2f" }}
            />
            <span className="text-text-primary">{r.type_name}</span>
          </div>
        )}

        {r.recurrence_rule && (
          <DetailRow icon={
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          }>
            {r.recurrence_rule.charAt(0) + r.recurrence_rule.slice(1).toLowerCase()}
          </DetailRow>
        )}

        {/* Status */}
        <div className="pt-1 flex items-center gap-2 flex-wrap">
          <span className={[
            "inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium",
            r.status === "completed"  ? "bg-green-100 text-green-700" :
            r.status === "in_progress"? "bg-blue-100 text-blue-700"  :
            r.status === "cancelled"  ? "bg-red-100 text-red-600"    :
            "bg-gray-100 text-gray-600",
          ].join(" ")}>
            {r.status.replace("_", " ")}
          </span>
          {r.edit_count > 0 && (
            <span className="text-[11px] text-text-secondary">
              edited {r.edit_count}×
            </span>
          )}
        </div>

        {/* Notes */}
        {r.notes && (
          <p
            className="text-text-secondary italic border-l-2 pl-2 mt-1"
            style={{ borderColor: r.type_color ?? "#9aae2f" }}
          >
            {r.notes}
          </p>
        )}
      </div>

      {/* Action */}
      <button
        onClick={() => router.push("/dashboard/reminders")}
        className="mt-5 w-full text-center text-xs font-semibold text-sidebar-active hover:underline py-1"
      >
        Manage in list →
      </button>
    </div>
  );
}

function DetailRow({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <div className="flex items-start gap-2 text-text-secondary">
      <span className="flex-shrink-0 mt-px">{icon}</span>
      <span className="text-text-primary">{children}</span>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// PERIOD SUMMARY (shown when no detail is selected)
// ═══════════════════════════════════════════════════════════════════════════
function PeriodSummary({
  label, items, router,
}: {
  label: string;
  items: CalendarReminder[];
  router: ReturnType<typeof useRouter>;
}) {
  const counts = [
    { l: "Total",       n: items.length,                                           c: "text-text-primary" },
    { l: "Completed",   n: items.filter(r => r.status === "completed").length,     c: "text-green-600"    },
    { l: "In Progress", n: items.filter(r => r.status === "in_progress").length,   c: "text-blue-600"     },
    { l: "Open",        n: items.filter(r => r.status === "open").length,          c: "text-text-secondary" },
  ];

  return (
    <div>
      <h2 className="text-[11px] font-semibold uppercase tracking-widest text-text-secondary mb-4">
        {label}
      </h2>
      <div className="space-y-1">
        {counts.map(({ l, n, c }) => (
          <div key={l} className="flex items-center justify-between py-1.5 border-b border-border/50 last:border-0">
            <span className="text-xs text-text-secondary">{l}</span>
            <span className={`text-base font-bold ${c}`}>{n}</span>
          </div>
        ))}
      </div>

      {items.length === 0 && (
        <p className="text-xs text-text-secondary mt-5">
          No reminders yet.{" "}
          <button
            onClick={() => router.push("/dashboard/reminders")}
            className="text-sidebar-active hover:underline font-medium"
          >
            Add one →
          </button>
        </p>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// PAGE EXPORT
// ═══════════════════════════════════════════════════════════════════════════
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
