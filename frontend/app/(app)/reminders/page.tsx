"use client";

import { useAuth } from "@clerk/nextjs";
import { useEffect, useState } from "react";
import { getReminders, type ReminderRow, deleteReminder } from "@/lib/api";
import { TrashIcon, CheckCircleIcon } from "@heroicons/react/24/outline";

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
                    <button
                      onClick={() => handleDelete(r.id)}
                      className="text-rose-500/70 hover:text-rose-400 transition-colors"
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
