"use client";

import { useState, useMemo } from "react";
import type { ReminderRow } from "@/lib/api";

/* ── helpers ──────────────────────────────────────────────────────── */

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function isToday(d: Date) {
  return isSameDay(d, new Date());
}

function getMonthGrid(year: number, month: number): (Date | null)[] {
  const first = new Date(year, month, 1);
  // week starts on Monday (0=Mon ... 6=Sun)
  let startDay = first.getDay() - 1;
  if (startDay < 0) startDay = 6;

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const grid: (Date | null)[] = [];

  for (let i = 0; i < startDay; i++) grid.push(null);
  for (let d = 1; d <= daysInMonth; d++) grid.push(new Date(year, month, d));
  // pad remaining cells to fill 6 rows
  while (grid.length % 7 !== 0) grid.push(null);

  return grid;
}

/* ── component ────────────────────────────────────────────────────── */

export default function ReminderCalendar({
  reminders,
  onDeleteReminder,
  onMarkDone,
}: {
  reminders: ReminderRow[];
  onDeleteReminder?: (id: string) => void;
  onMarkDone?: (id: string) => void;
}) {
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const grid = useMemo(() => getMonthGrid(viewYear, viewMonth), [viewYear, viewMonth]);

  // Map: "YYYY-MM-DD" → ReminderRow[]
  const remindersByDate = useMemo(() => {
    const map = new Map<string, ReminderRow[]>();
    for (const r of reminders) {
      const d = new Date(r.reminder_time);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(r);
    }
    return map;
  }, [reminders]);

  function dateKey(d: Date) {
    return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  }

  function remindersForDate(d: Date): ReminderRow[] {
    return remindersByDate.get(dateKey(d)) ?? [];
  }

  function prevMonth() {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(viewYear - 1);
    } else {
      setViewMonth(viewMonth - 1);
    }
    setSelectedDate(null);
  }

  function nextMonth() {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(viewYear + 1);
    } else {
      setViewMonth(viewMonth + 1);
    }
    setSelectedDate(null);
  }

  function goToToday() {
    setViewYear(today.getFullYear());
    setViewMonth(today.getMonth());
    setSelectedDate(today);
  }

  const selectedReminders = selectedDate ? remindersForDate(selectedDate) : [];

  // Count reminders this month
  const monthReminderCount = useMemo(() => {
    return reminders.filter((r) => {
      const d = new Date(r.reminder_time);
      return d.getFullYear() === viewYear && d.getMonth() === viewMonth;
    }).length;
  }, [reminders, viewYear, viewMonth]);

  return (
    <div className="mx-auto max-w-2xl">
      {/* Calendar card */}
      <div className="glass-panel rounded-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
          <button
            onClick={prevMonth}
            className="group flex h-9 w-9 items-center justify-center rounded-xl bg-white/[0.04] text-slate-400 transition-all hover:bg-white/[0.08] hover:text-white active:scale-95"
            aria-label="Previous month"
          >
            <svg className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </button>

          <div className="text-center">
            <button
              onClick={goToToday}
              className="group flex flex-col items-center gap-0.5"
              title="Go to today"
            >
              <span className="text-base font-semibold text-white tracking-tight group-hover:text-indigo-300 transition-colors">
                {MONTH_NAMES[viewMonth]} {viewYear}
              </span>
              <span className="text-[10px] font-medium uppercase tracking-widest text-slate-500">
                {monthReminderCount} {monthReminderCount === 1 ? "reminder" : "reminders"}
              </span>
            </button>
          </div>

          <button
            onClick={nextMonth}
            className="group flex h-9 w-9 items-center justify-center rounded-xl bg-white/[0.04] text-slate-400 transition-all hover:bg-white/[0.08] hover:text-white active:scale-95"
            aria-label="Next month"
          >
            <svg className="h-4 w-4 transition-transform group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </button>
        </div>

        {/* Day labels */}
        <div className="grid grid-cols-7 px-3 pt-3 pb-1">
          {DAY_LABELS.map((d) => (
            <div
              key={d}
              className="text-center text-[10px] font-semibold uppercase tracking-widest text-slate-500/70 py-1"
            >
              {d}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-[1px] px-3 pb-3">
          {grid.map((date, i) => {
            if (!date) {
              return <div key={`empty-${i}`} className="aspect-square" />;
            }

            const dayReminders = remindersForDate(date);
            const hasReminders = dayReminders.length > 0;
            const isPending = dayReminders.some((r) => r.status === "pending");
            const isSelected = selectedDate && isSameDay(date, selectedDate);
            const isTodayDate = isToday(date);
            const isCurrentMonth = date.getMonth() === viewMonth;

            return (
              <button
                key={date.toISOString()}
                onClick={() => setSelectedDate(isSelected ? null : date)}
                className={`
                  relative aspect-square flex flex-col items-center justify-center rounded-xl
                  text-sm font-medium transition-all duration-200
                  ${isSelected
                    ? "bg-indigo-500/20 text-indigo-200 ring-1 ring-indigo-500/40 scale-105"
                    : isTodayDate
                      ? "bg-white/[0.06] text-white ring-1 ring-white/[0.12]"
                      : isCurrentMonth
                        ? "text-slate-300 hover:bg-white/[0.05] hover:text-white"
                        : "text-slate-600"
                  }
                  ${hasReminders && !isSelected ? "hover:scale-105" : ""}
                  active:scale-95
                `}
              >
                <span className={isTodayDate && !isSelected ? "text-indigo-400 font-bold" : ""}>
                  {date.getDate()}
                </span>

                {/* Dots for reminders */}
                {hasReminders ? (
                  <div className="absolute bottom-1 flex gap-0.5">
                    {dayReminders.length <= 3 ? (
                      dayReminders.map((r, j) => (
                        <span
                          key={j}
                          className={`
                            block h-1 w-1 rounded-full
                            ${r.status === "done"
                              ? "bg-emerald-500/60"
                              : "bg-cyan-400 shadow-[0_0_4px_rgba(34,211,238,0.5)]"
                            }
                          `}
                        />
                      ))
                    ) : (
                      <>
                        <span className={`block h-1 w-1 rounded-full ${isPending ? "bg-cyan-400 shadow-[0_0_4px_rgba(34,211,238,0.5)]" : "bg-emerald-500/60"}`} />
                        <span className="text-[7px] font-bold text-cyan-400/80 leading-none">
                          +{dayReminders.length - 1}
                        </span>
                      </>
                    )}
                  </div>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected date panel */}
      {selectedDate ? (
        <div className="mt-4 animate-message-in">
          <div className="glass-panel rounded-2xl overflow-hidden">
            <div className="flex items-center gap-3 px-5 py-3 border-b border-white/[0.06]">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/15 text-indigo-300">
                <span className="text-lg font-bold">{selectedDate.getDate()}</span>
              </div>
              <div>
                <p className="text-sm font-semibold text-white">
                  {selectedDate.toLocaleDateString(undefined, {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}
                </p>
                <p className="text-[11px] text-slate-500">
                  {selectedReminders.length === 0
                    ? "No reminders"
                    : `${selectedReminders.length} ${selectedReminders.length === 1 ? "reminder" : "reminders"}`}
                </p>
              </div>
              <button
                onClick={() => setSelectedDate(null)}
                className="ml-auto p-1.5 text-slate-500 hover:text-white transition-colors rounded-lg hover:bg-white/[0.05]"
                aria-label="Close"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {selectedReminders.length === 0 ? (
              <div className="px-5 py-8 text-center">
                <p className="text-slate-400 text-sm">No reminders on this day.</p>
                <p className="mt-1 text-xs text-slate-600">
                  Tell the assistant: &quot;remind me on {selectedDate.toLocaleDateString(undefined, { month: "short", day: "numeric" })} to...&quot;
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-white/[0.04]">
                {selectedReminders
                  .sort((a, b) => new Date(a.reminder_time).getTime() - new Date(b.reminder_time).getTime())
                  .map((r) => {
                    const isPending = r.status === "pending";
                    return (
                      <li
                        key={r.id}
                        className={`flex items-center gap-3 px-5 py-3 transition-colors ${
                          isPending ? "hover:bg-white/[0.02]" : "opacity-50"
                        }`}
                      >
                        {/* Status indicator */}
                        <div
                          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                            isPending
                              ? "bg-cyan-500/10 text-cyan-400"
                              : "bg-emerald-500/10 text-emerald-500"
                          }`}
                        >
                          {isPending ? (
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          ) : (
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                            </svg>
                          )}
                        </div>

                        {/* Task info */}
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-medium truncate ${isPending ? "text-white" : "text-white/60 line-through"}`}>
                            {r.task}
                          </p>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            {new Date(r.reminder_time).toLocaleTimeString(undefined, {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                            {isPending ? (
                              <span className="ml-2 text-cyan-500/70">Pending</span>
                            ) : (
                              <span className="ml-2 text-emerald-500/50">Done</span>
                            )}
                          </p>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1 shrink-0">
                          {isPending && onMarkDone ? (
                            <button
                              onClick={() => onMarkDone(r.id)}
                              className="p-1.5 rounded-lg text-cyan-500/60 hover:text-cyan-400 hover:bg-cyan-500/10 transition-all"
                              title="Mark complete"
                            >
                              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                              </svg>
                            </button>
                          ) : null}
                          {onDeleteReminder ? (
                            <button
                              onClick={() => onDeleteReminder(r.id)}
                              className="p-1.5 rounded-lg text-rose-500/50 hover:text-rose-400 hover:bg-rose-500/10 transition-all"
                              title="Delete"
                            >
                              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                              </svg>
                            </button>
                          ) : null}
                        </div>
                      </li>
                    );
                  })}
              </ul>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
