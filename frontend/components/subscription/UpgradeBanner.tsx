"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import { getSubscriptionStatus } from "@/lib/api";

export function UpgradeBanner() {
  const { getToken, isLoaded } = useAuth();
  const [dismissed, setDismissed] = useState(true); // start hidden to avoid flash
  const [isFree, setIsFree] = useState(false);

  useEffect(() => {
    if (!isLoaded) return;
    const dismissedAt = localStorage.getItem("upgrade_banner_dismissed");
    if (dismissedAt) {
      const expires = parseInt(dismissedAt, 10) + 24 * 60 * 60 * 1000; // 24h
      if (Date.now() < expires) {
        setDismissed(true);
        return;
      }
    }
    
    getSubscriptionStatus(getToken).then(status => {
        setIsFree(status.plan.price_inr_monthly === 0);
        setDismissed(false);
    }).catch(() => {
        // fail silently
    });
  }, [getToken, isLoaded]);

  const dismiss = () => {
    localStorage.setItem("upgrade_banner_dismissed", Date.now().toString());
    setDismissed(true);
  };

  if (dismissed || !isFree) return null;

  return (
    <div className="animate-slide-down relative overflow-hidden border-b border-cyan-500/20 bg-gradient-to-r from-cyan-500/[0.06] via-teal-500/[0.04] to-transparent px-4 py-3 md:px-6">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-cyan-500/15 text-sm">
            ⚡
          </span>
          <p className="text-sm text-zinc-300">
            <span className="font-medium text-white">You&apos;re on the Free plan.</span>{" "}
            Upgrade to unlock more requests, memories, and reminders.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/pricing"
            className="rounded-lg bg-gradient-to-r from-cyan-500 to-teal-500 px-4 py-1.5 text-xs font-semibold text-white shadow-lg shadow-cyan-500/20 transition hover:shadow-cyan-500/30 hover:brightness-110"
          >
            Upgrade
          </Link>
          <button
            onClick={dismiss}
            className="rounded-lg p-1.5 text-zinc-500 transition hover:bg-white/5 hover:text-zinc-300"
            aria-label="Dismiss"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
