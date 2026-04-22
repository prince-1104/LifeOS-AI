"use client";

import Link from "next/link";

type Props = {
  message: string;
  timestamp?: number;
};

function formatMessageTime(t?: number) {
  if (!t) return null;
  const d = new Date(t);
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }).replace(/\s/g, '').toLowerCase();
}

/**
 * Special chat message card shown when a usage limit is hit.
 * Displays the upgrade_message from the backend with a premium CTA.
 */
export function LimitMessage({ message, timestamp }: Props) {
  // Split message into lines for better formatting
  const lines = message.split("\n").filter((l) => l.trim());

  return (
    <div className="animate-message-in flex justify-start">
      <div className="flex flex-col items-start">
        <div className="max-w-[min(100%,42rem)] rounded-2xl border border-amber-500/25 bg-gradient-to-br from-amber-500/[0.08] to-purple-600/[0.04] px-5 py-5 shadow-lg shadow-amber-900/10 relative overflow-hidden">
          {/* Subtle shimmer effect */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.02] to-transparent -translate-x-full animate-[shimmer_3s_infinite]" />
          
          {/* Header */}
          <div className="relative mb-3 flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500/30 to-orange-500/20 text-base shadow-inner">
              ⚡
            </span>
            <div>
              <span className="text-sm font-bold text-amber-200">Limit Reached</span>
              <p className="text-[11px] text-amber-400/60">Upgrade to continue</p>
            </div>
          </div>

          {/* Message content */}
          <div className="relative space-y-1.5">
            {lines.map((line, i) => (
              <p
                key={i}
                className={`text-[14px] leading-relaxed ${
                  i === 0
                    ? "text-zinc-100 font-medium"
                    : "text-zinc-300"
                }`}
              >
                {line}
              </p>
            ))}
          </div>

          {/* CTA Button */}
          <Link
            href="/billing"
            className="relative mt-5 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-pink-500 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-orange-500/25 transition-all duration-300 hover:shadow-orange-500/40 hover:scale-[1.02] hover:brightness-110 active:scale-[0.98]"
          >
            <UpgradeIcon />
            Upgrade Now
            <span className="ml-1 text-xs font-normal opacity-80">→</span>
          </Link>

          {/* Secondary link */}
          <Link
            href="/billing"
            className="relative mt-2.5 block text-center text-xs text-amber-400/70 transition hover:text-amber-300"
          >
            View all plans & pricing
          </Link>
        </div>
        {timestamp ? (
          <span className="mt-1 pl-2 text-[11px] font-medium text-zinc-500/80">
            {formatMessageTime(timestamp)}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function UpgradeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
    </svg>
  );
}
