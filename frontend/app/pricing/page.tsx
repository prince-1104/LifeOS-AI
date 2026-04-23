"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { getPlans, createSubscription, verifyOrder, validatePromoCode, type PlanInfo, getSubscriptionStatus, ValidatePromoResponse } from "@/lib/api";
import { PricingCards } from "@/components/subscription/PricingCards";
import { useRouter } from "next/navigation";
import { load as loadCashfree } from "@cashfreepayments/cashfree-js";
import Link from "next/link";
import Image from "next/image";

export default function PricingPage() {
  const { getToken, isSignedIn, isLoaded } = useAuth();
  const router = useRouter();
  const [plans, setPlans] = useState<PlanInfo[]>([]);
  const [currentPlan, setCurrentPlan] = useState<string>("free");
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");
  
  const [promoCode, setPromoCode] = useState("");
  const [promoMessage, setPromoMessage] = useState("");
  const [appliedPromo, setAppliedPromo] = useState<ValidatePromoResponse | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        // Plans are public — always fetch
        const plansData = await getPlans();
        setPlans(plansData);

        // Subscription status requires auth — only fetch if signed in
        if (isSignedIn) {
          try {
            const statusData = await getSubscriptionStatus(getToken);
            if (statusData.plan) {
              setCurrentPlan(statusData.plan.name);
            }
          } catch {
            // If status fetch fails, just show plans without current plan highlight
          }
        }
      } catch (e) {
        setError("Failed to load plans.");
      } finally {
        setLoading(false);
      }
    }

    // Wait for Clerk to load before deciding what to fetch
    if (isLoaded) {
      loadData();
    }
  }, [getToken, isSignedIn, isLoaded]);

  const handleApplyPromo = async () => {
    if (!promoCode.trim()) return;

    if (!isSignedIn) {
      setPromoMessage("Please sign in to apply a promo code.");
      return;
    }
    
    setPromoMessage("Validating...");
    try {
      const res = await validatePromoCode(getToken, {
        promo_code: promoCode
      });
      setAppliedPromo(res);
      setPromoMessage(res.message);
    } catch (e) {
      setAppliedPromo(null);
      setPromoMessage("Invalid or expired promo code.");
    }
  };

  const handleSelectPlan = async (planId: string, cycle: "monthly" | "yearly") => {
    // If not signed in, redirect to sign-in first
    if (!isSignedIn) {
      router.push(`/sign-in?redirect_url=/pricing`);
      return;
    }

    setProcessing(true);
    setError("");
    try {
      const res = await createSubscription(getToken, {
        plan_id: planId,
        billing_cycle: cycle,
        return_url: `${window.location.origin}/billing`,
        promo_code: (appliedPromo?.valid) ? promoCode : undefined,
      });

      console.log("[Payment] Backend response:", res);

      if (res.payment_session_id) {
        try {
          const cashfreeMode = res.cashfree_env === "production" ? "production" as const : "sandbox" as const;
          
          console.log("[Payment] Initializing Cashfree SDK in", cashfreeMode, "mode");
          const cashfree = await loadCashfree({ mode: cashfreeMode });

          console.log("[Payment] Opening checkout with session:", res.payment_session_id.substring(0, 20) + "...");
          
          const result = await cashfree.checkout({
            paymentSessionId: res.payment_session_id,
            redirectTarget: "_modal",
          });

          console.log("[Payment] Checkout result:", result);

          if (result.error) {
            console.error("[Payment] Checkout error:", result.error);
            setError(`Payment failed: ${result.error.message || "Unknown error"}`);
            setProcessing(false);
          } else if (result.redirect) {
            console.log("[Payment] Redirecting...");
          } else if (result.paymentDetails) {
            console.log("[Payment] Payment completed:", result.paymentDetails);
            // Verify payment directly before redirecting
            try {
              await verifyOrder(getToken, res.subscription_id);
            } catch (verifyErr) {
              console.warn("[Payment] Verify after modal failed, billing page will retry:", verifyErr);
            }
            router.push(`/billing?payment=success&order_id=${res.subscription_id}`);
          }
        } catch (sdkError: any) {
          console.error("[Payment] SDK error:", sdkError);
          setError(`Checkout failed: ${sdkError?.message || "Could not open payment page"}`);
          setProcessing(false);
        }
      } else if (res.authorization_link) {
        console.log("[Payment] Using direct link:", res.authorization_link);
        window.location.href = res.authorization_link;
      } else {
        setError("No payment session received. Please try again.");
        setProcessing(false);
      }
    } catch (e) {
      console.error("[Payment] API error:", e);
      setError(e instanceof Error ? e.message : "Failed to initiate payment");
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0a0a0a]">
        <div className="flex items-center gap-2 text-zinc-500">
          <span className="typing-dot h-2 w-2 rounded-full bg-slate-500" />
          <span className="typing-dot h-2 w-2 rounded-full bg-slate-500" />
          <span className="typing-dot h-2 w-2 rounded-full bg-slate-500" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#0a0a0a] text-slate-100">
      {/* ── Minimal Header ──────────────────────────────────────────── */}
      <header className="flex items-center justify-between border-b border-white/[0.06] px-6 py-4">
        <Link href="/" className="flex items-center gap-2 text-sm font-semibold tracking-tight text-white">
          <Image src="/logo.png" alt="Cortexa AI" width={28} height={28} className="rounded-md" />
          Cortexa AI
        </Link>
        <div className="flex items-center gap-3">
          {isSignedIn ? (
            <Link
              href="/chat"
              className="rounded-xl bg-white/[0.06] px-5 py-2 text-sm font-medium text-zinc-300 transition hover:bg-white/[0.1]"
            >
              Go to App
            </Link>
          ) : (
            <>
              <Link
                href="/sign-in"
                className="rounded-xl px-5 py-2 text-sm font-medium text-zinc-400 transition hover:text-white"
              >
                Sign In
              </Link>
              <Link
                href="/sign-up"
                className="rounded-xl bg-gradient-to-r from-cyan-500 to-teal-500 px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-cyan-500/20 transition hover:shadow-cyan-500/30"
              >
                Get Started
              </Link>
            </>
          )}
        </div>
      </header>

      {/* ── Page Content ────────────────────────────────────────────── */}
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

          <div className="mx-auto mb-10 max-w-md flex flex-col items-center">
              <div className="flex w-full overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.03]">
                  <input 
                      type="text" 
                      placeholder="Enter Promo Code" 
                      className="w-full bg-transparent px-4 py-3 placeholder:text-zinc-600 focus:outline-none text-sm font-medium uppercase"
                      value={promoCode}
                      onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                  />
                  <button 
                    onClick={handleApplyPromo}
                    className="bg-white/[0.08] px-6 py-3 text-sm font-bold text-white transition hover:bg-white/[0.12] disabled:opacity-50"
                    disabled={!promoCode.trim()}
                  >
                      Apply
                  </button>
              </div>
              {promoMessage && (
                  <div className={`mt-3 flex flex-col items-center text-center ${appliedPromo?.valid ? 'text-teal-400' : 'text-rose-400'}`}>
                      <p className="text-sm font-medium">{promoMessage}</p>
                      {appliedPromo?.valid && appliedPromo.applicable_plans !== undefined && appliedPromo.applicable_plans !== null && appliedPromo.applicable_plans.length > 0 && (
                          <p className="text-xs mt-1 text-teal-500/80 max-w-[280px]">
                              Valid for: {appliedPromo.applicable_plans.map(p => p.replace('_', ' ').toUpperCase()).join(', ')}
                          </p>
                      )}
                      {appliedPromo?.valid && (!appliedPromo.applicable_plans || appliedPromo.applicable_plans.length === 0) && (
                          <p className="text-xs mt-1 text-teal-500/80">
                              Valid for: All Plans
                          </p>
                      )}
                  </div>
              )}
          </div>

          <PricingCards
            plans={plans}
            currentPlan={currentPlan}
            onSelectPlan={handleSelectPlan}
            loading={processing}
            discountPercent={appliedPromo?.discount_percent}
            applicablePlans={appliedPromo?.applicable_plans}
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
    </div>
  );
}
