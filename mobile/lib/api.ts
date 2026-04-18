/**
 * Cortexa — API client for the mobile app.
 * Mirrors the web frontend's lib/api.ts, talking to the same FastAPI backend.
 */

// In dev, use your machine's LAN IP so the phone/emulator can reach the server.
// In production, swap this for your deployed URL.
const API_BASE = "https://lifeos-ai-production-ceea.up.railway.app"; 

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

export async function getReminders(
  getToken: GetToken
): Promise<ReminderRow[]> {
  const headers = await bearerAuth(getToken);
  const res = await fetch(`${getApiBase()}/reminders`, { headers });
  if (!res.ok) throw new Error(await res.text());
  const data = (await res.json()) as { items: ReminderRow[] };
  return data.items;
}

export async function getTransactions(
  getToken: GetToken
): Promise<TransactionRow[]> {
  const headers = await bearerAuth(getToken);
  const res = await fetch(`${getApiBase()}/transactions`, { headers });
  if (!res.ok) throw new Error(await res.text());
  const data = (await res.json()) as { items: TransactionRow[] };
  return data.items;
}

export async function getMemories(
  getToken: GetToken
): Promise<MemoryRow[]> {
  const headers = await bearerAuth(getToken);
  const res = await fetch(`${getApiBase()}/memories`, { headers });
  if (!res.ok) throw new Error(await res.text());
  const data = (await res.json()) as { items: MemoryRow[] };
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
