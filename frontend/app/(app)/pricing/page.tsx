"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { getPlans, createSubscription, type PlanInfo, getSubscriptionStatus } from "@/lib/api";
import { PricingCards } from "@/components/subscription/PricingCards";
import { useRouter } from "next/navigation";

export default function PricingPage() {
  const { getToken } = useAuth();
  const router = useRouter();
  const [plans, setPlans] = useState<PlanInfo[]>([]);
  const [currentPlan, setCurrentPlan] = useState<string>("free");
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadData() {
      try {
        const [plansData, statusData] = await Promise.all([
          getPlans(),
          getSubscriptionStatus(getToken),
        ]);
        setPlans(plansData);
        if (statusData.plan) {
          setCurrentPlan(statusData.plan.name);
        }
      } catch (e) {
        setError("Failed to load plans.");
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [getToken]);

  const handleSelectPlan = async (planId: string, cycle: "monthly" | "yearly") => {
    setProcessing(true);
    setError("");
    try {
      const res = await createSubscription(getToken, {
        plan_id: planId,
        billing_cycle: cycle,
        return_url: `${window.location.origin}/billing`,
      });
      // Redirect to Cashfree payment page
      window.location.href = res.authorization_link;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to initiate subscription");
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex items-center gap-2 text-zinc-500">
          <span className="typing-dot h-2 w-2 rounded-full bg-slate-500" />
          <span className="typing-dot h-2 w-2 rounded-full bg-slate-500" />
          <span className="typing-dot h-2 w-2 rounded-full bg-slate-500" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-8 md:px-8 lg:py-12">
      <div className="mx-auto max-w-7xl">
        <div className="mb-12 text-center">
          <h1 className="bg-gradient-to-br from-white to-zinc-500 bg-clip-text text-3xl font-bold tracking-tight text-transparent sm:text-4xl">
            Subscription Architectures
          </h1>
          <p className="mt-4 text-[15px] text-zinc-400">
            Choose the neural capacity required for your operations. All plans include our core ethereal processing engine.
          </p>
        </div>

        {error && (
          <div className="mx-auto mb-8 max-w-2xl rounded-xl border border-rose-500/20 bg-rose-500/10 p-4 text-center text-sm text-rose-200">
            {error}
          </div>
        )}

        <PricingCards
          plans={plans}
          currentPlan={currentPlan}
          onSelectPlan={handleSelectPlan}
          loading={processing}
        />
        
        <div className="mt-16 flex items-center justify-between rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 sm:p-8">
            <div className="max-w-xl">
                <h3 className="text-lg font-semibold text-white">Need a tailored solution?</h3>
                <p className="mt-2 text-sm text-zinc-400">For organizations requiring specialized neural weights or specific hardware compliance, our engineering team can architect a bespoke environment.</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
                <button className="rounded-xl border border-white/[0.08] bg-white/[0.04] px-6 py-2.5 text-sm font-medium text-zinc-300 transition hover:bg-white/[0.08]">View FAQ</button>
                <button className="rounded-xl bg-cyan-500/10 px-6 py-2.5 text-sm font-semibold text-cyan-400 transition hover:bg-cyan-500/20">Inquire Now</button>
            </div>
        </div>
      </div>
    </div>
  );
}
