"use client";

import Link from "next/link";

type Props = {
  message: string;
};

/**
 * Special chat message card shown when a usage limit is hit.
 * Displays the upgrade_message from the backend with a CTA.
 */
export function LimitMessage({ message }: Props) {
  return (
    <div className="animate-message-in flex justify-start">
      <div className="flex flex-col items-start">
        <div className="max-w-[min(100%,42rem)] rounded-2xl border border-amber-500/25 bg-gradient-to-br from-amber-500/[0.06] to-transparent px-4 py-4 shadow-lg shadow-amber-900/10">
          <div className="mb-2 flex items-center gap-2 text-sm font-medium text-amber-300">
            <span className="flex h-5 w-5 items-center justify-center rounded-md bg-amber-500/20 text-xs">
              ⚡
            </span>
            <span>Limit Reached</span>
          </div>
          <p className="text-[15px] leading-relaxed text-zinc-200">{message}</p>
          <Link
            href="/pricing"
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-cyan-500 to-teal-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-cyan-500/20 transition hover:shadow-cyan-500/30 hover:brightness-110"
          >
            <UpgradeIcon />
            Upgrade Now
          </Link>
        </div>
      </div>
    </div>
  );
}

function UpgradeIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
    </svg>
  );
}
