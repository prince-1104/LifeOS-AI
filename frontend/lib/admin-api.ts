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

const ADMIN_TOKEN_KEY = "admin_session_token";

export function getAdminToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(ADMIN_TOKEN_KEY);
}

export function setAdminToken(token: string): void {
  localStorage.setItem(ADMIN_TOKEN_KEY, token);
}

export function clearAdminToken(): void {
  localStorage.removeItem(ADMIN_TOKEN_KEY);
}

async function adminHeaders(): Promise<HeadersInit> {
  const token = getAdminToken();
  if (!token) throw new Error("No admin session");
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

// ── Auth ──────────────────────────────────────────────────────────────

export async function adminLogin(
  email: string,
  password: string,
): Promise<{ token: string; expires_in_hours: number }> {
  const res = await fetch(`${base()}/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.detail || `Login failed (${res.status})`);
  }
  return res.json();
}

export async function forgotPassword(
  email: string,
): Promise<{ message: string }> {
  const res = await fetch(`${base()}/admin/forgot-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.detail || `Request failed (${res.status})`);
  }
  return res.json();
}

export async function resetPassword(
  email: string,
  code: string,
  new_password: string,
): Promise<{ message: string }> {
  const res = await fetch(`${base()}/admin/reset-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, code, new_password }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.detail || `Reset failed (${res.status})`);
  }
  return res.json();
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
  total_tokens: number;
  total_requests: number;
  cost: number;
};

export async function getUsageSummary(): Promise<UsageSummary> {
  const headers = await adminHeaders();
  const res = await fetch(`${base()}/admin/usage/summary`, { headers });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getUserUsage(): Promise<UserUsage[]> {
  const headers = await adminHeaders();
  const res = await fetch(`${base()}/admin/usage/users`, { headers });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getAllUsers(): Promise<AdminUser[]> {
  const headers = await adminHeaders();
  const res = await fetch(`${base()}/admin/users/all`, { headers });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getDailyUsage(days = 30): Promise<DailyUsage[]> {
  const headers = await adminHeaders();
  const res = await fetch(`${base()}/admin/usage/daily?days=${days}`, {
    headers,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getWeeklyUsage(weeks = 12): Promise<WeeklyUsage[]> {
  const headers = await adminHeaders();
  const res = await fetch(`${base()}/admin/usage/weekly?weeks=${weeks}`, {
    headers,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getMonthlyUsage(months = 12): Promise<MonthlyUsage[]> {
  const headers = await adminHeaders();
  const res = await fetch(`${base()}/admin/usage/monthly?months=${months}`, {
    headers,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getTopUsers(limit = 10): Promise<TopUser[]> {
  const headers = await adminHeaders();
  const res = await fetch(`${base()}/admin/top-users?limit=${limit}`, {
    headers,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
