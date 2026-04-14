"use client";

import type { UsageSummary } from "@/lib/admin-api";

type Props = {
  data: UsageSummary | null;
  loading: boolean;
};

const cards = [
  {
    key: "total_users" as const,
    label: "Total Users",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
      </svg>
    ),
    format: (v: number) => v.toLocaleString(),
    gradient: "from-blue-500 to-cyan-500",
    bgGlow: "bg-blue-500/15",
  },
  {
    key: "total_tokens" as const,
    label: "Total Tokens",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
      </svg>
    ),
    format: (v: number) =>
      v >= 1_000_000
        ? `${(v / 1_000_000).toFixed(1)}M`
        : v >= 1_000
          ? `${(v / 1_000).toFixed(1)}K`
          : v.toLocaleString(),
    gradient: "from-indigo-500 to-purple-500",
    bgGlow: "bg-indigo-500/15",
  },
  {
    key: "total_cost" as const,
    label: "Total Cost",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    format: (v: number) => `$${v.toFixed(4)}`,
    gradient: "from-emerald-500 to-teal-500",
    bgGlow: "bg-emerald-500/15",
  },
];

export default function SummaryCards({ data, loading }: Props) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {cards.map((card) => (
        <div
          key={card.key}
          className="glass-panel rounded-2xl p-5 relative overflow-hidden group hover:border-white/12 transition-all duration-300"
        >
          {/* Background glow */}
          <div
            className={`absolute -top-8 -right-8 w-24 h-24 rounded-full ${card.bgGlow} blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500`}
          />

          <div className="relative z-10">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                {card.label}
              </span>
              <div
                className={`w-8 h-8 rounded-lg bg-gradient-to-br ${card.gradient} flex items-center justify-center text-white`}
              >
                {card.icon}
              </div>
            </div>
            <div className="text-2xl font-bold text-white">
              {loading || !data ? (
                <div className="h-8 w-24 bg-white/5 rounded-lg animate-pulse" />
              ) : (
                card.format(data[card.key])
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
