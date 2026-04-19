"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { Sidebar } from "./Sidebar";
import { UpgradeBanner } from "@/components/subscription/UpgradeBanner";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex h-[100dvh] w-full overflow-hidden text-slate-100">
      <Sidebar mobileOpen={mobileOpen} onCloseMobile={() => setMobileOpen(false)} />
      {mobileOpen ? (
        <button
          type="button"
          aria-label="Close menu"
          className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      ) : null}
      <div className="flex h-full min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-white/[0.06] bg-[#111111] px-4 py-3 md:hidden">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="rounded-xl p-2 text-slate-300 transition hover:bg-white/5 hover:text-white"
            aria-expanded={mobileOpen}
            aria-controls="app-sidebar"
          >
            <MenuIcon />
          </button>
          <Link
            href="/chat"
            className="flex items-center gap-2 text-sm font-semibold tracking-tight text-white"
          >
            <Image src="/logo.png" alt="Cortexa AI" width={24} height={24} className="rounded-md" />
            Cortexa AI
          </Link>
        </header>
        <UpgradeBanner />
        <main className="relative flex min-h-0 flex-1 flex-col">{children}</main>
      </div>
    </div>
  );
}

function MenuIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 6h16M4 12h16M4 18h16"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
