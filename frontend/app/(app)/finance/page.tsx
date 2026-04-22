"use client";

import { useAuth } from "@clerk/nextjs";
import { useEffect, useState } from "react";
import { getTransactions, type TransactionRow, deleteTransaction, updateTransactionDate } from "@/lib/api";
import { TrashIcon } from "@heroicons/react/24/outline";

function getLocalDatetime(dateString: string) {
  const d = new Date(dateString);
  const tzoffset = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tzoffset).toISOString().slice(0, 16);
}

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

  const fetchItems = () => {
    if (!isLoaded) return;
    getTransactions(getToken)
      .then(setItems)
      .catch((e) =>
        setError(e instanceof Error ? e.message : "Could not load transactions."),
      );
  };

  useEffect(() => {
    fetchItems();
  }, [isLoaded, getToken]);

  const handleDelete = async (id: string) => {
    try {
      await deleteTransaction(getToken, id);
      fetchItems();
    } catch (e) {
      alert("Failed to delete transaction.");
    }
  };

  const handleDateChange = async (id: string, newDateLocalStr: string) => {
    try {
      if (!newDateLocalStr) return;
      const isoDate = new Date(newDateLocalStr).toISOString();
      await updateTransactionDate(getToken, id, isoDate);
      fetchItems();
    } catch (e) {
      alert("Failed to update date.");
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-b border-white/[0.06] px-6 py-5 md:px-10 shrink-0">
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
                  <th className="px-4 py-3 font-medium">Note</th>
                  <th className="px-4 py-3 font-medium">Type</th>
                  <th className="px-4 py-3 font-medium">Amount</th>
                  <th className="px-4 py-3 font-medium">Category</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {items.map((t) => (
                  <tr key={t.id} className="hover:bg-white/[0.02]">
                    <td className="whitespace-nowrap px-4 py-3 text-slate-400">
                      <input
                        type="datetime-local"
                        className="bg-transparent text-slate-300 dark:[color-scheme:dark] outline-none border-b border-transparent hover:border-slate-500 focus:border-indigo-500 transition-colors py-1 cursor-pointer"
                        defaultValue={getLocalDatetime(t.event_time)}
                        onBlur={(e) => {
                           const original = getLocalDatetime(t.event_time);
                           if (e.target.value !== original) {
                             handleDateChange(t.id, e.target.value);
                           }
                        }}
                      />
                    </td>
                    <td className="px-4 py-3 text-slate-400 max-w-[200px] truncate" title={t.note ?? ""}>
                      {t.note ?? "—"}
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
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleDelete(t.id)}
                        className="text-rose-500 hover:text-rose-400 transition-colors"
                        title="Delete transaction"
                      >
                        <TrashIcon className="w-4 h-4 ml-auto" />
                      </button>
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
