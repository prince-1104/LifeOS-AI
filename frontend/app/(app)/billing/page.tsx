"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useAuth } from "@clerk/nextjs";
import { getSubscriptionStatus, verifyOrder, type SubscriptionStatus } from "@/lib/api";
import { UsageBars } from "@/components/subscription/UsageBars";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";

export default function BillingPage() {
  const { getToken } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<SubscriptionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [verifyMessage, setVerifyMessage] = useState("");
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const verifyAttemptRef = useRef(0);

  // Detect payment return — support both ?status=success and ?payment=success and ?order_id=xxx
  const isReturnFromPayment =
    searchParams?.get("status") === "success" ||
    searchParams?.get("payment") === "success" ||
    !!searchParams?.get("order_id");

  const orderIdFromUrl = searchParams?.get("order_id") || null;

  /**
   * Verify the payment with Cashfree and activate the plan.
   * Retries up to 5 times with increasing delays to handle webhook race conditions.
   */
  const verifyPayment = useCallback(
    async (orderId: string, attempt: number = 1): Promise<boolean> => {
      const MAX_ATTEMPTS = 5;
      const DELAYS = [0, 2000, 4000, 6000, 8000]; // progressive delays

      try {
        setVerifying(true);
        setVerifyMessage(
          attempt === 1
            ? "Verifying your payment..."
            : `Verifying payment (attempt ${attempt}/${MAX_ATTEMPTS})...`
        );

        const result = await verifyOrder(getToken, orderId);

        if (result.plan_activated) {
          setVerifyMessage("✅ Payment verified! Plan activated.");
          setPaymentSuccess(true);
          // Reload subscription status to show updated plan
          const freshStatus = await getSubscriptionStatus(getToken);
          setStatus(freshStatus);
          setVerifying(false);
          return true;
        }

        if (result.status === "PAID") {
          // Already paid but somehow not activated — this shouldn't happen
          // but the verify endpoint handles it
          setVerifyMessage("✅ Payment confirmed!");
          setPaymentSuccess(true);
          const freshStatus = await getSubscriptionStatus(getToken);
          setStatus(freshStatus);
          setVerifying(false);
          return true;
        }

        if (
          (result.status === "ACTIVE" || result.status === "PENDING") &&
          attempt < MAX_ATTEMPTS
        ) {
          // Payment still processing — retry after delay
          setVerifyMessage("Payment is processing... please wait.");
          await new Promise((r) => setTimeout(r, DELAYS[attempt] || 3000));
          return verifyPayment(orderId, attempt + 1);
        }

        // Failed or exhausted retries
        if (attempt >= MAX_ATTEMPTS) {
          setVerifyMessage(
            "Payment verification is taking longer than expected. " +
              "Your plan will be activated shortly. If not, please contact support at doptonin@gmail.com"
          );
        } else {
          setVerifyMessage(result.message || "Could not verify payment.");
        }
        setVerifying(false);
        return false;
      } catch (e) {
        console.error("[Billing] Verify error:", e);
        if (attempt < MAX_ATTEMPTS) {
          await new Promise((r) => setTimeout(r, DELAYS[attempt] || 3000));
          return verifyPayment(orderId, attempt + 1);
        }
        setVerifyMessage(
          "Payment verification failed. Your plan will be activated shortly via webhook. " +
            "If your plan is not updated within 5 minutes, please contact support at doptonin@gmail.com"
        );
        setVerifying(false);
        return false;
      }
    },
    [getToken]
  );

  useEffect(() => {
    async function load() {
      try {
        const data = await getSubscriptionStatus(getToken);
        setStatus(data);

        // If user just returned from payment, verify and activate
        if (isReturnFromPayment) {
          const orderId = orderIdFromUrl || data.cashfree_subscription_id;

          if (orderId) {
            // Check if plan is already active (webhook may have beaten us)
            const isAlreadyPaid =
              data.plan.price_inr_monthly > 0 && data.is_active;

            if (isAlreadyPaid) {
              setPaymentSuccess(true);
              setVerifyMessage("✅ Your plan is active!");
            } else {
              // Need to verify — webhook hasn't fired yet
              verifyAttemptRef.current += 1;
              if (verifyAttemptRef.current <= 1) {
                // Small delay to give webhook a chance to process first
                await new Promise((r) => setTimeout(r, 1500));
                await verifyPayment(orderId);
              }
            }
          } else {
            // No order ID in URL — try using the one from DB (cashfree_subscription_id)
            if (data.cashfree_subscription_id) {
              verifyAttemptRef.current += 1;
              if (verifyAttemptRef.current <= 1) {
                await new Promise((r) => setTimeout(r, 1500));
                await verifyPayment(data.cashfree_subscription_id);
              }
            } else {
              setVerifyMessage(
                "Payment may still be processing. If your plan is not updated within 5 minutes, please contact support at doptonin@gmail.com"
              );
            }
          }
        }
      } catch (e) {
        setError("Failed to load billing status");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [getToken, isReturnFromPayment, orderIdFromUrl, verifyPayment]);

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

  if (error || !status) {
    return (
      <div className="p-8 text-center text-rose-400">
        <p>{error || "Could not load data"}</p>
      </div>
    );
  }

  const { plan, usage, is_active, plan_end_date } = status;
  const isFree = plan.price_inr_monthly === 0;

  const usageBars = [
    {
      label: "AI Generations",
      used: usage.requests_today,
      total: plan.daily_requests,
      icon: "⚡",
    },
    {
      label: "Neural Storage",
      used: usage.memory_writes_today,
      total: plan.memory_writes_per_day,
      icon: "🧠",
    },
    {
       label: "Reminders",
       used: usage.reminders_today,
       total: plan.reminders_per_day,
       icon: "⏰",
    }
  ];

  return (
    <div className="flex-1 overflow-y-auto px-4 py-8 md:px-8 lg:py-12">
      <div className="mx-auto max-w-5xl">

        {/* Payment verification / success banner */}
        {verifying && (
          <div className="mb-8 rounded-xl border border-cyan-500/20 bg-cyan-500/10 p-4 text-cyan-200 flex items-center gap-3">
            <div className="animate-spin rounded-full h-5 w-5 border-2 border-cyan-400 border-t-transparent" />
            <div>
              <p className="font-medium text-cyan-100">Verifying Payment</p>
              <p className="text-sm">{verifyMessage}</p>
            </div>
          </div>
        )}

        {paymentSuccess && !verifying && (
          <div className="mb-8 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-emerald-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                  <div className="rounded-full bg-emerald-500/20 p-1">
                    <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                  </div>
                  <div>
                    <p className="font-medium text-emerald-100">Payment Successful!</p>
                    <p className="text-sm">{verifyMessage || "Your subscription is now active."}</p>
                  </div>
              </div>
          </div>
        )}

        {!paymentSuccess && !verifying && isReturnFromPayment && verifyMessage && (
          <div className="mb-8 rounded-xl border border-amber-500/20 bg-amber-500/10 p-4 text-amber-200 flex items-center gap-3">
              <svg className="w-5 h-5 text-amber-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"></path></svg>
              <div>
                <p className="font-medium text-amber-100">Payment Processing</p>
                <p className="text-sm">{verifyMessage}</p>
              </div>
          </div>
        )}

        <div className="mb-10 flex flex-col items-start gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white">
              Account & Billing
            </h1>
            <p className="mt-2 text-[15px] text-zinc-400">
              Manage your digital intelligence resources.
            </p>
          </div>
          {isFree ? (
            <Link
              href="/pricing"
              className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-cyan-500 to-teal-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-cyan-500/20 transition hover:shadow-cyan-500/30 hover:brightness-110"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
              Upgrade to Premium
            </Link>
          ) : null}
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* ── Plan Overview ──────────────────────────────────────── */}
          <div className="col-span-1 flex flex-col rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 lg:col-span-2">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
              Current Plan
            </h2>
            <div className="mt-4 flex items-start justify-between">
              <div>
                <h3 className="text-3xl font-bold text-white">
                  {plan.display_name}
                </h3>
                <p className="mt-1 text-zinc-400">
                  <span className="text-lg font-medium text-zinc-300">
                    {isFree ? "₹0" : `₹${plan.price_inr_monthly}`}
                  </span>
                  <span className="text-sm"> / month</span>
                </p>
              </div>
              <div className={`flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-wider ${
                is_active
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                  : "border-rose-500/30 bg-rose-500/10 text-rose-400"
              }`}>
                <div className={`h-1.5 w-1.5 rounded-full ${is_active ? "bg-emerald-400" : "bg-rose-400"}`} />
                {is_active ? "Active" : "Expired"}
              </div>
            </div>

            <div className="mt-auto pt-8">
              {!isFree ? (
                 <button className="flex items-center gap-2 rounded-xl bg-indigo-500/20 px-5 py-2.5 text-sm font-medium text-indigo-300 transition hover:bg-indigo-500/30">
                    Manage Subscription <span>→</span>
                 </button>
              ) : (
                <Link href="/pricing" className="inline-flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.04] px-5 py-2.5 text-sm font-medium text-zinc-300 transition hover:bg-white/[0.08]">
                   View All Plans <span>→</span>
                </Link>
              )}
            </div>
          </div>

          {/* ── Payment Details ────────────────────────────────────── */}
          <div className="col-span-1 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 lg:col-span-1">
             <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-500 mb-4">
              Next Payment
            </h2>
            {isFree ? (
                <div className="flex h-[100px] items-center justify-center rounded-xl bg-white/[0.02] border border-dashed border-white/[0.05]">
                    <p className="text-sm text-zinc-500">No active billing cycle</p>
                </div>
            ) : (
                <div>
                     <p className="text-xl font-bold text-white">
                        {plan_end_date ? new Date(plan_end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : "N/A"}
                     </p>
                     <p className="mt-1 flex items-center gap-1.5 text-sm text-emerald-400/80">
                         <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
                         Auto-renew enabled
                     </p>

                     <div className="mt-8 border-t border-white/[0.06] pt-6">
                          <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-500 mb-4">
                            Payment Method
                          </h2>
                          <div className="flex items-center gap-3 rounded-xl bg-[#141414] p-3 border border-white/[0.04]">
                               <div className="bg-white/10 p-1.5 rounded flex items-center justify-center">
                                  <svg className="w-5 h-5 text-white/50" viewBox="0 0 24 24" fill="currentColor"><path d="M2.5 7a2.5 2.5 0 0 1 2.5-2.5h14A2.5 2.5 0 0 1 21.5 7v10a2.5 2.5 0 0 1-2.5 2.5H5A2.5 2.5 0 0 1 2.5 17V7zm2.5-1a1.5 1.5 0 0 0-1.5 1.5V9h17V7.5A1.5 1.5 0 0 0 19 6H5zm16 4h-17v5.5A1.5 1.5 0 0 0 5 17h14a1.5 1.5 0 0 0 1.5-1.5V10z"/></svg>
                               </div>
                               <div>
                                   <p className="text-sm font-medium text-white">Cashfree Subscription</p>
                                   <p className="text-xs text-zinc-500">Managed via Gateway</p>
                               </div>
                          </div>
                     </div>
                </div>
            )}
          </div>
        </div>

        {/* ── Resource Allocation ────────────────────────────────── */}
        <div className="mt-8">
          <div className="mb-4 flex items-center justify-between">
             <h2 className="text-lg font-semibold text-white">Daily Resource Allocation</h2>
             <span className="text-xs font-medium text-zinc-500 uppercase tracking-widest">Resets in 12h</span>
          </div>
          <UsageBars bars={usageBars} />
        </div>

      </div>
    </div>
  );
}
