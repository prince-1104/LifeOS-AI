"""Read-only analytics and entity list routes for the Cortexa AI dashboard."""

import asyncio
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from auth.deps import get_authenticated_user_id
from db.postgres import get_db, async_session
from schemas_analytics import (
    ActivityItem,
    CategorySlice,
    DashboardResponse,
    MemoryRow,
    MemoriesListResponse,
    ReminderRow,
    RemindersListResponse,
    TransactionRow,
    TransactionsListResponse,
    WeeklySeriesPoint,
    decimal_str,
    truncate,
)
from services.db_service import DBService

router = APIRouter(tags=["analytics"])


async def _query_total(user_id: str, period: str):
    async with async_session() as s:
        svc = DBService(s)
        return await svc.get_total_spent(user_id, period)


async def _query_income(user_id: str, period: str):
    async with async_session() as s:
        svc = DBService(s)
        return await svc.get_total_income(user_id, period)


async def _query_net_balance(user_id: str, period: str):
    async with async_session() as s:
        svc = DBService(s)
        return await svc.get_net_balance(user_id, period)


async def _query_daily(user_id: str):
    async with async_session() as s:
        svc = DBService(s)
        return await svc.get_daily_expense_totals_last_7_days(user_id)


async def _query_cats(user_id: str, period: str):
    async with async_session() as s:
        svc = DBService(s)
        return await svc.get_spending_by_category(user_id, limit=8, period=period)


async def _query_logs(user_id: str):
    async with async_session() as s:
        svc = DBService(s)
        return await svc.get_recent_query_logs(user_id, limit=15)


@router.get("/analytics/dashboard", response_model=DashboardResponse)
async def analytics_dashboard(
    period: str = "day",
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_authenticated_user_id),
) -> DashboardResponse:
    cat_period = "month" if period == "day" else period
    total, income, balance, daily, cats, logs = await asyncio.gather(
        _query_total(user_id, period),
        _query_income(user_id, period),
        _query_net_balance(user_id, period),
        _query_daily(user_id),
        _query_cats(user_id, cat_period),
        _query_logs(user_id),
    )

    weekly_series = [
        WeeklySeriesPoint(date=d.isoformat(), amount=decimal_str(amt))
        for d, amt in daily
    ]
    category_breakdown = [
        CategorySlice(category=c, amount=decimal_str(amt)) for c, amt in cats
    ]
    recent_activity = [
        ActivityItem(
            result_type=row.result_type,
            query=row.query,
            response_preview=truncate(row.response),
            created_at=row.created_at,
            request_id=row.request_id,
        )
        for row in logs
    ]

    return DashboardResponse(
        total_spent=decimal_str(total),
        total_income=decimal_str(income),
        net_balance=decimal_str(balance),
        weekly_series=weekly_series,
        category_breakdown=category_breakdown,
        recent_activity=recent_activity,
    )


@router.get("/reminders", response_model=RemindersListResponse)
async def list_reminders(
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_authenticated_user_id),
) -> RemindersListResponse:
    svc = DBService(db)
    rows = await svc.list_reminders(user_id)
    items = [
        ReminderRow(
            id=UUID(str(r.id)),
            task=r.task,
            reminder_time=r.reminder_time,
            status=r.status,
        )
        for r in rows
    ]
    return RemindersListResponse(items=items)


@router.get("/reminders/due", response_model=RemindersListResponse)
async def due_reminders(
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_authenticated_user_id),
) -> RemindersListResponse:
    """Reminders that are past due but still pending — used for in-app toasts."""
    svc = DBService(db)
    rows = await svc.list_due_reminders(user_id)
    items = [
        ReminderRow(
            id=UUID(str(r.id)),
            task=r.task,
            reminder_time=r.reminder_time,
            status=r.status,
        )
        for r in rows
    ]
    return RemindersListResponse(items=items)


@router.get("/transactions", response_model=TransactionsListResponse)
async def list_transactions(
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_authenticated_user_id),
) -> TransactionsListResponse:
    svc = DBService(db)
    rows = await svc.list_recent_transactions(user_id)
    items = [
        TransactionRow(
            id=UUID(str(r.id)),
            type=r.type,
            amount=decimal_str(r.amount),
            category=r.category,
            note=r.note,
            source=r.source,
            event_time=r.event_time,
        )
        for r in rows
    ]
    return TransactionsListResponse(items=items)


import time

@router.get("/memories", response_model=MemoriesListResponse)
async def list_memories(
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_authenticated_user_id),
) -> MemoriesListResponse:
    t0 = time.perf_counter()
    svc = DBService(db)
    rows = await svc.list_recent_memories(user_id)
    t1 = time.perf_counter()
    with open("timing.log", "a") as f:
        f.write(f"DB query /memories took: {(t1 - t0):.4f}s\n")
    items = [
        MemoryRow(
            id=UUID(str(r.id)),
            content=r.content,
            tags=list(r.tags or []),
            created_at=r.created_at,
        )
        for r in rows
    ]
    return MemoriesListResponse(items=items)

from fastapi import HTTPException

@router.delete("/transactions/{item_id}")
async def delete_transaction(
    item_id: UUID,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_authenticated_user_id),
):
    svc = DBService(db)
    success = await svc.delete_transaction(item_id, user_id)
    if not success:
        raise HTTPException(status_code=404, detail="Transaction not found")
    return {"success": True}

from pydantic import BaseModel
from datetime import datetime

class TransactionUpdateDateRequest(BaseModel):
    event_time: datetime

@router.patch("/transactions/{item_id}")
async def update_transaction_date(
    item_id: UUID,
    req: TransactionUpdateDateRequest,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_authenticated_user_id),
):
    svc = DBService(db)
    success = await svc.update_transaction_date(item_id, user_id, req.event_time)
    if not success:
        raise HTTPException(status_code=404, detail="Transaction not found")
    return {"success": True}

@router.delete("/reminders/{item_id}")
async def delete_reminder(
    item_id: UUID,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_authenticated_user_id),
):
    svc = DBService(db)
    success = await svc.delete_reminder(item_id, user_id)
    if not success:
        raise HTTPException(status_code=404, detail="Reminder not found")
    return {"success": True}

@router.delete("/memories/{item_id}")
async def delete_memory(
    item_id: UUID,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_authenticated_user_id),
):
    svc = DBService(db)
    success = await svc.delete_memory(item_id, user_id)
    if not success:
        raise HTTPException(status_code=404, detail="Memory not found")
    return {"success": True}
