"""Pydantic schemas for admin API endpoints."""

from datetime import datetime

from pydantic import BaseModel, Field


# ── Auth ──────────────────────────────────────────────────────────────


class AdminLoginRequest(BaseModel):
    email: str
    password: str


class AdminLoginResponse(BaseModel):
    token: str
    expires_in_hours: int = 24


class ForgotPasswordRequest(BaseModel):
    email: str


class ResetPasswordRequest(BaseModel):
    email: str
    code: str
    new_password: str


class MessageResponse(BaseModel):
    message: str


# ── Analytics ─────────────────────────────────────────────────────────


class AdminUserRow(BaseModel):
    user_id: str
    email: str | None = None
    first_name: str | None = None
    last_name: str | None = None
    image_url: str | None = None
    created_at: str | None = None
    total_tokens: int = 0
    total_requests: int = 0
    cost: float = 0.0


class UsageSummaryResponse(BaseModel):
    total_users: int
    total_tokens: int
    total_cost: float


class UserUsageRow(BaseModel):
    user_id: str
    email: str | None = None
    first_name: str | None = None
    last_name: str | None = None
    total_tokens: int
    total_requests: int
    cost: float


class DailyUsageRow(BaseModel):
    date: str
    total_tokens: int
    total_requests: int
    cost: float


class WeeklyUsageRow(BaseModel):
    week_start: str
    total_tokens: int
    total_requests: int
    cost: float


class MonthlyUsageRow(BaseModel):
    month: str
    total_tokens: int
    total_requests: int
    cost: float


class TopUserRow(BaseModel):
    user_id: str
    email: str | None = None
    first_name: str | None = None
    last_name: str | None = None
    total_tokens: int
    total_requests: int
    cost: float


# ── Revenue & Profitability ───────────────────────────────────────────


class RevenueSummaryResponse(BaseModel):
    total_users: int
    paying_users: int
    total_revenue_inr: float
    total_cost_inr: float
    net_profit_inr: float


class UserRevenueRow(BaseModel):
    user_id: str
    email: str | None = None
    first_name: str | None = None
    last_name: str | None = None
    plan: str
    plan_display_name: str
    plan_price_inr: int
    total_cost_inr: float
    profit_loss_inr: float
    is_over_budget: bool

