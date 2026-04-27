"use client";

import { useAuth } from "@clerk/nextjs";
import { useEffect, useState } from "react";
import { getReminders, type ReminderRow, deleteReminder, markReminderDone } from "@/lib/api";
import { TrashIcon, CheckCircleIcon, CheckIcon } from "@heroicons/react/24/outline";
import ReminderCalendar from "@/components/ReminderCalendar";

export default function RemindersPage() {
  const { getToken, isLoaded } = useAuth();
  const [items, setItems] = useState<ReminderRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchItems = () => {
    if (!isLoaded) return;
    getReminders(getToken)
      .then(setItems)
      .catch((e) =>
        setError(e instanceof Error ? e.message : "Could not load reminders."),
      );
  };

  useEffect(() => {
    fetchItems();
  }, [isLoaded, getToken]);

  const handleDelete = async (id: string) => {
    try {
      await deleteReminder(getToken, id);
      fetchItems();
    } catch (e) {
      alert("Failed to delete reminder.");
    }
  };

  const handleMarkDone = async (id: string) => {
    try {
      await markReminderDone(getToken, id);
      fetchItems();
    } catch (e) {
      alert("Failed to mark reminder as done.");
    }
  };

  const pendingItems = items?.filter((r) => r.status === "pending") ?? [];
  const doneItems = items?.filter((r) => r.status === "done") ?? [];

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-b border-white/[0.06] px-6 py-5 md:px-10 shrink-0">
        <h1 className="text-xl font-semibold tracking-tight text-white">
          Reminders
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Upcoming tasks you have set through chat.
        </p>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-6 md:px-10">
        {error ? (
          <div className="glass-panel rounded-2xl border border-rose-500/20 px-4 py-3 text-sm text-rose-200">
            {error}
          </div>
        ) : null}

        {/* ── Calendar View (shown first, above reminders) ─────────── */}
        {items ? (
          <div id="calendar" className="mx-auto max-w-2xl mb-8 scroll-mt-6">
            <h2 className="text-xs font-medium uppercase tracking-widest text-slate-500 mb-4 flex items-center gap-2">
              <svg className="h-4 w-4 text-indigo-400/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
              </svg>
              Calendar
            </h2>
            <ReminderCalendar
              reminders={items}
              onDeleteReminder={handleDelete}
              onMarkDone={handleMarkDone}
            />
          </div>
        ) : null}

        {items && items.length === 0 ? (
          <div className="glass-panel mx-auto max-w-lg rounded-2xl px-6 py-10 text-center">
            <p className="text-slate-300">No reminders yet.</p>
            <p className="mt-2 text-sm text-slate-500">
              Tell the assistant in Chat to remind you — for example: &quot;Remind
              me to call home at 6pm.&quot;
            </p>
          </div>
        ) : null}

        {/* Pending reminders */}
        {pendingItems.length > 0 ? (
          <div className="mx-auto max-w-2xl">
            <h2 className="text-xs font-medium uppercase tracking-widest text-slate-500 mb-3">
              Upcoming
            </h2>
            <ul className="flex flex-col gap-3">
              {pendingItems.map((r) => (
                <li
                  key={r.id}
                  className="glass-panel flex flex-col gap-1 rounded-2xl px-5 py-4 sm:flex-row sm:items-center sm:justify-between border border-cyan-500/10"
                >
                  <div>
                    <p className="font-medium text-white">{r.task}</p>
                    <p className="text-xs text-cyan-400/70 mt-0.5">Pending</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <time
                      className="text-sm text-slate-400"
                      dateTime={r.reminder_time}
                    >
                      {new Date(r.reminder_time).toLocaleString(undefined, {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </time>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleMarkDone(r.id)}
                        className="p-1.5 text-cyan-500/70 hover:text-cyan-400 transition-colors"
                        title="Mark complete"
                      >
                        <CheckIcon className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => handleDelete(r.id)}
                        className="p-1.5 text-rose-500/70 hover:text-rose-400 transition-colors"
                        title="Delete reminder"
                      >
                        <TrashIcon className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {/* Completed reminders */}
        {doneItems.length > 0 ? (
          <div className="mx-auto max-w-2xl mt-8">
            <h2 className="text-xs font-medium uppercase tracking-widest text-slate-500 mb-3">
              Completed
            </h2>
            <ul className="flex flex-col gap-3">
              {doneItems.map((r) => (
                <li
                  key={r.id}
                  className="glass-panel flex flex-col gap-1 rounded-2xl px-5 py-4 opacity-60 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex items-center gap-2">
                    <CheckCircleIcon className="w-5 h-5 text-emerald-500/60 shrink-0" />
                    <div>
                      <p className="font-medium text-white/70 line-through">
                        {r.task}
                      </p>
                      <p className="text-xs text-emerald-500/50 mt-0.5">Done</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <time
                      className="text-sm text-slate-500"
                      dateTime={r.reminder_time}
                    >
                      {new Date(r.reminder_time).toLocaleString(undefined, {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </time>
                    <button
                      onClick={() => handleDelete(r.id)}
                      className="text-rose-500/50 hover:text-rose-400 transition-colors"
                      title="Delete reminder"
                    >
                      <TrashIcon className="w-5 h-5" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {!items && !error ? (
          <div className="glass-panel h-40 animate-pulse rounded-2xl bg-white/[0.02]" />
        ) : null}
      </div>
    </div>
  );
}
