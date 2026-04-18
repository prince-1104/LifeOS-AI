"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useAuth } from "@clerk/nextjs";
import { getDueReminders, markReminderDone, type ReminderRow } from "@/lib/api";

/**
 * Generate a rich, longer notification melody using the Web Audio API.
 * A warm two-phrase arpeggio (~3 seconds) that sounds like a premium phone alarm.
 */
function playNotificationSound() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();

    const playNote = (
      freq: number,
      startTime: number,
      duration: number,
      volume: number = 0.2,
    ) => {
      // Sine layer — warm fundamental
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = "sine";
      osc1.frequency.setValueAtTime(freq, startTime);
      gain1.gain.setValueAtTime(0, startTime);
      gain1.gain.linearRampToValueAtTime(volume, startTime + 0.04);
      gain1.gain.setValueAtTime(volume, startTime + duration * 0.6);
      gain1.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(startTime);
      osc1.stop(startTime + duration);

      // Triangle layer — adds shimmer / bell character
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = "triangle";
      osc2.frequency.setValueAtTime(freq * 2, startTime); // octave up
      gain2.gain.setValueAtTime(0, startTime);
      gain2.gain.linearRampToValueAtTime(volume * 0.3, startTime + 0.04);
      gain2.gain.exponentialRampToValueAtTime(0.001, startTime + duration * 0.7);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(startTime);
      osc2.stop(startTime + duration);
    };

    const t = ctx.currentTime;

    // ── Phrase 1: ascending arpeggio ──────────────────
    playNote(523.25, t + 0.0, 0.4, 0.2);   // C5
    playNote(587.33, t + 0.2, 0.4, 0.2);   // D5
    playNote(659.25, t + 0.4, 0.4, 0.22);  // E5
    playNote(783.99, t + 0.6, 0.5, 0.24);  // G5

    // ── Brief pause, then Phrase 2: higher resolve ───
    playNote(659.25, t + 1.2, 0.35, 0.18); // E5
    playNote(783.99, t + 1.4, 0.35, 0.2);  // G5
    playNote(880.0, t + 1.6, 0.4, 0.22);   // A5
    playNote(1046.5, t + 1.85, 0.7, 0.25); // C6 (resolve, longer)

    // ── Gentle tail echo ─────────────────────────────
    playNote(783.99, t + 2.5, 0.5, 0.1);   // G5 (soft echo)
    playNote(1046.5, t + 2.7, 0.8, 0.12);  // C6 (soft echo, fade)

    // Clean up after melody finishes
    setTimeout(() => ctx.close(), 5000);
  } catch {
    /* Web Audio not available — silent fallback */
  }
}

/**
 * Polls `/reminders/due` every 30s and shows a centered modal
 * notification for due reminders. User must acknowledge with "Done".
 */
export default function ReminderToast() {
  const { getToken, isLoaded } = useAuth();
  const [toasts, setToasts] = useState<ReminderRow[]>([]);
  const shownIds = useRef<Set<string>>(new Set());
  const soundPlayed = useRef<Set<string>>(new Set());

  const poll = useCallback(async () => {
    if (!isLoaded) return;
    try {
      const due = await getDueReminders(getToken);
      const fresh = due.filter((r) => !shownIds.current.has(r.id));
      if (fresh.length > 0) {
        fresh.forEach((r) => shownIds.current.add(r.id));
        setToasts((prev) => {
          const existing = new Set(prev.map((t) => t.id));
          const added = fresh.filter((t) => !existing.has(t.id));
          // Play sound for genuinely new toasts
          if (added.length > 0) {
            const needsSound = added.some((a) => !soundPlayed.current.has(a.id));
            if (needsSound) {
              added.forEach((a) => soundPlayed.current.add(a.id));
              playNotificationSound();
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
    const id = setInterval(poll, 15_000); // Check every 15 seconds
    return () => clearInterval(id);
  }, [poll]);

  const handleDone = async (rid: string) => {
    try {
      await markReminderDone(getToken, rid);
    } catch {
      /* best-effort */
    }
    setToasts((prev) => prev.filter((t) => t.id !== rid));
  };

  const handleDismiss = (rid: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== rid));
  };

  if (toasts.length === 0) return null;

  return (
    <>
      {/* Backdrop overlay */}
      <div className="reminder-backdrop" />

      {/* Centered notification stack */}
      <div className="reminder-center">
        {toasts.map((r) => (
          <div key={r.id} role="alert" className="reminder-card">
            {/* Glow ring */}
            <div className="reminder-glow" />

            {/* Icon */}
            <div className="reminder-icon-wrap">
              <span className="reminder-icon">⏰</span>
            </div>

            {/* Content */}
            <p className="reminder-label">Reminder</p>
            <p className="reminder-task">{r.task}</p>
            <p className="reminder-time">
              {new Date(r.reminder_time).toLocaleTimeString(undefined, {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>

            {/* Actions */}
            <div className="reminder-actions">
              <button
                onClick={() => handleDone(r.id)}
                className="reminder-btn-done"
              >
                ✓ Done
              </button>
              <button
                onClick={() => handleDismiss(r.id)}
                className="reminder-btn-dismiss"
              >
                Dismiss
              </button>
            </div>
          </div>
        ))}
      </div>

      <style jsx>{`
        .reminder-backdrop {
          position: fixed;
          inset: 0;
          z-index: 9998;
          background: rgba(0, 0, 0, 0.6);
          backdrop-filter: blur(6px);
          animation: fade-in 0.3s ease-out both;
        }

        .reminder-center {
          position: fixed;
          inset: 0;
          z-index: 9999;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 1rem;
          padding: 1rem;
          pointer-events: none;
        }

        .reminder-card {
          pointer-events: auto;
          position: relative;
          width: 100%;
          max-width: 360px;
          background: linear-gradient(
            145deg,
            rgba(15, 23, 42, 0.95),
            rgba(30, 41, 59, 0.95)
          );
          border: 1px solid rgba(56, 189, 248, 0.25);
          border-radius: 1.25rem;
          padding: 2rem 1.5rem 1.5rem;
          text-align: center;
          box-shadow:
            0 0 40px rgba(56, 189, 248, 0.12),
            0 25px 50px -12px rgba(0, 0, 0, 0.6);
          animation: pop-in 0.4s cubic-bezier(0.16, 1, 0.3, 1) both;
          overflow: hidden;
        }

        .reminder-glow {
          position: absolute;
          top: -60px;
          left: 50%;
          transform: translateX(-50%);
          width: 200px;
          height: 120px;
          background: radial-gradient(
            ellipse,
            rgba(56, 189, 248, 0.2) 0%,
            transparent 70%
          );
          pointer-events: none;
        }

        .reminder-icon-wrap {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 56px;
          height: 56px;
          margin: 0 auto 0.75rem;
          border-radius: 50%;
          background: rgba(56, 189, 248, 0.1);
          border: 1px solid rgba(56, 189, 248, 0.2);
          animation: pulse-ring 2s ease-in-out infinite;
        }

        .reminder-icon {
          font-size: 1.75rem;
          line-height: 1;
          animation: wiggle 0.6s ease-in-out 0.4s both;
        }

        .reminder-label {
          font-size: 0.7rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.12em;
          color: rgba(56, 189, 248, 0.8);
          margin-bottom: 0.25rem;
        }

        .reminder-task {
          font-size: 1.125rem;
          font-weight: 600;
          color: #fff;
          margin-bottom: 0.25rem;
          line-height: 1.4;
        }

        .reminder-time {
          font-size: 0.8rem;
          color: rgba(148, 163, 184, 0.8);
          margin-bottom: 1.25rem;
        }

        .reminder-actions {
          display: flex;
          gap: 0.75rem;
          justify-content: center;
        }

        .reminder-btn-done {
          flex: 1;
          padding: 0.6rem 1rem;
          border-radius: 0.75rem;
          font-size: 0.875rem;
          font-weight: 600;
          border: none;
          cursor: pointer;
          background: linear-gradient(135deg, #06b6d4, #0ea5e9);
          color: #fff;
          transition: all 0.2s ease;
          box-shadow: 0 4px 12px rgba(6, 182, 212, 0.3);
        }

        .reminder-btn-done:hover {
          transform: translateY(-1px);
          box-shadow: 0 6px 20px rgba(6, 182, 212, 0.4);
        }

        .reminder-btn-done:active {
          transform: translateY(0);
        }

        .reminder-btn-dismiss {
          padding: 0.6rem 1rem;
          border-radius: 0.75rem;
          font-size: 0.875rem;
          font-weight: 500;
          border: 1px solid rgba(148, 163, 184, 0.2);
          cursor: pointer;
          background: transparent;
          color: rgba(148, 163, 184, 0.8);
          transition: all 0.2s ease;
        }

        .reminder-btn-dismiss:hover {
          border-color: rgba(148, 163, 184, 0.4);
          color: #fff;
        }

        @keyframes fade-in {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @keyframes pop-in {
          from {
            opacity: 0;
            transform: scale(0.85) translateY(20px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }

        @keyframes pulse-ring {
          0%,
          100% {
            box-shadow: 0 0 0 0 rgba(56, 189, 248, 0.15);
          }
          50% {
            box-shadow: 0 0 0 10px rgba(56, 189, 248, 0);
          }
        }

        @keyframes wiggle {
          0% {
            transform: rotate(0deg);
          }
          25% {
            transform: rotate(-15deg);
          }
          50% {
            transform: rotate(15deg);
          }
          75% {
            transform: rotate(-8deg);
          }
          100% {
            transform: rotate(0deg);
          }
        }
      `}</style>
    </>
  );
}
