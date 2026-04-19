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

export function PricingCards({ plans, currentPlan, onSelectPlan, loading }: Props) {
  const [cycle, setCycle] = useState<"monthly" | "yearly">("monthly");

  return (
    <div className="w-full">
      {/* ── Cycle Toggle ─────────────────────────────────────────── */}
      <div className="mb-8 flex items-center justify-center gap-1 rounded-full bg-white/[0.04] p-1 mx-auto w-fit">
        <button
          onClick={() => setCycle("monthly")}
          className={`rounded-full px-5 py-2 text-sm font-medium transition-all duration-200 ${
            cycle === "monthly"
              ? "bg-cyan-500/20 text-cyan-300 shadow-sm shadow-cyan-500/10"
              : "text-zinc-400 hover:text-zinc-200"
          }`}
        >
          Monthly
        </button>
        <button
          onClick={() => setCycle("yearly")}
          className={`rounded-full px-5 py-2 text-sm font-medium transition-all duration-200 ${
            cycle === "yearly"
              ? "bg-cyan-500/20 text-cyan-300 shadow-sm shadow-cyan-500/10"
              : "text-zinc-400 hover:text-zinc-200"
          }`}
        >
          Yearly
          <span className="ml-1.5 text-[10px] font-bold uppercase text-emerald-400">
            Save 20%
          </span>
        </button>
      </div>

      {/* ── Plan Cards Grid ──────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {plans.map((plan) => {
          const isCurrent = currentPlan === plan.name;
          const isFree = plan.price_inr_monthly === 0;
          const isPopular = plan.name === "standard_49";
          const price = cycle === "monthly" ? plan.price_inr_monthly : plan.price_inr_yearly;

          return (
            <div
              key={plan.name}
              className={`group relative flex flex-col rounded-2xl border p-6 transition-all duration-300 ${
                isPopular
                  ? "border-cyan-500/40 bg-gradient-to-b from-cyan-500/[0.08] to-transparent shadow-lg shadow-cyan-500/5"
                  : "border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12] hover:bg-white/[0.04]"
              } ${isCurrent ? "ring-2 ring-cyan-500/30" : ""}`}
            >
              {/* Recommended badge */}
              {isPopular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="rounded-full bg-gradient-to-r from-cyan-500 to-teal-500 px-4 py-1 text-[10px] font-bold uppercase tracking-widest text-white shadow-lg shadow-cyan-500/30">
                    Recommended
                  </span>
                </div>
              )}

              {/* Plan name */}
              <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">
                {plan.display_name}
              </h3>

              {/* Price */}
              <div className="mt-3 flex items-baseline gap-1">
                <span className="text-3xl font-bold tracking-tight text-white">
                  {isFree ? "₹0" : `₹${price}`}
                </span>
                {!isFree && (
                  <span className="text-sm text-zinc-500">
                    /{cycle === "monthly" ? "mo" : "yr"}
                  </span>
                )}
              </div>

              {/* Features */}
              <ul className="mt-6 flex flex-1 flex-col gap-2.5">
                {getFeatures(plan).map((f) => (
                  <li key={f} className="flex items-start gap-2 text-[13px] text-zinc-300">
                    <CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-cyan-400" />
                    {f}
                  </li>
                ))}
              </ul>

              {/* CTA */}
              <button
                onClick={() => !isCurrent && !isFree && onSelectPlan(plan.name, cycle)}
                disabled={isCurrent || isFree || loading}
                className={`mt-6 w-full rounded-xl py-3 text-sm font-semibold transition-all duration-200 ${
                  isCurrent
                    ? "cursor-default border border-cyan-500/30 bg-cyan-500/10 text-cyan-300"
                    : isFree
                      ? "cursor-default border border-white/[0.08] bg-white/[0.03] text-zinc-500"
                      : isPopular
                        ? "bg-gradient-to-r from-cyan-500 to-teal-500 text-white shadow-lg shadow-cyan-500/20 hover:shadow-cyan-500/30 hover:brightness-110 disabled:opacity-50"
                        : "border border-white/[0.08] bg-white/[0.04] text-zinc-200 hover:bg-white/[0.08] disabled:opacity-50"
                }`}
              >
                {isCurrent ? "Current Plan" : isFree ? "Free Forever" : "Select Plan"}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor" aria-hidden>
      <path
        fillRule="evenodd"
        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
        clipRule="evenodd"
      />
    </svg>
  );
}
