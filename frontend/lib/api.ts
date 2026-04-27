const base = () => {
  if (typeof window !== "undefined") {
    // Rely on Next.js rewrite to avoid ISP DNS blocks.
    return "/api";
  }
  return process.env.NEXT_PUBLIC_API_BASE_URL || "/api";
};

/** Clerk session token getter from `useAuth().getToken`. */
export type GetToken = () => Promise<string | null>;

async function bearerAuth(getToken: GetToken): Promise<HeadersInit> {
  const token = await getToken();
  if (!token) {
    throw new Error("Not signed in");
  }
  return { Authorization: `Bearer ${token}` };
}

async function jsonAuth(getToken: GetToken): Promise<HeadersInit> {
  const h = await bearerAuth(getToken);
  return { ...h, "Content-Type": "application/json" };
}

export type ProcessType =
  | "memory"
  | "query"
  | "finance"
  | "reminder"
  | "limit"
  | "multi"
  | "unknown"
  | "error";

export type ProcessDataItem = {
  type?: string;
  content?: string;
  tags?: string[];
  query?: string;
  amount?: number;
  category?: string;
  transaction_type?: "income" | "expense";
  source?: string;
  task?: string;
  time?: string;
};

export type ProcessData = {
  content?: string;
  tags?: string[];
  query?: string;
  amount?: number;
  category?: string;
  transaction_type?: "income" | "expense";
  source?: string;
  task?: string;
  time?: string;
  items?: ProcessDataItem[];
} | null;

export type ProcessResponse = {
  success: boolean;
  type: ProcessType | string;
  response: string;
  data: ProcessData;
  timestamp: string;
  request_id: string;
};

export async function processInput(
  getToken: GetToken,
  params: {
    input: string;
    userTimezone?: string;
  },
): Promise<ProcessResponse> {
  const headers = await jsonAuth(getToken);
  const res = await fetch(`${base()}/process`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      input: params.input,
      user_timezone: params.userTimezone,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Request failed (${res.status})`);
  }
  return res.json() as Promise<ProcessResponse>;
}

export type WeeklySeriesPoint = { date: string; amount: string };
export type CategorySlice = { category: string; amount: string };
export type ActivityItem = {
  result_type: string;
  query: string;
  response_preview: string;
  created_at: string;
  request_id: string | null;
};

export type DashboardPayload = {
  currency: string;
  total_spent: string;
  total_income: string;
  net_balance: string;
  weekly_series: WeeklySeriesPoint[];
  category_breakdown: CategorySlice[];
  recent_activity: ActivityItem[];
};

export async function getDashboard(
  getToken: GetToken,
  period: string = "day"
): Promise<DashboardPayload> {
  const headers = await bearerAuth(getToken);
  const res = await fetch(`${base()}/analytics/dashboard?period=${period}`, { headers });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<DashboardPayload>;
}

export type ReminderRow = {
  id: string;
  task: string;
  reminder_time: string;
  status: string;
  snooze_count: number;
};

export async function getReminders(getToken: GetToken): Promise<ReminderRow[]> {
  const headers = await bearerAuth(getToken);
  const res = await fetch(`${base()}/reminders`, { headers });
  if (!res.ok) throw new Error(await res.text());
  const data = (await res.json()) as { items: ReminderRow[] };
  return data.items;
}

export async function getDueReminders(getToken: GetToken): Promise<ReminderRow[]> {
  const headers = await bearerAuth(getToken);
  const res = await fetch(`${base()}/reminders/due`, { headers });
  if (!res.ok) throw new Error(await res.text());
  const data = (await res.json()) as { items: ReminderRow[] };
  return data.items;
}

export type TransactionRow = {
  id: string;
  type: string;
  amount: string;
  category: string | null;
  note: string | null;
  source: string | null;
  event_time: string;
};

export async function getTransactions(
  getToken: GetToken,
): Promise<TransactionRow[]> {
  const headers = await bearerAuth(getToken);
  const res = await fetch(`${base()}/transactions`, { headers });
  if (!res.ok) throw new Error(await res.text());
  const data = (await res.json()) as { items: TransactionRow[] };
  return data.items;
}

export type MemoryRow = {
  id: string;
  content: string;
  tags: string[];
  created_at: string;
};

export async function getMemories(getToken: GetToken): Promise<MemoryRow[]> {
  const headers = await bearerAuth(getToken);
  const res = await fetch(`${base()}/memories`, { headers });
  if (!res.ok) throw new Error(await res.text());
  const data = (await res.json()) as { items: MemoryRow[] };
  return data.items;
}

export async function deleteReminder(getToken: GetToken, id: string): Promise<void> {
  const headers = await bearerAuth(getToken);
  const res = await fetch(`${base()}/reminders/${id}`, { method: "DELETE", headers });
  if (!res.ok) throw new Error(await res.text());
}

export async function markReminderDone(getToken: GetToken, id: string): Promise<void> {
  const headers = await bearerAuth(getToken);
  const res = await fetch(`${base()}/reminders/${id}/done`, { method: "PATCH", headers });
  if (!res.ok) throw new Error(await res.text());
}

export async function snoozeReminder(getToken: GetToken, id: string): Promise<void> {
  const headers = await bearerAuth(getToken);
  const res = await fetch(`${base()}/reminders/${id}/snooze`, { method: "PATCH", headers });
  if (!res.ok) throw new Error(await res.text());
}

export async function deleteTransaction(getToken: GetToken, id: string): Promise<void> {
  const headers = await bearerAuth(getToken);
  const res = await fetch(`${base()}/transactions/${id}`, { method: "DELETE", headers });
  if (!res.ok) throw new Error(await res.text());
}

export async function updateTransactionDate(getToken: GetToken, id: string, event_time: string): Promise<void> {
  const headers = await jsonAuth(getToken);
  const res = await fetch(`${base()}/transactions/${id}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ event_time })
  });
  if (!res.ok) throw new Error(await res.text());
}

export async function deleteMemory(getToken: GetToken, id: string): Promise<void> {
  const headers = await bearerAuth(getToken);
  const res = await fetch(`${base()}/memories/${id}`, { method: "DELETE", headers });
  if (!res.ok) throw new Error(await res.text());
}

// ── Profile ──────────────────────────────────────────────────────────

export type UserProfile = {
  id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  image_url: string | null;
  age: number | null;
  gender: string | null;
  address: string | null;
  hobbies: string | null;
  profile_complete: boolean;
};

export async function getProfile(getToken: GetToken): Promise<UserProfile> {
  const headers = await bearerAuth(getToken);
  const res = await fetch(`${base()}/user/profile`, { headers });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<UserProfile>;
}

export type ProfileUpdateParams = {
  first_name?: string;
  last_name?: string;
  age?: number;
  gender?: string;
  address?: string;
  hobbies?: string;
};

export async function updateProfile(
  getToken: GetToken,
  params: ProfileUpdateParams,
): Promise<UserProfile> {
  const headers = await jsonAuth(getToken);
  const res = await fetch(`${base()}/user/profile`, {
    method: "PUT",
    headers,
    body: JSON.stringify(params),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<UserProfile>;
}

// ── Subscription & Plans ─────────────────────────────────────────────

export type PlanInfo = {
  name: string;
  display_name: string;
  price_inr_monthly: number;
  price_inr_yearly: number;
  daily_requests: number;
  memory_writes_per_day: number;
  memory_storage_limit: number;
  reminders_per_day: number;
  voice_input: boolean;
  premium_tts: boolean;
  long_term_reminder: boolean;
};

export type UsageSnapshot = {
  requests_today: number;
  memory_writes_today: number;
  reminders_today: number;
  monthly_cost_inr: number;
};

export type SubscriptionStatus = {
  plan: PlanInfo;
  usage: UsageSnapshot;
  plan_start_date: string | null;
  plan_end_date: string | null;
  is_active: boolean;
  cashfree_subscription_id: string | null;
};

export async function getPlans(): Promise<PlanInfo[]> {
  const res = await fetch(`${base()}/subscription/plans`);
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<PlanInfo[]>;
}

export async function getSubscriptionStatus(
  getToken: GetToken,
): Promise<SubscriptionStatus> {
  const headers = await bearerAuth(getToken);
  const res = await fetch(`${base()}/subscription/status`, { headers });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<SubscriptionStatus>;
}

export type CreateSubscriptionParams = {
  plan_id: string;
  billing_cycle: "monthly" | "yearly";
  return_url: string;
  promo_code?: string;
};

export type ValidatePromoParams = {
  promo_code: string;
  plan_id?: string;
  billing_cycle?: "monthly" | "yearly";
};

export type ValidatePromoResponse = {
  valid: boolean;
  discount_percent: number;
  final_amount_inr: number;
  message: string;
  applicable_plans?: string[];
};

export async function validatePromoCode(
  getToken: GetToken,
  params: ValidatePromoParams,
): Promise<ValidatePromoResponse> {
  const headers = await jsonAuth(getToken);
  const res = await fetch(`${base()}/payments/validate-promo`, {
    method: "POST",
    headers,
    body: JSON.stringify(params),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<ValidatePromoResponse>;
}

export type CreateSubscriptionResponse = {
  subscription_id: string;
  authorization_link: string;
  payment_session_id: string;
  cashfree_env: "sandbox" | "production";
};

export async function createSubscription(
  getToken: GetToken,
  params: CreateSubscriptionParams,
): Promise<CreateSubscriptionResponse> {
  const headers = await jsonAuth(getToken);
  const res = await fetch(`${base()}/payments/create-subscription`, {
    method: "POST",
    headers,
    body: JSON.stringify(params),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<CreateSubscriptionResponse>;
}

export type VerifyOrderResponse = {
  status: string;
  plan_activated: boolean;
  plan_name: string | null;
  message: string;
};

export async function verifyOrder(
  getToken: GetToken,
  orderId: string,
): Promise<VerifyOrderResponse> {
  const headers = await jsonAuth(getToken);
  const res = await fetch(`${base()}/payments/verify-order`, {
    method: "POST",
    headers,
    body: JSON.stringify({ order_id: orderId }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<VerifyOrderResponse>;
}
