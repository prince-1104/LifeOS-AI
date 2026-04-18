"use client";

import { useState, useEffect } from "react";
import { UserButton, useUser, useClerk } from "@clerk/nextjs";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { loadChatHistory, formatDateHeader, isSameDay, generateDateId } from "@/lib/chat-history";
import { useAuth } from "@clerk/nextjs";
import { getReminders } from "@/lib/api";


const nav = [
  { href: "/chat", label: "Chat" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/reminders", label: "Reminders" },
  { href: "/finance", label: "Finance" },
  { href: "/memories", label: "Memories" },
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

  // Poll for pending reminders count
  useEffect(() => {
    if (!authLoaded) return;
    const fetchCount = async () => {
      try {
        const rows = await getReminders(getToken);
        setPendingRemindersCount(rows.filter((r) => r.status === "pending").length);
      } catch {
        /* fail silently */
      }
    };
    fetchCount();
    const id = setInterval(fetchCount, 15_000);
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
        "fixed inset-y-0 left-0 z-40 flex w-[min(100%,20rem)] flex-col border-r border-white/[0.06] bg-[var(--bg-sidebar)] transition-transform duration-200 md:static md:w-[20%] md:min-w-[240px] md:max-w-[320px] md:translate-x-0",
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
        <p className="mt-1 pl-[42px] text-xs text-zinc-500">Your day, understood.</p>
      </div>
      <nav className="flex flex-1 flex-col overflow-y-auto px-3 py-4">
        <div className="flex flex-col gap-0.5">
          {nav.map((item) => {
            const active =
              item.href === "/chat"
                ? pathname === "/chat"
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
                ].join(" ")}
              >
                <span>{item.label}</span>
                {item.label === "Reminders" && pendingRemindersCount > 0 && (
                  <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-cyan-500/20 px-1.5 text-[10px] items-center font-bold text-cyan-400 border border-cyan-500/30">
                    {pendingRemindersCount}
                  </span>
                )}
              </Link>
            );
          })}
        </div>

        {historyDates.length > 0 && (
          <div className="mt-8">
            <h3 className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Chat History
            </h3>
            <div className="flex flex-col gap-0.5">
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
          </div>
        )}
      </nav>
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
