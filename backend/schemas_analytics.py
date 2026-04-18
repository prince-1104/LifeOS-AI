"""Pydantic models for analytics and list endpoints."""

from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, Field


class WeeklySeriesPoint(BaseModel):
    date: str
    amount: str


class CategorySlice(BaseModel):
    category: str
    amount: str


class ActivityItem(BaseModel):
    result_type: str
    query: str
    response_preview: str
    created_at: datetime
    request_id: str | None = None


class DashboardResponse(BaseModel):
    currency: str = "INR"
    total_spent: str
    total_income: str
    net_balance: str
    weekly_series: list[WeeklySeriesPoint]
    category_breakdown: list[CategorySlice]
    recent_activity: list[ActivityItem]


class ReminderRow(BaseModel):
    id: UUID
    task: str
    reminder_time: datetime
    status: str
    snooze_count: int = 0


class RemindersListResponse(BaseModel):
    items: list[ReminderRow]


class TransactionRow(BaseModel):
    id: UUID
    type: str
    amount: str
    category: str | None
    note: str | None
    source: str | None
    event_time: datetime


class TransactionsListResponse(BaseModel):
    items: list[TransactionRow]


class MemoryRow(BaseModel):
    id: UUID
    content: str
    tags: list[str] = Field(default_factory=list)
    created_at: datetime


class MemoriesListResponse(BaseModel):
    items: list[MemoryRow]


def decimal_str(d: Decimal) -> str:
    return format(d, "f")


def truncate(s: str, max_len: int = 200) -> str:
    s = s.strip()
    if len(s) <= max_len:
        return s
    return s[: max_len - 1] + "…"
