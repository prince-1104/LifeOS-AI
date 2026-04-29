"use client";

import { useState, useEffect } from "react";
import { UserButton, useUser, useClerk } from "@clerk/nextjs";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { loadChatHistory, formatDateHeader, isSameDay, generateDateId } from "@/lib/chat-history";
import { useAuth } from "@clerk/nextjs";
import { getReminders, getSubscriptionStatus } from "@/lib/api";


const nav = [
  { href: "/chat", label: "Chat" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/reminders", label: "Reminders" },
  { href: "/reminders#calendar", label: "Calendar", icon: "calendar" },
  { href: "/finance", label: "Finance" },
  { href: "/memories", label: "Memories" },
  { href: "/billing", label: "Billing" },
  { href: "/profile", label: "Profile" },
];

export function Sidebar({
  mobileOpen,
  onCloseMobile,
}: {
  mobileOpen: boolean;
  onCloseMobile: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isLoaded } = useUser();
  const { signOut } = useClerk();
  const { getToken, isLoaded: authLoaded } = useAuth();

  const [historyDates, setHistoryDates] = useState<{label: string, id: string}[]>([]);
  const [pendingRemindersCount, setPendingRemindersCount] = useState(0);
  const [isFreePlan, setIsFreePlan] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  // Poll for pending reminders count & fetch subscription status
  useEffect(() => {
    if (!authLoaded) return;
    const fetchData = async () => {
      try {
        const [rows, status] = await Promise.all([
          getReminders(getToken),
          getSubscriptionStatus(getToken),
        ]);
        setPendingRemindersCount(rows.filter((r) => r.status === "pending").length);
        setIsFreePlan(status.plan.price_inr_monthly === 0);
      } catch {
        /* fail silently */
      }
    };
    fetchData();
    const id = setInterval(fetchData, 15_000);
    return () => clearInterval(id);
  }, [authLoaded, getToken]);

  useEffect(() => {
    if (!user?.id) return;
    
    function loadAndSetDates() {
      const rows = loadChatHistory(user!.id);
      const uniqueDates: {label: string, id: string}[] = [];
      let lastTimestamp: number | undefined = -1;

      for (const row of rows) {
        if (lastTimestamp === -1 || !isSameDay(row.timestamp, lastTimestamp)) {
          uniqueDates.push({
            label: formatDateHeader(row.timestamp),
            id: generateDateId(row.timestamp)
          });
          lastTimestamp = row.timestamp;
        }
      }
      setHistoryDates(uniqueDates.reverse());
    }
    
    loadAndSetDates();
    window.addEventListener("chat-history-updated", loadAndSetDates);
    return () => window.removeEventListener("chat-history-updated", loadAndSetDates);
  }, [user?.id]);

  const email = user?.primaryEmailAddress?.emailAddress ?? "";
  const label =
    user?.firstName ||
    user?.username ||
    (email ? email.split("@")[0] : "You");

  return (
    <aside
      id="app-sidebar"
      className={[
        "fixed inset-y-0 left-0 z-40 flex w-[75%] max-w-[18rem] flex-col border-r border-white/[0.06] bg-[var(--bg-sidebar)] transition-transform duration-200 md:static md:w-[20%] md:min-w-[240px] md:max-w-[320px] md:translate-x-0",
        mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
      ].join(" ")}
    >
      <div className="border-b border-white/[0.06] px-5 py-6">
        <Link
          href="/chat"
          className="flex items-center gap-2.5 text-lg font-semibold tracking-tight text-white"
          onClick={onCloseMobile}
        >
          <Image src="/logo.png" alt="Cortexa AI" width={32} height={32} className="rounded-lg" />
          Cortexa AI
        </Link>
        <p className="mt-1 pl-[42px] text-xs text-zinc-500">Hello, {label}</p>
      </div>
      <nav className="flex flex-1 flex-col overflow-y-auto px-3 py-4">
        <div className="flex flex-col gap-0.5">
          {nav.map((item) => {
            const active =
              item.href === "/chat"
                ? pathname === "/chat"
                : item.href.includes("#")
                  ? pathname === item.href.split("#")[0]
                  : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onCloseMobile}
                className={[
                  "rounded-xl px-3 py-2.5 text-sm font-medium transition flex items-center justify-between",
                  active
                    ? "bg-zinc-800/90 text-white"
                    : "text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-200",
                  (item as any).icon === "calendar" ? "pl-6" : "",
                ].join(" ")}
              >
                <span className="flex items-center gap-2">
                  {(item as any).icon === "calendar" && (
                    <svg className="h-3.5 w-3.5 text-indigo-400/70" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                    </svg>
                  )}
                  {item.label}
                </span>
                {item.label === "Reminders" && pendingRemindersCount > 0 && (
                  <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-cyan-500/20 px-1.5 text-[10px] font-bold text-cyan-400 border border-cyan-500/30">
                    {pendingRemindersCount}
                  </span>
                )}
              </Link>
            );
          })}
        </div>

        {historyDates.length > 0 && (
          <div className="mt-8">
            <button
              onClick={() => setHistoryOpen(!historyOpen)}
              className="flex w-full items-center justify-between px-3 py-1.5 rounded-lg hover:bg-white/[0.03] transition-colors group"
            >
              <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 group-hover:text-zinc-400 transition-colors">
                Chat History
              </h3>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-medium text-zinc-600">{historyDates.length}</span>
                <svg
                  className={`h-3 w-3 text-zinc-500 transition-transform duration-200 ${historyOpen ? "rotate-180" : ""}`}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                </svg>
              </div>
            </button>
            {historyOpen && (
              <div className="mt-1 flex flex-col gap-0.5 animate-message-in">
                {historyDates.map((date) => (
                  <Link
                    key={date.id}
                    href={`/chat?date=${date.id}`}
                    onClick={onCloseMobile}
                    className="block truncate rounded-xl px-3 py-2 text-[13px] font-medium text-zinc-400 transition hover:bg-white/[0.04] hover:text-zinc-200"
                  >
                    {date.label}
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}
      </nav>

      {isFreePlan && (
        <div className="px-4 pb-4">
          <Link
            href="/pricing"
            onClick={onCloseMobile}
            className="group relative flex items-center justify-between overflow-hidden rounded-xl border border-cyan-500/30 bg-gradient-to-r from-cyan-500/10 to-teal-500/10 px-4 py-3 transition hover:border-cyan-500/50 hover:from-cyan-500/20 hover:to-teal-500/20"
          >
             <div className="flex items-center gap-2 text-sm font-medium text-cyan-300">
               <span>⚡</span> Upgrade Plan
             </div>
             <svg className="h-4 w-4 text-cyan-400 opacity-50 transition group-hover:translate-x-1 group-hover:opacity-100" viewBox="0 0 20 20" fill="currentColor">
               <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
             </svg>
          </Link>
        </div>
      )}

      {/* Download Mobile App */}
      <div className="px-4 pb-4">
        <a
          href="https://expo.dev/artifacts/eas/dAQbFcSh4jhnkmAJtxtg7g.apk"
          target="_blank"
          rel="noopener noreferrer"
          className="group relative flex items-center justify-between overflow-hidden rounded-xl border border-indigo-500/20 bg-gradient-to-r from-indigo-500/10 to-purple-500/10 px-4 py-3 transition hover:border-indigo-500/40 hover:from-indigo-500/20 hover:to-purple-500/20"
        >
          <div className="flex items-center gap-2 text-sm font-medium text-indigo-300">
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Download App
          </div>
          <span className="rounded-md bg-indigo-500/20 px-1.5 py-0.5 text-[10px] font-bold text-indigo-400 border border-indigo-500/30">
            APK
          </span>
        </a>
      </div>

      <div className="border-t border-white/[0.06] p-4">
        <div className="flex items-center justify-between gap-3 rounded-xl bg-white/[0.03] px-3 py-2.5">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-slate-200">
              {isLoaded ? label : "…"}
            </p>
            <p className="truncate text-xs text-slate-500">
              {email || "Account"}
            </p>
          </div>
          <UserButton
            appearance={{
              elements: {
                userButtonAvatarBox: "h-9 w-9",
              },
            }}
          />
        </div>
        <button
          onClick={() => signOut(() => router.push("/"))}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] py-2 text-xs font-medium text-slate-400 transition hover:bg-red-500/10 hover:text-red-400"
        >
          Log Out
        </button>
      </div>
    </aside>
  );
}
