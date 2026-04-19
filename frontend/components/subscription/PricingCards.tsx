"use client";

import { useState, useRef, useEffect } from "react";
import type { PlanInfo } from "@/lib/api";

/* ── Feature labels matching our backend plan gating ────────────────── */
function getFeatures(plan: PlanInfo | 'basic' | 'premium'): string[] {
  if (plan === 'basic') {
     return [
        "Up to 150 requests / day",
        "Up to 100 memory slots",
        "Up to 20 memory writes / day",
        "Up to 20 reminders / day",
        "Long-term reminders unlocked",
     ];
  }
  if (plan === 'premium') {
     return [
        "Up to 5000 requests / day",
        "Up to 10000 memory slots",
        "Up to 500 memory writes / day",
        "Up to 500 reminders / day",
        "Voice input & Premium TTS",
     ];
  }

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

// Represents a single, specific plan
function SinglePlanCard({
    plan,
    isRecommended,
    cycle,
    currentPlan,
    onSelectPlan,
    loading
}: {
    plan: PlanInfo;
    isRecommended?: boolean;
    cycle: "monthly" | "yearly";
    currentPlan?: string;
    onSelectPlan: (planName: string, cycle: "monthly" | "yearly") => void;
    loading?: boolean;
}) {
    const isCurrent = currentPlan === plan.name;
    const isFree = plan.price_inr_monthly === 0;
    const price = cycle === "monthly" ? plan.price_inr_monthly : plan.price_inr_yearly;

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
                    {plan.display_name}
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
            <div className="mt-8 flex-1">
                 <ul className="flex flex-col gap-3.5">
                    {getFeatures(plan).map((f) => (
                    <li key={f} className="flex items-start gap-3 text-sm text-zinc-300">
                        <CheckIcon className={`mt-0.5 h-[18px] w-[18px] shrink-0 ${isRecommended ? 'text-cyan-400' : 'text-zinc-400'}`} />
                        <span className="leading-tight">{f}</span>
                    </li>
                    ))}
                </ul>
            </div>
             <button
                onClick={() => !isCurrent && !isFree && onSelectPlan(plan.name, cycle)}
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
                {isCurrent ? "Current Plan" : isFree ? "Free Forever" : `Select Plan`}
              </button>
        </div>
    );
}

// Represents a category that groups multiple plans
function GroupCard({
    title,
    subPlans,
    groupType,
    onOpenModal
}: {
    title: string;
    subPlans: PlanInfo[];
    groupType: 'basic' | 'premium';
    onOpenModal: (plans: PlanInfo[], type: 'basic' | 'premium') => void;
}) {
    const hoverTimer = useRef<NodeJS.Timeout | null>(null);

    const handleMouseEnter = () => {
        hoverTimer.current = setTimeout(() => {
            onOpenModal(subPlans, groupType);
        }, 2000); // 2 second hover
    };

    const handleMouseLeave = () => {
        if (hoverTimer.current) {
            clearTimeout(hoverTimer.current);
            hoverTimer.current = null;
        }
    };

    return (
        <div 
            className="group relative flex flex-col rounded-3xl border border-white/[0.08] bg-[#111111]/80 p-7 transition-all duration-300 hover:border-white/[0.2] hover:bg-[#151515] hover:shadow-xl hover:shadow-white/[0.05] cursor-pointer"
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            onTouchStart={() => onOpenModal(subPlans, groupType)} // Instant open on mobile tap
            onClick={() => onOpenModal(subPlans, groupType)}
        >
            <div className="absolute top-4 right-4">
               <svg className="w-5 h-5 text-zinc-600 transition-colors group-hover:text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"></path></svg>
            </div>
            <div className="text-center">
                <h3 className="text-sm font-bold uppercase tracking-widest text-zinc-400">
                    {title}
                </h3>
                <div className="mt-4 flex items-center justify-center gap-1">
                    <span className="text-3xl font-bold tracking-tight text-white mb-2">
                        View Subscriptions
                    </span>
                </div>
            </div>
            <div className="mt-8 flex-1">
                 <ul className="flex flex-col gap-3.5">
                    {getFeatures(groupType).map((f) => (
                    <li key={f} className="flex items-start gap-3 text-sm text-zinc-300">
                        <CheckIcon className="mt-0.5 h-[18px] w-[18px] shrink-0 text-zinc-500" />
                        <span className="leading-tight">{f}</span>
                    </li>
                    ))}
                </ul>
            </div>
             <button
                className="mt-8 w-full rounded-2xl py-3.5 text-[15px] font-bold transition-all duration-300 border border-white/[0.1] bg-white/[0.05] text-white group-hover:bg-white/[0.1]"
              >
                Expand Details
              </button>
        </div>
    );
}

export function PricingCards({ plans, currentPlan, onSelectPlan, loading }: Props) {
  const [cycle, setCycle] = useState<"monthly" | "yearly">("monthly");
  
  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalPlans, setModalPlans] = useState<PlanInfo[]>([]);
  const [modalType, setModalType] = useState<'basic' | 'premium' | null>(null);

  const freePlans = plans.filter(p => p.name === "free");
  const basicGroup = plans.filter(p => ["basic_29", "standard_49", "pro_99"].includes(p.name));
  const proPlan = plans.find(p => p.name === "premium_499"); // Pro is the 499 plan now
  const premiumGroup = plans.filter(p => ["ultra_999", "elite_1299", "apex_1999"].includes(p.name));

  const handleOpenModal = (subPlans: PlanInfo[], type: 'basic' | 'premium') => {
      setModalPlans(subPlans);
      setModalType(type);
      setModalOpen(true);
  };

  return (
    <>
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
              className={`rounded-full px-7 py-2.5 text-sm font-semibold transition-all duration-300 flex items-center gap-2 ${
                  cycle === "yearly"
                  ? "bg-[#222] text-white shadow-lg"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
              >
              Yearly
              <span className="rounded bg-teal-500/20 px-1.5 py-0.5 text-[10px] uppercase font-bold text-teal-400">Offer - Save 20%</span>
              </button>
            </div>
        </div>

        {/* ── 4 Category Grid ──────────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 max-w-[1400px] mx-auto">
          {freePlans.length > 0 && (
              <SinglePlanCard 
                  plan={freePlans[0]}
                  cycle={cycle}
                  currentPlan={currentPlan}
                  onSelectPlan={onSelectPlan}
                  loading={loading}
              />
          )}

          {basicGroup.length > 0 && (
              <GroupCard 
                  title="Basic Series"
                  subPlans={basicGroup}
                  groupType="basic"
                  onOpenModal={handleOpenModal}
              />
          )}

          {proPlan && (
              <SinglePlanCard 
                  plan={proPlan}
                  isRecommended={true} // Pro is recommended by default globally
                  cycle={cycle}
                  currentPlan={currentPlan}
                  onSelectPlan={onSelectPlan}
                  loading={loading}
              />
          )}

          {premiumGroup.length > 0 && (
              <GroupCard 
                  title="Premium Series"
                  subPlans={premiumGroup}
                  groupType="premium"
                  onOpenModal={handleOpenModal}
              />
          )}
        </div>
      </div>

      {/* ── Modal Overlay for Groups ──────────────────────────────────────── */}
      {modalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
              <div className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity" onClick={() => setModalOpen(false)}></div>
              
              <div className="relative w-full max-w-6xl animate-message-in rounded-3xl border border-white/[0.08] bg-[#0c0c0c] p-6 sm:p-10 shadow-2xl overflow-y-auto max-h-[90vh]">
                  <button 
                      onClick={() => setModalOpen(false)}
                      className="absolute top-6 right-6 rounded-full bg-white/5 p-2 text-zinc-400 hover:bg-white/10 hover:text-white transition"
                  >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                  </button>

                  <div className="mb-10 text-center">
                      <h2 className="text-3xl font-bold text-white capitalize">{modalType} Subscriptions</h2>
                      <p className="mt-2 text-zinc-400">Select the specific tier that matches your load requirements.</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      {modalPlans.map((plan) => {
                          const isRecommended = 
                             (modalType === 'basic' && plan.name === 'standard_49') ||
                             (modalType === 'premium' && plan.name === 'ultra_999');

                          return (
                              <SinglePlanCard 
                                  key={plan.name}
                                  plan={plan}
                                  isRecommended={isRecommended}
                                  cycle={cycle}
                                  currentPlan={currentPlan}
                                  onSelectPlan={(name, c) => {
                                      setModalOpen(false);
                                      onSelectPlan(name, c);
                                  }}
                                  loading={loading}
                              />
                          );
                      })}
                  </div>
              </div>
          </div>
      )}
    </>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <polyline points="20 6 9 17 4 12"></polyline>
    </svg>
  );
}
