"use client";

import { useState } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";
import type { DailyUsage, WeeklyUsage, MonthlyUsage } from "@/lib/admin-api";

type Period = "daily" | "weekly" | "monthly";

type Props = {
  daily: DailyUsage[];
  weekly: WeeklyUsage[];
  monthly: MonthlyUsage[];
  loading: boolean;
};

function normalizeData(
  period: Period,
  daily: DailyUsage[],
  weekly: WeeklyUsage[],
  monthly: MonthlyUsage[],
) {
  if (period === "daily") {
    return daily.map((d) => ({
      label: new Date(d.date).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      }),
      tokens: d.total_tokens,
      requests: d.total_requests,
      cost: d.cost,
    }));
  }
  if (period === "weekly") {
    return weekly.map((w) => ({
      label: new Date(w.week_start).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      }),
      tokens: w.total_tokens,
      requests: w.total_requests,
      cost: w.cost,
    }));
  }
  return monthly.map((m) => ({
    label: m.month,
    tokens: m.total_tokens,
    requests: m.total_requests,
    cost: m.cost,
  }));
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#1a1a2e] border border-white/10 rounded-xl p-3 shadow-xl">
      <p className="text-xs text-slate-400 mb-1">{label}</p>
      {payload.map((entry: any, i: number) => (
        <p key={i} className="text-sm font-medium" style={{ color: entry.color }}>
          {entry.name}: {entry.name === "cost" ? `$${entry.value.toFixed(4)}` : entry.value.toLocaleString()}
        </p>
      ))}
    </div>
  );
};

export default function UsageChart({ daily, weekly, monthly, loading }: Props) {
  const [period, setPeriod] = useState<Period>("daily");
  const [metric, setMetric] = useState<"tokens" | "requests" | "cost">("tokens");

  const data = normalizeData(period, daily, weekly, monthly);

  const colorMap = {
    tokens: { stroke: "#818cf8", fill: "#818cf8" },
    requests: { stroke: "#34d399", fill: "#34d399" },
    cost: { stroke: "#f59e0b", fill: "#f59e0b" },
  };

  return (
    <div className="glass-panel rounded-2xl p-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6">
        <h2 className="text-lg font-semibold text-white">Usage Analytics</h2>

        <div className="flex items-center gap-2">
          {/* Metric toggle */}
          <div className="flex bg-white/5 rounded-lg p-0.5">
            {(["tokens", "requests", "cost"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMetric(m)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all capitalize ${
                  metric === m
                    ? "bg-indigo-500/20 text-indigo-400"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                {m}
              </button>
            ))}
          </div>

          {/* Period toggle */}
          <div className="flex bg-white/5 rounded-lg p-0.5">
            {(["daily", "weekly", "monthly"] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all capitalize ${
                  period === p
                    ? "bg-indigo-500/20 text-indigo-400"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Chart */}
      {loading ? (
        <div className="h-72 bg-white/5 rounded-xl animate-pulse" />
      ) : data.length === 0 ? (
        <div className="h-72 flex items-center justify-center text-slate-500 text-sm">
          No usage data yet
        </div>
      ) : period === "monthly" ? (
        <ResponsiveContainer width="100%" height={288}>
          <BarChart data={data} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis
              dataKey="label"
              tick={{ fill: "#64748b", fontSize: 11 }}
              axisLine={{ stroke: "rgba(255,255,255,0.06)" }}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: "#64748b", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={<CustomTooltip />} />
            <Bar
              dataKey={metric}
              name={metric}
              fill={colorMap[metric].fill}
              radius={[6, 6, 0, 0]}
              fillOpacity={0.6}
            />
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <ResponsiveContainer width="100%" height={288}>
          <AreaChart data={data} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
            <defs>
              <linearGradient id={`gradient-${metric}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={colorMap[metric].fill} stopOpacity={0.3} />
                <stop offset="95%" stopColor={colorMap[metric].fill} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis
              dataKey="label"
              tick={{ fill: "#64748b", fontSize: 11 }}
              axisLine={{ stroke: "rgba(255,255,255,0.06)" }}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: "#64748b", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey={metric}
              name={metric}
              stroke={colorMap[metric].stroke}
              strokeWidth={2}
              fill={`url(#gradient-${metric})`}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
