/**
 * Admin API client — uses admin bearer token (not Clerk).
 * Token is stored in localStorage after password login.
 */

const base = () => {
  if (typeof window !== "undefined") {
    // Rely on Next.js rewrite to avoid ISP DNS blocks.
    return "/api";
  }
  return process.env.NEXT_PUBLIC_API_BASE_URL || "/api";
};

export type GetToken = () => Promise<string | null>;

async function adminHeaders(getToken: GetToken): Promise<HeadersInit> {
  const token = await getToken();
  if (!token) throw new Error("No admin session");
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

// ── Analytics ─────────────────────────────────────────────────────────

export type UsageSummary = {
  total_users: number;
  total_tokens: number;
  total_cost: number;
};

export type AdminUser = {
  user_id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  image_url: string | null;
  plan: string | null;
  created_at: string | null;
  total_tokens: number;
  total_requests: number;
  cost: number;
};

export type UserUsage = {
  user_id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  total_tokens: number;
  total_requests: number;
  cost: number;
};

export type DailyUsage = {
  date: string;
  total_tokens: number;
  total_requests: number;
  cost: number;
};

export type UserUsageCategory = {
  category: string;
  total_tokens: number;
  total_requests: number;
  cost: number;
};

export type UserDetailedUsageResponse = {
  user_id: string;
  daily_usage: DailyUsage[];
  category_usage: UserUsageCategory[];
};

export type WeeklyUsage = {
  week_start: string;
  total_tokens: number;
  total_requests: number;
  cost: number;
};

export type MonthlyUsage = {
  month: string;
  total_tokens: number;
  total_requests: number;
  cost: number;
};

export type TopUser = {
  user_id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  plan: string | null;
  total_tokens: number;
  total_requests: number;
  cost: number;
};

export async function getUsageSummary(getToken: GetToken): Promise<UsageSummary> {
  const headers = await adminHeaders(getToken);
  const res = await fetch(`${base()}/admin/usage/summary`, { headers });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getUserUsage(getToken: GetToken): Promise<UserUsage[]> {
  const headers = await adminHeaders(getToken);
  const res = await fetch(`${base()}/admin/usage/users`, { headers });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getAllUsers(getToken: GetToken): Promise<AdminUser[]> {
  const headers = await adminHeaders(getToken);
  const res = await fetch(`${base()}/admin/users/all`, { headers });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getDailyUsage(getToken: GetToken, days = 30): Promise<DailyUsage[]> {
  const headers = await adminHeaders(getToken);
  const res = await fetch(`${base()}/admin/usage/daily?days=${days}`, {
    headers,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getWeeklyUsage(getToken: GetToken, weeks = 12): Promise<WeeklyUsage[]> {
  const headers = await adminHeaders(getToken);
  const res = await fetch(`${base()}/admin/usage/weekly?weeks=${weeks}`, {
    headers,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getMonthlyUsage(getToken: GetToken, months = 12): Promise<MonthlyUsage[]> {
  const headers = await adminHeaders(getToken);
  const res = await fetch(`${base()}/admin/usage/monthly?months=${months}`, {
    headers,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getTopUsers(getToken: GetToken, limit = 10): Promise<TopUser[]> {
  const headers = await adminHeaders(getToken);
  const res = await fetch(`${base()}/admin/top-users?limit=${limit}`, {
    headers,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getUserDetailedUsage(
  getToken: GetToken,
  userId: string,
  days = 30
): Promise<UserDetailedUsageResponse> {
  const headers = await adminHeaders(getToken);
  const res = await fetch(`${base()}/admin/users/${userId}/usage-details?days=${days}`, {
    headers,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// ── Promo Codes ───────────────────────────────────────────────────────

export type PromoCode = {
  id: string;
  code: string;
  discount_percent: number;
  max_uses: number | null;
  times_used: number;
  min_amount: number | null;
  applicable_plans: string | null;
  is_active: number;
  expires_at: string | null;
  created_at: string;
};

export type CreatePromoCodeParams = {
  code: string;
  discount_percent: number;
  max_uses?: number | null;
  min_amount?: number | null;
  applicable_plans?: string | null;
  expires_at?: string | null;
};

export async function getPromoCodes(getToken: GetToken): Promise<PromoCode[]> {
  const headers = await adminHeaders(getToken);
  const res = await fetch(`${base()}/admin/promos`, { headers });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function createPromoCode(getToken: GetToken, params: CreatePromoCodeParams): Promise<PromoCode> {
  const headers = await adminHeaders(getToken);
  const res = await fetch(`${base()}/admin/promos`, {
    method: "POST",
    headers,
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.detail || `Request failed (${res.status})`);
  }
  return res.json();
}
export async function deletePromoCode(getToken: GetToken, promoId: string): Promise<{status: string, message: string}> {
  const headers = await adminHeaders(getToken);
  const res = await fetch(`${base()}/admin/promos/${promoId}`, {
    method: "DELETE",
    headers,
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.detail || `Request failed (${res.status})`);
  }
  return res.json();
}

export async function togglePromoStatus(getToken: GetToken, promoId: string): Promise<{status: string, is_active: number}> {
  const headers = await adminHeaders(getToken);
  const res = await fetch(`${base()}/admin/promos/${promoId}/toggle-status`, {
    method: "PUT",
    headers,
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.detail || `Request failed (${res.status})`);
  }
  return res.json();
}
