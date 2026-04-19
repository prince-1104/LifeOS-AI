/**
 * Cortexa — API client for the mobile app.
 * Mirrors the web frontend's lib/api.ts, talking to the same FastAPI backend.
 */

// In dev, use your machine's LAN IP so the phone/emulator can reach the server.
// In production, we proxy through the Next.js app to bypass ISP DNS blocks on Railway.
const API_BASE = "https://cortexa.doptonin.online/api"; 

export function getApiBase(): string {
  return API_BASE.replace(/\/$/, "");
}

// ── Auth helpers ────────────────────────────────────────────────────────
export type GetToken = () => Promise<string | null>;

async function bearerAuth(getToken: GetToken): Promise<Record<string, string>> {
  const token = await getToken();
  if (!token) throw new Error("Not signed in");
  return { Authorization: `Bearer ${token}` };
}

async function jsonAuth(getToken: GetToken): Promise<Record<string, string>> {
  const h = await bearerAuth(getToken);
  return { ...h, "Content-Type": "application/json" };
}

// ── Types ───────────────────────────────────────────────────────────────
export type ProcessType =
  | "memory"
  | "query"
  | "finance"
  | "reminder"
  | "unknown"
  | "error";

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
} | null;

export type ProcessResponse = {
  success: boolean;
  type: ProcessType | string;
  response: string;
  data: ProcessData;
  timestamp: string;
  request_id: string;
};

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

export type ReminderRow = {
  id: string;
  task: string;
  reminder_time: string;
  status: string;
  snooze_count: number;
};

export type TransactionRow = {
  id: string;
  type: string;
  amount: string;
  category: string | null;
  note: string | null;
  source: string | null;
  event_time: string;
};

export type MemoryRow = {
  id: string;
  content: string;
  tags: string[];
  created_at: string;
};

// ── Profile Types ───────────────────────────────────────────────────────

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

export type ProfileUpdateParams = {
  first_name?: string;
  last_name?: string;
  age?: number;
  gender?: string;
  address?: string;
  hobbies?: string;
};

// ── Subscription & Plans Types ──────────────────────────────────────────

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

export type CreateSubscriptionParams = {
  plan_id: string;
  billing_cycle: "monthly" | "yearly";
  return_url: string;
  promo_code?: string;
};

export type CreateSubscriptionResponse = {
  subscription_id: string;
  authorization_link: string;
  payment_session_id: string;
  cashfree_env: "sandbox" | "production";
};

// ── API calls ───────────────────────────────────────────────────────────

export async function processInput(
  getToken: GetToken,
  params: { input: string; userTimezone?: string }
): Promise<ProcessResponse> {
  const headers = await jsonAuth(getToken);
  const res = await fetch(`${getApiBase()}/process`, {
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

export async function getDashboard(
  getToken: GetToken,
  period: string = "day"
): Promise<DashboardPayload> {
  const headers = await bearerAuth(getToken);
  const res = await fetch(
    `${getApiBase()}/analytics/dashboard?period=${period}`,
    { headers }
  );
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<DashboardPayload>;
}

// ── Reminders ───────────────────────────────────────────────────────────

export async function getReminders(
  getToken: GetToken
): Promise<ReminderRow[]> {
  const headers = await bearerAuth(getToken);
  const res = await fetch(`${getApiBase()}/reminders`, { headers });
  if (!res.ok) throw new Error(await res.text());
  const data = (await res.json()) as { items: ReminderRow[] };
  return data.items;
}

export async function getDueReminders(
  getToken: GetToken
): Promise<ReminderRow[]> {
  const headers = await bearerAuth(getToken);
  const res = await fetch(`${getApiBase()}/reminders/due`, { headers });
  if (!res.ok) throw new Error(await res.text());
  const data = (await res.json()) as { items: ReminderRow[] };
  return data.items;
}

export async function deleteReminder(
  getToken: GetToken,
  id: string
): Promise<void> {
  const headers = await bearerAuth(getToken);
  const res = await fetch(`${getApiBase()}/reminders/${id}`, {
    method: "DELETE",
    headers,
  });
  if (!res.ok) throw new Error(await res.text());
}

export async function markReminderDone(
  getToken: GetToken,
  id: string
): Promise<void> {
  const headers = await bearerAuth(getToken);
  const res = await fetch(`${getApiBase()}/reminders/${id}/done`, {
    method: "PATCH",
    headers,
  });
  if (!res.ok) throw new Error(await res.text());
}

export async function snoozeReminder(
  getToken: GetToken,
  id: string
): Promise<void> {
  const headers = await bearerAuth(getToken);
  const res = await fetch(`${getApiBase()}/reminders/${id}/snooze`, {
    method: "PATCH",
    headers,
  });
  if (!res.ok) throw new Error(await res.text());
}

// ── Transactions ────────────────────────────────────────────────────────

export async function getTransactions(
  getToken: GetToken
): Promise<TransactionRow[]> {
  const headers = await bearerAuth(getToken);
  const res = await fetch(`${getApiBase()}/transactions`, { headers });
  if (!res.ok) throw new Error(await res.text());
  const data = (await res.json()) as { items: TransactionRow[] };
  return data.items;
}

export async function deleteTransaction(
  getToken: GetToken,
  id: string
): Promise<void> {
  const headers = await bearerAuth(getToken);
  const res = await fetch(`${getApiBase()}/transactions/${id}`, {
    method: "DELETE",
    headers,
  });
  if (!res.ok) throw new Error(await res.text());
}

export async function updateTransactionDate(
  getToken: GetToken,
  id: string,
  event_time: string
): Promise<void> {
  const headers = await jsonAuth(getToken);
  const res = await fetch(`${getApiBase()}/transactions/${id}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ event_time }),
  });
  if (!res.ok) throw new Error(await res.text());
}

// ── Memories ────────────────────────────────────────────────────────────

export async function getMemories(
  getToken: GetToken
): Promise<MemoryRow[]> {
  const headers = await bearerAuth(getToken);
  const res = await fetch(`${getApiBase()}/memories`, { headers });
  if (!res.ok) throw new Error(await res.text());
  const data = (await res.json()) as { items: MemoryRow[] };
  return data.items;
}

export async function deleteMemory(
  getToken: GetToken,
  id: string
): Promise<void> {
  const headers = await bearerAuth(getToken);
  const res = await fetch(`${getApiBase()}/memories/${id}`, {
    method: "DELETE",
    headers,
  });
  if (!res.ok) throw new Error(await res.text());
}

// ── Profile ─────────────────────────────────────────────────────────────

export async function getProfile(
  getToken: GetToken
): Promise<UserProfile> {
  const headers = await bearerAuth(getToken);
  const res = await fetch(`${getApiBase()}/user/profile`, { headers });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<UserProfile>;
}

export async function updateProfile(
  getToken: GetToken,
  params: ProfileUpdateParams
): Promise<UserProfile> {
  const headers = await jsonAuth(getToken);
  const res = await fetch(`${getApiBase()}/user/profile`, {
    method: "PUT",
    headers,
    body: JSON.stringify(params),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<UserProfile>;
}

// ── Subscription & Plans ────────────────────────────────────────────────

export async function getPlans(): Promise<PlanInfo[]> {
  const res = await fetch(`${getApiBase()}/subscription/plans`);
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<PlanInfo[]>;
}

export async function getSubscriptionStatus(
  getToken: GetToken
): Promise<SubscriptionStatus> {
  const headers = await bearerAuth(getToken);
  const res = await fetch(`${getApiBase()}/subscription/status`, { headers });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<SubscriptionStatus>;
}

export async function validatePromoCode(
  getToken: GetToken,
  params: ValidatePromoParams
): Promise<ValidatePromoResponse> {
  const headers = await jsonAuth(getToken);
  const res = await fetch(`${getApiBase()}/payments/validate-promo`, {
    method: "POST",
    headers,
    body: JSON.stringify(params),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<ValidatePromoResponse>;
}

export async function createSubscription(
  getToken: GetToken,
  params: CreateSubscriptionParams
): Promise<CreateSubscriptionResponse> {
  const headers = await jsonAuth(getToken);
  const res = await fetch(`${getApiBase()}/payments/create-subscription`, {
    method: "POST",
    headers,
    body: JSON.stringify(params),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<CreateSubscriptionResponse>;
}
