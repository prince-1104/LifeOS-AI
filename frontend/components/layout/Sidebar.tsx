"use client";

import { UserButton, useUser } from "@clerk/nextjs";
import Link from "next/link";
import { usePathname } from "next/navigation";

const nav = [
  { href: "/chat", label: "Chat" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/reminders", label: "Reminders" },
  { href: "/finance", label: "Finance" },
  { href: "/memories", label: "Memories" },
];

export function Sidebar({
  mobileOpen,
  onCloseMobile,
}: {
  mobileOpen: boolean;
  onCloseMobile: () => void;
}) {
  const pathname = usePathname();
  const { user, isLoaded } = useUser();

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
          className="text-lg font-semibold tracking-tight text-white"
          onClick={onCloseMobile}
        >
          LifeOS AI
        </Link>
        <p className="mt-1 text-xs text-zinc-500">Your day, understood.</p>
      </div>
      <nav className="flex flex-1 flex-col gap-0.5 px-3 py-4">
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
                "rounded-xl px-3 py-2.5 text-sm font-medium transition",
                active
                  ? "bg-zinc-800/90 text-white"
                  : "text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-200",
              ].join(" ")}
            >
              {item.label}
            </Link>
          );
        })}
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
      </div>
    </aside>
  );
}
