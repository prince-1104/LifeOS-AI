"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState, Suspense } from "react";
import { load as loadCashfree } from "@cashfreepayments/cashfree-js";

/**
 * /checkout — Cashfree payment checkout page.
 *
 * This page is opened by the mobile app (via WebBrowser) to handle
 * Cashfree payments using their JS SDK. It receives:
 *   - session_id: Cashfree payment_session_id
 *   - order_id: our internal order ID
 *   - env: "sandbox" or "production"
 *
 * It automatically loads the Cashfree SDK and opens checkout.
 */

function CheckoutContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams?.get("session_id") || "";
  const orderId = searchParams?.get("order_id") || "";
  const env = searchParams?.get("env") || "sandbox";
  const [status, setStatus] = useState<"loading" | "error" | "redirecting" | "success" | "failed">("loading");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!sessionId) {
      setStatus("error");
      setError("Missing payment session. Please go back and try again.");
      return;
    }

    async function initCheckout() {
      try {
        setStatus("loading");
        const mode = env === "production" ? "production" as const : "sandbox" as const;
        const cashfree = await loadCashfree({ mode });

        const result = await cashfree.checkout({
          paymentSessionId: sessionId,
          redirectTarget: "_self",
        });

        if (result.error) {
          setStatus("error");
          setError(result.error.message || "Payment failed. Please try again.");
        } else if (result.redirect) {
          setStatus("redirecting");
        } else if (result.paymentDetails) {
          setStatus("success");
          // Redirect to billing page with success
          window.location.href = `https://cortexa.doptonin.online/billing?payment=success&order_id=${orderId}`;
        }
      } catch (err: any) {
        setStatus("error");
        setError(err?.message || "Could not load payment page. Please try again.");
      }
    }

    initCheckout();
  }, [sessionId, orderId, env]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0a0a0a] px-4">
      <div className="w-full max-w-md text-center">
        {status === "loading" && (
          <div className="flex flex-col items-center gap-6">
            <div className="relative">
              <div className="h-16 w-16 rounded-full border-2 border-indigo-500/20" />
              <div className="absolute inset-0 h-16 w-16 animate-spin rounded-full border-2 border-transparent border-t-indigo-500" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white">Opening Payment</h2>
              <p className="mt-2 text-sm text-zinc-400">
                Please wait while we load the secure checkout...
              </p>
            </div>
          </div>
        )}

        {status === "redirecting" && (
          <div className="flex flex-col items-center gap-4">
            <div className="text-4xl">🔄</div>
            <h2 className="text-xl font-semibold text-white">Redirecting...</h2>
            <p className="text-sm text-zinc-400">
              You are being redirected to the payment page.
            </p>
          </div>
        )}

        {status === "success" && (
          <div className="flex flex-col items-center gap-4">
            <div className="text-4xl">✅</div>
            <h2 className="text-xl font-semibold text-emerald-400">Payment Successful!</h2>
            <p className="text-sm text-zinc-400">
              Your plan is being activated. You can close this window.
            </p>
          </div>
        )}

        {status === "error" && (
          <div className="flex flex-col items-center gap-4">
            <div className="text-4xl">❌</div>
            <h2 className="text-xl font-semibold text-rose-400">Payment Error</h2>
            <p className="mt-2 text-sm text-zinc-400">{error}</p>
            <button
              onClick={() => window.close()}
              className="mt-4 rounded-xl bg-white/[0.08] px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/[0.12]"
            >
              Close & Try Again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#0a0a0a]">
          <div className="h-16 w-16 animate-spin rounded-full border-2 border-transparent border-t-indigo-500" />
        </div>
      }
    >
      <CheckoutContent />
    </Suspense>
  );
}
