"use client";

import { useAuth } from "@clerk/nextjs";
import { useEffect, useState } from "react";
import { getMemories, type MemoryRow } from "@/lib/api";

export default function MemoriesPage() {
  const { getToken, isLoaded } = useAuth();
  const [items, setItems] = useState<MemoryRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoaded) return;
    getMemories(getToken)
      .then(setItems)
      .catch((e) =>
        setError(e instanceof Error ? e.message : "Could not load memories."),
      );
  }, [isLoaded, getToken]);

  return (
    <div className="flex flex-1 flex-col">
      <div className="border-b border-white/[0.06] px-6 py-5 md:px-10">
        <h1 className="text-xl font-semibold tracking-tight text-white">
          Memories
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Facts and notes your assistant has stored for you.
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
            <p className="text-slate-300">No memories stored yet.</p>
            <p className="mt-2 text-sm text-slate-500">
              Share preferences, goals, or facts in Chat — for example:
              &quot;Remember that I prefer morning workouts.&quot;
            </p>
          </div>
        ) : null}
        {items && items.length > 0 ? (
          <ul className="mx-auto flex max-w-3xl flex-col gap-4">
            {items.map((m) => (
              <li key={m.id} className="glass-panel rounded-2xl px-5 py-4">
                <p className="text-[15px] leading-relaxed text-slate-200">
                  {m.content}
                </p>
                {m.tags.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {m.tags.map((t) => (
                      <span
                        key={t}
                        className="rounded-md bg-white/[0.05] px-2 py-0.5 text-xs text-slate-400"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                ) : null}
                <time
                  className="mt-3 block text-xs text-slate-600"
                  dateTime={m.created_at}
                >
                  {new Date(m.created_at).toLocaleString()}
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
