"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useAuth } from "@clerk/nextjs";
import { getDueReminders, type ReminderRow } from "@/lib/api";

/**
 * Polls `/reminders/due` every 30 seconds and shows in-app toast
 * notifications for reminders that are past due.
 *
 * This serves as a reliable fallback when push notifications (OneSignal)
 * are blocked, unavailable, or the user hasn't subscribed.
 */
export default function ReminderToast() {
  const { getToken, isLoaded } = useAuth();
  const [toasts, setToasts] = useState<ReminderRow[]>([]);
  const dismissedIds = useRef<Set<string>>(new Set());
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const poll = useCallback(async () => {
    if (!isLoaded) return;
    try {
      const due = await getDueReminders(getToken);
      const fresh = due.filter((r) => !dismissedIds.current.has(r.id));
      if (fresh.length > 0) {
        setToasts((prev) => {
          const existing = new Set(prev.map((t) => t.id));
          const added = fresh.filter((t) => !existing.has(t.id));
          if (added.length > 0) {
            // Play a gentle notification sound
            try {
              audioRef.current?.play();
            } catch {
              /* user interaction required on some browsers */
            }
          }
          return [...prev, ...added];
        });
      }
    } catch {
      /* silent — polling is best-effort */
    }
  }, [isLoaded, getToken]);

  useEffect(() => {
    poll();
    const id = setInterval(poll, 30_000);
    return () => clearInterval(id);
  }, [poll]);

  const dismiss = (rid: string) => {
    dismissedIds.current.add(rid);
    setToasts((prev) => prev.filter((t) => t.id !== rid));
  };

  if (toasts.length === 0) return null;

  return (
    <>
      {/* Preload a short beep (data URI avoids external dependency) */}
      <audio
        ref={audioRef}
        src="data:audio/wav;base64,UklGRl9vT19teleUFMRQAAABkAASAAQAABAAAB..."
        preload="auto"
      />

      <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-3 max-w-sm">
        {toasts.map((r) => (
          <div
            key={r.id}
            role="alert"
            className="animate-slide-in glass-panel rounded-2xl border border-cyan-500/30 px-5 py-4 shadow-2xl shadow-cyan-500/10"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-lg" aria-hidden>⏰</span>
                <div>
                  <p className="font-semibold text-white text-sm">Reminder</p>
                  <p className="text-white/90 text-sm mt-0.5">{r.task}</p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    {new Date(r.reminder_time).toLocaleTimeString(undefined, {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              </div>
              <button
                onClick={() => dismiss(r.id)}
                className="text-slate-400 hover:text-white transition-colors text-lg leading-none mt-0.5"
                aria-label="Dismiss"
              >
                ×
              </button>
            </div>
          </div>
        ))}
      </div>

      <style jsx>{`
        @keyframes slide-in {
          from {
            opacity: 0;
            transform: translateX(100%) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translateX(0) scale(1);
          }
        }
        .animate-slide-in {
          animation: slide-in 0.35s cubic-bezier(0.16, 1, 0.3, 1) both;
        }
      `}</style>
    </>
  );
}
