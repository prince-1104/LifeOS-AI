"use client";

import { useState } from "react";
import type { PlanInfo } from "@/lib/api";

/* ── Feature labels matching our backend plan gating ────────────────── */
function getFeatures(plan: PlanInfo): string[] {
  const f: string[] = [];
  f.push(`${plan.daily_requests} requests / day`);
  f.push(`${plan.memory_storage_limit} memory slots`);
  f.push(`${plan.memory_writes_per_day} memory writes / day`);
  f.push(`${plan.reminders_per_day} reminders / day`);
  if (plan.long_term_reminder) f.push("Long-term reminders");
  if (plan.voice_input) f.push("Voice input");
  if (plan.premium_tts) f.push("Premium text-to-speech");
  return f;
}

type Props = {
  plans: PlanInfo[];
  currentPlan?: string;
  onSelectPlan: (planName: string, cycle: "monthly" | "yearly") => void;
  loading?: boolean;
};

// A highly dynamic card that can represent a single plan or a group of plans (with internal toggles)
function CategoryCard({
    title,
    subPlans,
    defaultPlanName,
    isRecommended,
    cycle,
    currentPlan,
    onSelectPlan,
    loading
}: {
    title: string;
    subPlans: PlanInfo[];
    defaultPlanName: string;
    isRecommended?: boolean;
    cycle: "monthly" | "yearly";
    currentPlan?: string;
    onSelectPlan: (planName: string, cycle: "monthly" | "yearly") => void;
    loading?: boolean;
}) {
    // Determine which plan is actively being viewed in this card
    const [activePlanName, setActivePlanName] = useState<string>(defaultPlanName);
    const activePlan = subPlans.find(p => p.name === activePlanName) || subPlans[0];
    
    if (!activePlan) return null;

    const isCurrent = currentPlan === activePlan.name;
    const isFree = activePlan.price_inr_monthly === 0;
    const price = cycle === "monthly" ? activePlan.price_inr_monthly : activePlan.price_inr_yearly;

    return (
        <div className={`relative flex flex-col rounded-3xl border p-7 transition-all duration-300 ${
            isRecommended
                ? "border-cyan-500/40 bg-gradient-to-b from-cyan-500/[0.08] to-transparent shadow-2xl shadow-cyan-900/20"
                : "border-white/[0.08] bg-[#111111]/80 hover:border-white/[0.15] hover:bg-[#151515]"
        }`}>
            {isRecommended && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                    <span className="rounded-full bg-gradient-to-r from-cyan-500 to-teal-500 px-4 py-1 text-[11px] font-bold uppercase tracking-widest text-white shadow-lg shadow-cyan-500/30">
                        Recommended
                    </span>
                </div>
            )}

            <div className="text-center">
                <h3 className={`text-sm font-bold uppercase tracking-widest ${isRecommended ? 'text-cyan-400' : 'text-zinc-400'}`}>
                    {title}
                </h3>
                <div className="mt-4 flex items-center justify-center gap-1">
                    <span className="text-4xl font-extrabold tracking-tight text-white">
                        {isFree ? "₹0" : `₹${price}`}
                    </span>
                    {!isFree && (
                        <span className="text-sm font-medium text-zinc-500">
                            /{cycle === "monthly" ? "mo" : "yr"}
                        </span>
                    )}
                </div>
            </div>

            {/* Sub-plan Toggle Selector (only if multiple plans exist in this category) */}
            {subPlans.length > 1 && (
                <div className="mt-6 flex items-center justify-center gap-1 rounded-xl bg-black/40 p-1 border border-white/[0.05]">
                    {subPlans.map(p => (
                        <button
                            key={p.name}
                            onClick={() => setActivePlanName(p.name)}
                            className={`flex-1 rounded-lg py-1.5 text-[11px] font-bold uppercase tracking-wider transition-all duration-200 ${
                                activePlanName === p.name 
                                    ? "bg-white/10 text-white shadow-sm" 
                                    : "text-zinc-500 hover:text-zinc-300"
                            }`}
                        >
                            {p.display_name.split(" ")[0]} {/* e.g. "₹29" from "₹29 Basic" */}
                        </button>
                    ))}
                </div>
            )}

            {/* Features */}
            <div className="mt-8 flex-1">
                 <ul className="flex flex-col gap-3.5">
                    {getFeatures(activePlan).map((f) => (
                    <li key={f} className="flex items-start gap-3 text-sm text-zinc-300">
                        <CheckIcon className={`mt-0.5 h-[18px] w-[18px] shrink-0 ${isRecommended ? 'text-cyan-400' : 'text-zinc-400'}`} />
                        <span className="leading-tight">{f}</span>
                    </li>
                    ))}
                </ul>
            </div>

            {/* CTA Button */}
             <button
                onClick={() => !isCurrent && !isFree && onSelectPlan(activePlan.name, cycle)}
                disabled={isCurrent || isFree || loading}
                className={`mt-8 w-full rounded-2xl py-3.5 text-[15px] font-bold transition-all duration-300 ${
                  isCurrent
                    ? "cursor-default border border-cyan-500/30 bg-cyan-500/10 text-cyan-300"
                    : isFree
                      ? "cursor-default border border-white/[0.08] bg-white/[0.03] text-zinc-500"
                      : isRecommended
                        ? "bg-gradient-to-r from-cyan-500 to-teal-500 text-white shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40 hover:brightness-110 active:scale-[0.98] disabled:opacity-50"
                        : "border border-white/[0.1] bg-white/[0.05] text-white hover:bg-white/[0.1] active:scale-[0.98] disabled:opacity-50"
                }`}
              >
                {isCurrent ? "Current Plan" : isFree ? "Free Forever" : `Select ${activePlan.display_name}`}
              </button>
        </div>
    );
}

export function PricingCards({ plans, currentPlan, onSelectPlan, loading }: Props) {
  const [cycle, setCycle] = useState<"monthly" | "yearly">("monthly");

  // Grouping logic based on user requirements:
  const freePlans = plans.filter(p => p.name === "free");
  const basicGroup = plans.filter(p => ["basic_29", "standard_49", "pro_99"].includes(p.name));
  const proGroup = plans.filter(p => p.name === "premium_499");
  const premiumGroup = plans.filter(p => ["ultra_999", "elite_1299", "apex_1999"].includes(p.name));

  return (
    <div className="w-full">
      {/* ── Cycle Toggle ─────────────────────────────────────────── */}
      <div className="mb-12 flex flex-col items-center justify-center gap-4">
          <div className="flex items-center gap-1.5 rounded-full bg-white/[0.04] p-1.5 border border-white/[0.05] shadow-inner">
            <button
            onClick={() => setCycle("monthly")}
            className={`rounded-full px-7 py-2.5 text-sm font-semibold transition-all duration-300 ${
                cycle === "monthly"
                ? "bg-[#222] text-white shadow-lg"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
            >
            Monthly
            </button>
            <button
            onClick={() => setCycle("yearly")}
            className={`rounded-full px-7 py-2.5 text-sm font-semibold transition-all duration-300 ${
                cycle === "yearly"
                ? "bg-[#222] text-white shadow-lg"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
            >
            Yearly
            </button>
          </div>
          {cycle === "yearly" && (
            <span className="animate-message-in rounded-full border border-teal-500/30 bg-teal-500/10 px-3 py-1 text-xs font-bold uppercase tracking-widest text-teal-400">
                🎉 Saving 20% compared to monthly
            </span>
          )}
      </div>

      {/* ── 4 Category Grid ──────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 max-w-[1400px] mx-auto">
         {freePlans.length > 0 && (
            <CategoryCard 
                title="Exploration"
                subPlans={freePlans}
                defaultPlanName="free"
                cycle={cycle}
                currentPlan={currentPlan}
                onSelectPlan={onSelectPlan}
                loading={loading}
            />
         )}

         {basicGroup.length > 0 && (
            <CategoryCard 
                title="Basic"
                subPlans={basicGroup}
                defaultPlanName="standard_49" // Recommended default
                isRecommended={true}
                cycle={cycle}
                currentPlan={currentPlan}
                onSelectPlan={onSelectPlan}
                loading={loading}
            />
         )}

         {proGroup.length > 0 && (
            <CategoryCard 
                title="Pro"
                subPlans={proGroup}
                defaultPlanName="premium_499"
                cycle={cycle}
                currentPlan={currentPlan}
                onSelectPlan={onSelectPlan}
                loading={loading}
            />
         )}

         {premiumGroup.length > 0 && (
            <CategoryCard 
                title="Premium"
                subPlans={premiumGroup}
                defaultPlanName="elite_1299" // Default middle option
                cycle={cycle}
                currentPlan={currentPlan}
                onSelectPlan={onSelectPlan}
                loading={loading}
            />
         )}
      </div>
    </div>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <polyline points="20 6 9 17 4 12"></polyline>
    </svg>
  );
}
