"use client";

import { useEffect, useState } from "react";
import { getPromoCodes, createPromoCode, deletePromoCode, togglePromoStatus, type PromoCode } from "@/lib/admin-api";
import { getPlans, type PlanInfo } from "@/lib/api";

export default function PromosPage() {
  const [promos, setPromos] = useState<PromoCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);

  const [newCode, setNewCode] = useState("");
  const [discountPercent, setDiscountPercent] = useState<number | "">("");
  const [maxUses, setMaxUses] = useState<number | "">("");
  const [minAmount, setMinAmount] = useState<number | "">("");
  const [availablePlans, setAvailablePlans] = useState<PlanInfo[]>([]);
  const [selectedPlans, setSelectedPlans] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadPromos();
  }, []);

  async function loadPromos() {
    setLoading(true);
    try {
      const [data, plansData] = await Promise.all([
        getPromoCodes(),
        getPlans().catch(() => []) // gracefully handle error if plans fail
      ]);
      setPromos(data);
      setAvailablePlans(plansData.filter(p => p.price_inr_monthly > 0)); // only paid plans
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
        applicable_plans: selectedPlans.size > 0 ? Array.from(selectedPlans).join(",") : null,
      });
      setPromos([result, ...promos]);
      setNewCode("");
      setDiscountPercent("");
      setMaxUses("");
      setMinAmount("");
      setSelectedPlans(new Set());
    } catch (e: any) {
      setError(e.message || "Failed to create promo code");
    } finally {
      setCreating(false);
    }
  }

  if (loading) {
    return <div className="text-zinc-500 animate-pulse">Loading promos...</div>;
  }

  async function handleDelete(id: string) {
    if (!confirm("Are you sure you want to delete this promo code?")) return;
    try {
      await deletePromoCode(id);
      setPromos(promos.filter(p => p.id !== id));
    } catch (e: any) {
      setError(e.message || "Failed to delete promo code");
    }
  }

  async function handleToggle(id: string) {
    try {
      const result = await togglePromoStatus(id);
      setPromos(promos.map(p => 
        p.id === id ? { ...p, is_active: result.is_active } : p
      ));
    } catch (e: any) {
      setError(e.message || "Failed to toggle promo code status");
    }
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
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-4 items-end">
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
          </div>
          <div className="space-y-3">
            <label className="block text-xs font-medium text-zinc-400">Applicable Plans (Select which plans the promo is valid for, or leave empty for perfectly ALL plans)</label>
            <div className="flex flex-wrap gap-2">
                {availablePlans.length === 0 && (
                    <span className="text-zinc-500 text-sm italic">No paid plans found to target.</span>
                )}
                {availablePlans.map(plan => {
                    const isSelected = selectedPlans.has(plan.name);
                    return (
                        <button
                            key={plan.name}
                            type="button"
                            onClick={() => {
                                const newSet = new Set(selectedPlans);
                                if (isSelected) newSet.delete(plan.name);
                                else newSet.add(plan.name);
                                setSelectedPlans(newSet);
                            }}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                                isSelected 
                                    ? "bg-indigo-500/20 text-indigo-300 border-indigo-500/50" 
                                    : "bg-white/5 text-zinc-400 border-white/10 hover:bg-white/10"
                            }`}
                        >
                            {plan.display_name}
                        </button>
                    )
                })}
            </div>
            <div className="pt-2 sm:w-1/4 pb-1">
              <button 
                type="submit" 
              disabled={creating || !newCode || !discountPercent}
              className="w-full rounded-xl bg-indigo-500 py-2 text-sm font-medium text-white transition hover:bg-indigo-600 disabled:opacity-50"
            >
              {creating ? "Creating..." : "Create Promo Code"}
              </button>
            </div>
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
                <th className="px-6 py-4">Plans</th>
                <th className="px-6 py-4">Uses / Max</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
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
                    <td className="px-6 py-4 text-xs text-zinc-400">
                        {p.applicable_plans ? (
                            <div className="flex flex-wrap gap-1">
                                {p.applicable_plans.split(",").map(pl => (
                                    <span key={pl} className="bg-white/5 px-1.5 py-0.5 rounded border border-white/10">{pl.trim()}</span>
                                ))}
                            </div>
                        ) : (
                            <span className="text-zinc-500">All Plans</span>
                        )}
                    </td>
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
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-3 cursor-pointer select-none">
                        <button
                          onClick={() => handleToggle(p.id)}
                          role="switch"
                          aria-checked={p.is_active ? "true" : "false"}
                          title={p.is_active ? "Deactivate Promo Code" : "Activate Promo Code"}
                          className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-[#111111] ${
                              p.is_active ? 'bg-indigo-500' : 'bg-zinc-700'
                          }`}
                        >
                          <span className="sr-only">Toggle Active status</span>
                          <span
                            aria-hidden="true"
                            className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                p.is_active ? 'translate-x-4' : 'translate-x-0'
                            }`}
                          />
                        </button>
                        <button 
                          onClick={() => handleDelete(p.id)}
                          className="text-xs text-rose-400 hover:text-rose-300 border border-rose-500/20 px-2 py-1 rounded hover:bg-rose-500/10 transition"
                          title="Delete Promo Code"
                        >
                          Delete
                        </button>
                      </div>
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
