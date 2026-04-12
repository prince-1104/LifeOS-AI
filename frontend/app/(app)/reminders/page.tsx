"use client";

import { useAuth } from "@clerk/nextjs";
import { useEffect, useState } from "react";
import { getReminders, type ReminderRow } from "@/lib/api";

export default function RemindersPage() {
  const { getToken, isLoaded } = useAuth();
  const [items, setItems] = useState<ReminderRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoaded) return;
    getReminders(getToken)
      .then(setItems)
      .catch((e) =>
        setError(e instanceof Error ? e.message : "Could not load reminders."),
      );
  }, [isLoaded, getToken]);

  return (
    <div className="flex flex-1 flex-col">
      <div className="border-b border-white/[0.06] px-6 py-5 md:px-10">
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
        {items && items.length > 0 ? (
          <ul className="mx-auto flex max-w-2xl flex-col gap-3">
            {items.map((r) => (
              <li
                key={r.id}
                className="glass-panel flex flex-col gap-1 rounded-2xl px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium text-white">{r.task}</p>
                  <p className="text-xs capitalize text-slate-500">{r.status}</p>
                </div>
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
              </li>
            ))}
          </ul>
        ) : null}
        {!items && !error ? (
          <div className="glass-panel h-40 animate-pulse rounded-2xl bg-white/[0.02]" />
        ) : null}
      </div>
    </div>
  );
}
