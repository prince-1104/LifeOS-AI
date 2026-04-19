declare module "@cashfreepayments/cashfree-js" {
  interface CashfreeCheckoutOptions {
    paymentSessionId: string;
    redirectTarget?: "_self" | "_modal" | "_blank";
  }

  interface CashfreeCheckoutResult {
    error?: { message: string };
    redirect?: boolean;
    paymentDetails?: Record<string, unknown>;
  }

  interface CashfreeInstance {
    checkout(options: CashfreeCheckoutOptions): Promise<CashfreeCheckoutResult>;
  }

  interface LoadOptions {
    mode: "sandbox" | "production";
  }

  export function load(options: LoadOptions): Promise<CashfreeInstance>;
}
