"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@clerk/nextjs";
import {
  getUsageSummary,
  getDailyUsage,
  getWeeklyUsage,
  getMonthlyUsage,
  getTopUsers,
  type UsageSummary,
  type DailyUsage,
  type WeeklyUsage,
  type MonthlyUsage,
  type TopUser,
} from "@/lib/admin-api";
import SummaryCards from "@/components/admin/SummaryCards";
import UsageChart from "@/components/admin/UsageChart";

export default function AdminDashboardPage() {
  const router = useRouter();
  const { session } = useSession();
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<UsageSummary | null>(null);
  const [daily, setDaily] = useState<DailyUsage[]>([]);
  const [weekly, setWeekly] = useState<WeeklyUsage[]>([]);
  const [monthly, setMonthly] = useState<MonthlyUsage[]>([]);
  const [topUsers, setTopUsers] = useState<TopUser[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      if (!session) return;
      try {
        const getToken = async () => await session.getToken();
        const [s, d, w, m, t] = await Promise.all([
          getUsageSummary(getToken),
          getDailyUsage(getToken),
          getWeeklyUsage(getToken),
          getMonthlyUsage(getToken),
          getTopUsers(getToken),
        ]);
        setSummary(s);
        setDaily(d);
        setWeekly(w);
        setMonthly(m);
        setTopUsers(t);
      } catch (err: any) {
        if (err.message?.includes("401") || err.message?.includes("admin")) {
          router.replace("/");
          return;
        }
        setError(err.message || "Failed to load analytics");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [router, session]);

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="text-sm text-slate-400 mt-1">
          Overview of token usage, costs, and user activity
        </p>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Summary cards */}
      <SummaryCards data={summary} loading={loading} />

      {/* Usage chart */}
      <UsageChart
        daily={daily}
        weekly={weekly}
        monthly={monthly}
        loading={loading}
      />

      {/* Top users */}
      <div className="glass-panel rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">Top Users</h2>
          <button
            onClick={() => router.push("/admin/users")}
            className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
          >
            View all →
          </button>
        </div>

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-10 bg-white/5 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : topUsers.length === 0 ? (
          <div className="py-8 text-center text-slate-500 text-sm">
            No usage data yet — process some requests first
          </div>
        ) : (
          <div className="space-y-2">
            {topUsers.map((user, i) => {
              const displayName =
                user.first_name || user.last_name
                  ? `${user.first_name || ""} ${user.last_name || ""}`.trim()
                  : user.email || user.user_id.slice(0, 16) + "…";

              const maxTokens = topUsers[0]?.total_tokens || 1;
              const pct = Math.max((user.total_tokens / maxTokens) * 100, 2);

              return (
                <div
                  key={user.user_id}
                  className="flex items-center gap-3 p-2 rounded-xl hover:bg-white/3 transition-colors group"
                >
                  {/* Rank */}
                  <div className="w-6 text-center text-xs font-bold text-slate-500">
                    {i + 1}
                  </div>

                  {/* Avatar */}
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
                    {displayName.charAt(0).toUpperCase()}
                  </div>

                  {/* Name + bar */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-white truncate">
                        {displayName}
                      </span>
                      <span className="text-xs text-slate-400 font-mono ml-2">
                        {user.total_tokens.toLocaleString()} tokens
                      </span>
                    </div>
                    <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>

                  {/* Cost */}
                  <div className="text-xs font-mono text-emerald-400 flex-shrink-0">
                    ${user.cost.toFixed(4)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
