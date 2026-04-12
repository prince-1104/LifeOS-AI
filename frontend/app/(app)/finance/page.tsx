"use client";

import { useAuth } from "@clerk/nextjs";
import { useEffect, useState } from "react";
import { getTransactions, type TransactionRow } from "@/lib/api";

function formatInr(amount: string) {
  const n = Number(amount);
  if (Number.isNaN(n)) return amount;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(n);
}

export default function FinancePage() {
  const { getToken, isLoaded } = useAuth();
  const [items, setItems] = useState<TransactionRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoaded) return;
    getTransactions(getToken)
      .then(setItems)
      .catch((e) =>
        setError(e instanceof Error ? e.message : "Could not load transactions."),
      );
  }, [isLoaded, getToken]);

  return (
    <div className="flex flex-1 flex-col">
      <div className="border-b border-white/[0.06] px-6 py-5 md:px-10">
        <h1 className="text-xl font-semibold tracking-tight text-white">
          Finance
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Recent income and expenses from your assistant.
        </p>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-6 md:px-10">
        {error ? (
          <div className="glass-panel rounded-2xl border border-rose-500/20 px-4 py-3 text-sm text-rose-200">
            {error}
          </div>
        ) : null}
        {items && items.length === 0 ? (
          <div className="glass-panel mx-auto max-w-lg rounded-2xl px-6 py-10 text-center">
            <p className="text-slate-300">No transactions yet.</p>
            <p className="mt-2 text-sm text-slate-500">
              Say things like &quot;Spent ₹120 on coffee&quot; or &quot;Salary
              ₹50,000 credited&quot; in Chat to build this list.
            </p>
          </div>
        ) : null}
        {items && items.length > 0 ? (
          <div className="mx-auto max-w-3xl overflow-x-auto rounded-2xl border border-white/[0.06]">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-white/[0.06] bg-white/[0.02] text-slate-400">
                <tr>
                  <th className="px-4 py-3 font-medium">When</th>
                  <th className="px-4 py-3 font-medium">Type</th>
                  <th className="px-4 py-3 font-medium">Amount</th>
                  <th className="px-4 py-3 font-medium">Category</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {items.map((t) => (
                  <tr key={t.id} className="hover:bg-white/[0.02]">
                    <td className="whitespace-nowrap px-4 py-3 text-slate-400">
                      {new Date(t.event_time).toLocaleString(undefined, {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="px-4 py-3 capitalize text-slate-300">
                      {t.type}
                    </td>
                    <td
                      className={
                        t.type === "income"
                          ? "px-4 py-3 font-medium text-emerald-400"
                          : "px-4 py-3 font-medium text-slate-100"
                      }
                    >
                      {formatInr(t.amount)}
                    </td>
                    <td className="px-4 py-3 capitalize text-slate-500">
                      {t.category ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
        {!items && !error ? (
          <div className="glass-panel h-40 animate-pulse rounded-2xl bg-white/[0.02]" />
        ) : null}
      </div>
    </div>
  );
}
