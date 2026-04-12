"use client";

import { useAuth } from "@clerk/nextjs";
import { useEffect, useState } from "react";
import {
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  type ActivityItem,
  type DashboardPayload,
  getDashboard,
} from "@/lib/api";

const PIE_COLORS = [
  "#6366f1",
  "#8b5cf6",
  "#0ea5e9",
  "#10b981",
  "#f59e0b",
  "#ec4899",
  "#94a3b8",
  "#64748b",
];

function formatInrFromString(amount: string) {
  const n = Number(amount);
  if (Number.isNaN(n)) return amount;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(n);
}

function ActivityList({ items }: { items: ActivityItem[] }) {
  if (items.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-slate-500">
        No activity yet — chat with LifeOS to see your history here.
      </p>
    );
  }
  return (
    <ul className="divide-y divide-white/[0.06]">
      {items.map((a, i) => (
        <li key={`${a.created_at}-${i}`} className="flex gap-3 py-3 first:pt-0">
          <div className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-indigo-500/80" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm text-slate-200">{a.query}</p>
            <p className="mt-0.5 text-xs capitalize text-slate-500">
              {a.result_type.replace(/_/g, " ")}
            </p>
            <p className="mt-1 line-clamp-2 text-xs text-slate-500">
              {a.response_preview}
            </p>
          </div>
          <time
            className="shrink-0 text-xs text-slate-600"
            dateTime={a.created_at}
          >
            {new Date(a.created_at).toLocaleString(undefined, {
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </time>
        </li>
      ))}
    </ul>
  );
}

export default function DashboardPage() {
  const { getToken, isLoaded } = useAuth();
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isLoaded) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    getDashboard(getToken)
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((e) => {
        if (!cancelled)
          setError(e instanceof Error ? e.message : "Failed to load dashboard.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isLoaded, getToken]);

  const lineData =
    data?.weekly_series.map((p) => ({
      day: p.date.slice(5),
      amount: Number(p.amount),
    })) ?? [];

  const pieData =
    data?.category_breakdown.map((c) => ({
      name: c.category,
      value: Number(c.amount),
    })) ?? [];

  return (
    <div className="flex flex-1 flex-col">
      <div className="border-b border-white/[0.06] px-6 py-5 md:px-10">
        <h1 className="text-xl font-semibold tracking-tight text-white">
          Dashboard
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Spending and activity at a glance.
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-6 md:px-10">
        {loading ? (
          <div className="grid gap-4 md:grid-cols-2">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="glass-panel h-48 animate-pulse rounded-2xl bg-white/[0.02]"
              />
            ))}
          </div>
        ) : null}

        {error ? (
          <div className="glass-panel rounded-2xl border border-rose-500/20 px-4 py-3 text-sm text-rose-200">
            {error}
          </div>
        ) : null}

        {data && !loading ? (
          <div className="mx-auto flex max-w-6xl flex-col gap-6">
            <div className="glass-panel rounded-2xl p-6 md:p-8">
              <p className="text-sm font-medium text-slate-400">
                Total spending today
              </p>
              <p className="mt-2 text-4xl font-semibold tracking-tight text-white md:text-5xl">
                {formatInrFromString(data.total_spent_today)}
              </p>
              <p className="mt-2 text-xs text-slate-600">
                Expenses recorded for the current calendar day (server time).
              </p>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <div className="glass-panel rounded-2xl p-4 md:p-6">
                <h2 className="mb-4 text-sm font-medium text-slate-300">
                  Last 7 days
                </h2>
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={lineData}>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="rgba(255,255,255,0.06)"
                      />
                      <XAxis
                        dataKey="day"
                        stroke="#64748b"
                        fontSize={11}
                        tickLine={false}
                      />
                      <YAxis
                        stroke="#64748b"
                        fontSize={11}
                        tickLine={false}
                        tickFormatter={(v) => `₹${v}`}
                      />
                      <Tooltip
                        contentStyle={{
                          background: "rgba(15,17,28,0.95)",
                          border: "1px solid rgba(255,255,255,0.08)",
                          borderRadius: "12px",
                        }}
                        labelStyle={{ color: "#94a3b8" }}
                        formatter={(value) => [
                          formatInrFromString(String(value ?? "")),
                          "Spent",
                        ]}
                      />
                      <Line
                        type="monotone"
                        dataKey="amount"
                        stroke="#6366f1"
                        strokeWidth={2}
                        dot={{ fill: "#6366f1", r: 3 }}
                        activeDot={{ r: 5 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="glass-panel rounded-2xl p-4 md:p-6">
                <h2 className="mb-4 text-sm font-medium text-slate-300">
                  By category
                </h2>
                {pieData.length === 0 ? (
                  <p className="py-12 text-center text-sm text-slate-500">
                    No category data yet. Log expenses in chat.
                  </p>
                ) : (
                  <div className="flex h-64 items-center">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={pieData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius={52}
                          outerRadius={80}
                          paddingAngle={2}
                        >
                          {pieData.map((_, i) => (
                            <Cell
                              key={i}
                              fill={PIE_COLORS[i % PIE_COLORS.length]}
                            />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{
                            background: "rgba(15,17,28,0.95)",
                            border: "1px solid rgba(255,255,255,0.08)",
                            borderRadius: "12px",
                          }}
                          formatter={(value) =>
                            formatInrFromString(String(value ?? ""))
                          }
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            </div>

            <div className="glass-panel rounded-2xl p-4 md:p-6">
              <h2 className="mb-2 text-sm font-medium text-slate-300">
                Recent activity
              </h2>
              <ActivityList items={data.recent_activity} />
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
