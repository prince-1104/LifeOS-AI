"use client";

import type { UsageSummary, MonthlyUsage } from "@/lib/admin-api";

type Props = {
  data: UsageSummary | null;
  loading: boolean;
  monthlyData?: MonthlyUsage[];
};

export default function SummaryCards({ data, loading, monthlyData }: Props) {
  // Calculate current month's cost
  const currentMonthCost = (() => {
    if (!monthlyData || monthlyData.length === 0) return 0;
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const current = monthlyData.find((m) => m.month === currentMonth);
    return current?.cost || 0;
  })();

  const currentMonthTokens = (() => {
    if (!monthlyData || monthlyData.length === 0) return 0;
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const current = monthlyData.find((m) => m.month === currentMonth);
    return current?.total_tokens || 0;
  })();

  const cards = [
    {
      label: "Total Users",
      value: data ? data.total_users.toLocaleString() : null,
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
        </svg>
      ),
      gradient: "from-blue-500 to-cyan-500",
      bgGlow: "bg-blue-500/15",
    },
    {
      label: "All-Time Tokens",
      value: data
        ? data.total_tokens >= 1_000_000
          ? `${(data.total_tokens / 1_000_000).toFixed(1)}M`
          : data.total_tokens >= 1_000
            ? `${(data.total_tokens / 1_000).toFixed(1)}K`
            : data.total_tokens.toLocaleString()
        : null,
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
        </svg>
      ),
      gradient: "from-indigo-500 to-purple-500",
      bgGlow: "bg-indigo-500/15",
    },
    {
      label: "All-Time Cost",
      value: data ? `$${data.total_cost.toFixed(4)}` : null,
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      gradient: "from-emerald-500 to-teal-500",
      bgGlow: "bg-emerald-500/15",
    },
    {
      label: "This Month Cost",
      value: data ? `$${currentMonthCost.toFixed(4)}` : null,
      subtitle: data
        ? `${currentMonthTokens >= 1000 ? `${(currentMonthTokens / 1000).toFixed(1)}K` : currentMonthTokens} tokens`
        : null,
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
        </svg>
      ),
      gradient: "from-amber-500 to-orange-500",
      bgGlow: "bg-amber-500/15",
      highlight: true,
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => (
        <div
          key={card.label}
          className={`glass-panel rounded-2xl p-5 relative overflow-hidden group hover:border-white/12 transition-all duration-300 ${
            card.highlight ? "ring-1 ring-amber-500/20" : ""
          }`}
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
              {loading || !card.value ? (
                <div className="h-8 w-24 bg-white/5 rounded-lg animate-pulse" />
              ) : (
                card.value
              )}
            </div>
            {card.subtitle && !loading && (
              <div className="text-xs text-slate-500 mt-1 font-mono">{card.subtitle}</div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
