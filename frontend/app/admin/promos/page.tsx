"use client";

import { useEffect, useState } from "react";
import { getPromoCodes, createPromoCode, type PromoCode } from "@/lib/admin-api";

export default function PromosPage() {
  const [promos, setPromos] = useState<PromoCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);

  const [newCode, setNewCode] = useState("");
  const [discountPercent, setDiscountPercent] = useState<number | "">("");
  const [maxUses, setMaxUses] = useState<number | "">("");
  const [minAmount, setMinAmount] = useState<number | "">("");

  useEffect(() => {
    loadPromos();
  }, []);

  async function loadPromos() {
    setLoading(true);
    try {
      const data = await getPromoCodes();
      setPromos(data);
    } catch (e: any) {
      setError(e.message || "Failed to load promo codes");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newCode || !discountPercent) return;
    
    setCreating(true);
    setError("");
    try {
      const result = await createPromoCode({
        code: newCode,
        discount_percent: Number(discountPercent),
        max_uses: maxUses ? Number(maxUses) : null,
        min_amount: minAmount ? Number(minAmount) : null,
      });
      setPromos([result, ...promos]);
      setNewCode("");
      setDiscountPercent("");
      setMaxUses("");
      setMinAmount("");
    } catch (e: any) {
      setError(e.message || "Failed to create promo code");
    } finally {
      setCreating(false);
    }
  }

  if (loading) {
    return <div className="text-zinc-500 animate-pulse">Loading promos...</div>;
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">Promo Codes</h1>
        <p className="mt-2 text-sm text-zinc-400">Manage checkout discounts and usage.</p>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-200">
          {error}
        </div>
      )}

      {/* CREATE PROMO FORM */}
      <div className="rounded-2xl border border-white/10 bg-[#151515] p-6 shadow-xl">
        <h2 className="text-base font-semibold text-white mb-4">Create New Promo</h2>
        <form onSubmit={handleCreate} className="grid sm:grid-cols-2 md:grid-cols-4 gap-4 items-end">
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">Code Name</label>
            <input 
              required
              type="text" 
              placeholder="e.g. SUMMER50"
              className="w-full rounded-xl border border-white/10 bg-white/5 py-2 px-3 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 uppercase"
              value={newCode}
              onChange={(e) => setNewCode(e.target.value.toUpperCase())}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">Discount %</label>
            <input 
              required
              type="number" 
              min="1" max="100"
              placeholder="e.g. 20"
              className="w-full rounded-xl border border-white/10 bg-white/5 py-2 px-3 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              value={discountPercent}
              onChange={(e) => setDiscountPercent(e.target.value ? Number(e.target.value) : "")}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">Max Uses (Optional)</label>
            <input 
              type="number" 
              min="1"
              placeholder="Unlimited"
              className="w-full rounded-xl border border-white/10 bg-white/5 py-2 px-3 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              value={maxUses}
              onChange={(e) => setMaxUses(e.target.value ? Number(e.target.value) : "")}
            />
          </div>
          <div>
            <button 
              type="submit" 
              disabled={creating || !newCode || !discountPercent}
              className="w-full rounded-xl bg-indigo-500 py-2 text-sm font-medium text-white transition hover:bg-indigo-600 disabled:opacity-50"
            >
              {creating ? "Creating..." : "Create Promo Code"}
            </button>
          </div>
        </form>
      </div>

      {/* PROMOS TABLE */}
      <div className="rounded-2xl border border-white/10 bg-[#151515] overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-zinc-300">
            <thead className="bg-white/5 text-xs font-medium uppercase text-zinc-500">
              <tr>
                <th className="px-6 py-4">Code</th>
                <th className="px-6 py-4">Discount</th>
                <th className="px-6 py-4">Uses / Max</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Created At</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {promos.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-zinc-500">
                    No promo codes created yet.
                  </td>
                </tr>
              ) : (
                promos.map((p) => (
                  <tr key={p.id} className="hover:bg-white/[0.02] transition">
                    <td className="px-6 py-4 font-mono font-semibold text-white">{p.code}</td>
                    <td className="px-6 py-4 text-indigo-400">{p.discount_percent}% OFF</td>
                    <td className="px-6 py-4">
                      {p.times_used} {p.max_uses ? `/ ${p.max_uses}` : "-"}
                    </td>
                    <td className="px-6 py-4">
                      {p.is_active ? (
                        <span className="inline-flex items-center rounded-full bg-teal-500/10 px-2 py-1 text-xs font-medium text-teal-400 border border-teal-500/20">Active</span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-rose-500/10 px-2 py-1 text-xs font-medium text-rose-400 border border-rose-500/20">Inactive</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right text-zinc-500 lowercase">
                      {new Date(p.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
