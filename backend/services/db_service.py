"""Async Postgres helpers for transactions (SQLAlchemy 2 + AsyncSession)."""

from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from db.models import Memory, QueryLog, Reminder, Transaction


class DBService:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def insert_transaction(
        self,
        user_id: str,
        data: dict,
    ) -> UUID:
        """
        data keys: type ('income'|'expense'), amount, category, note, source, event_time optional.
        """
        now = data.get("event_time")
        if now is None:
            now = datetime.now(timezone.utc)

        row = Transaction(
            user_id=user_id,
            type=data["type"],
            amount=data["amount"],
            category=data.get("category"),
            note=data.get("note"),
            source=data.get("source"),
            event_time=now,
        )
        self.session.add(row)
        await self.session.commit()
        await self.session.refresh(row)
        return row.id

    def _get_period_filter(self, period: str):
        now = datetime.now(timezone.utc)
        if period == "day":
            return func.date(Transaction.event_time) == func.current_date()
        elif period == "week":
            return Transaction.event_time >= now - timedelta(days=7)
        elif period == "month":
            return Transaction.event_time >= now - timedelta(days=30)
        elif period == "year":
            return Transaction.event_time >= now - timedelta(days=365)
        return True

    async def get_total_spent(self, user_id: str, period: str = "day") -> Decimal:
        stmt = select(func.coalesce(func.sum(Transaction.amount), 0)).where(
            Transaction.user_id == user_id,
            Transaction.type == "expense",
            self._get_period_filter(period),
        )
        result = await self.session.execute(stmt)
        total = result.scalar_one()
        return Decimal(str(total)) if total is not None else Decimal("0")

    async def get_total_income(self, user_id: str, period: str = "day") -> Decimal:
        stmt = select(func.coalesce(func.sum(Transaction.amount), 0)).where(
            Transaction.user_id == user_id,
            Transaction.type == "income",
            self._get_period_filter(period),
        )
        result = await self.session.execute(stmt)
        total = result.scalar_one()
        return Decimal(str(total)) if total is not None else Decimal("0")

    async def get_net_balance(self, user_id: str, period: str = "day") -> Decimal:
        stmt_in = select(func.coalesce(func.sum(Transaction.amount), 0)).where(
            Transaction.user_id == user_id,
            Transaction.type == "income",
            self._get_period_filter(period),
        )
        stmt_out = select(func.coalesce(func.sum(Transaction.amount), 0)).where(
            Transaction.user_id == user_id,
            Transaction.type == "expense",
            self._get_period_filter(period),
        )
        t_in = (await self.session.execute(stmt_in)).scalar_one()
        t_out = (await self.session.execute(stmt_out)).scalar_one()
        in_dec = Decimal(str(t_in)) if t_in is not None else Decimal("0")
        out_dec = Decimal(str(t_out)) if t_out is not None else Decimal("0")
        return in_dec - out_dec

    async def get_total_spent_last_7_days(self, user_id: str) -> Decimal:
        cutoff = datetime.now(timezone.utc) - timedelta(days=7)
        stmt = select(func.coalesce(func.sum(Transaction.amount), 0)).where(
            Transaction.user_id == user_id,
            Transaction.type == "expense",
            Transaction.event_time >= cutoff,
        )
        result = await self.session.execute(stmt)
        total = result.scalar_one()
        return Decimal(str(total)) if total is not None else Decimal("0")

    async def get_spending_by_category(
        self, user_id: str, limit: int = 10, period: str = "day"
    ) -> list[tuple[str, Decimal]]:
        """Sum expenses by category; NULL category becomes 'uncategorized'."""
        cat = func.coalesce(Transaction.category, "uncategorized")
        stmt = (
            select(cat, func.sum(Transaction.amount))
            .where(
                Transaction.user_id == user_id,
                Transaction.type == "expense",
                self._get_period_filter(period),
            )
            .group_by(cat)
            .order_by(func.sum(Transaction.amount).desc())
            .limit(limit)
        )
        result = await self.session.execute(stmt)
        rows = result.all()
        out: list[tuple[str, Decimal]] = []
        for c, s in rows:
            amt = s if s is not None else Decimal("0")
            out.append((str(c), Decimal(str(amt))))
        return out

    async def get_daily_expense_totals_last_7_days(
        self, user_id: str
    ) -> list[tuple[date, Decimal]]:
        """Sum expenses per calendar day for the last 7 days (inclusive), UTC date anchor."""
        end = datetime.now(timezone.utc).date()
        start = end - timedelta(days=6)
        day_col = func.date(Transaction.event_time)
        stmt = (
            select(day_col, func.coalesce(func.sum(Transaction.amount), 0))
            .where(
                Transaction.user_id == user_id,
                Transaction.type == "expense",
                day_col >= start,
                day_col <= end,
            )
            .group_by(day_col)
            .order_by(day_col)
        )
        result = await self.session.execute(stmt)
        rows = result.all()
        by_day: dict[date, Decimal] = {}
        for d, total in rows:
            if d is None:
                continue
            day = d if isinstance(d, date) else d
            by_day[day] = Decimal(str(total)) if total is not None else Decimal("0")

        out: list[tuple[date, Decimal]] = []
        cur = start
        while cur <= end:
            out.append((cur, by_day.get(cur, Decimal("0"))))
            cur += timedelta(days=1)
        return out

    async def get_recent_query_logs(
        self, user_id: str, limit: int = 15
    ) -> list[QueryLog]:
        stmt = (
            select(QueryLog)
            .where(QueryLog.user_id == user_id)
            .order_by(QueryLog.created_at.desc())
            .limit(limit)
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def list_reminders(
        self, user_id: str, limit: int = 100
    ) -> list[Reminder]:
        """Return ALL reminders (pending first, then done) so nothing vanishes."""
        from sqlalchemy import case
        sort_status = case(
            (Reminder.status == "pending", 0),
            else_=1,
        )
        stmt = (
            select(Reminder)
            .where(Reminder.user_id == user_id)
            .order_by(sort_status, Reminder.reminder_time.asc())
            .limit(limit)
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def list_due_reminders(
        self, user_id: str
    ) -> list[Reminder]:
        """Reminders that are past due but still pending (for in-app notification)."""
        now = datetime.now(timezone.utc)
        stmt = (
            select(Reminder)
            .where(
                Reminder.user_id == user_id,
                Reminder.status == "pending",
                Reminder.reminder_time <= now,
            )
            .order_by(Reminder.reminder_time.asc())
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def list_recent_transactions(
        self, user_id: str, limit: int = 50
    ) -> list[Transaction]:
        stmt = (
            select(Transaction)
            .where(Transaction.user_id == user_id)
            .order_by(Transaction.event_time.desc())
            .limit(limit)
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def list_recent_memories(
        self, user_id: str, limit: int = 30
    ) -> list[Memory]:
        stmt = (
            select(Memory)
            .where(Memory.user_id == user_id)
            .order_by(Memory.created_at.desc())
            .limit(limit)
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def update_transaction_date(self, id: UUID, user_id: str, new_date: datetime) -> bool:
        stmt = select(Transaction).where(Transaction.id == id, Transaction.user_id == user_id)
        result = await self.session.execute(stmt)
        row = result.scalar_one_or_none()
        if not row:
            return False
        row.event_time = new_date
        await self.session.commit()
        return True

    async def delete_transaction(self, id: UUID, user_id: str) -> bool:
        stmt = select(Transaction).where(Transaction.id == id)
        result = await self.session.execute(stmt)
        row = result.scalar_one_or_none()
        if not row or row.user_id != user_id:
            return False
        await self.session.delete(row)
        await self.session.commit()
        return True

    async def mark_reminder_done(self, id: UUID, user_id: str) -> bool:
        stmt = select(Reminder).where(Reminder.id == id)
        result = await self.session.execute(stmt)
        row = result.scalar_one_or_none()
        if not row or row.user_id != user_id:
            return False
        row.status = "done"
        await self.session.commit()
        return True

    async def delete_reminder(self, id: UUID, user_id: str) -> bool:
        stmt = select(Reminder).where(Reminder.id == id)
        result = await self.session.execute(stmt)
        row = result.scalar_one_or_none()
        if not row or row.user_id != user_id:
            return False
        await self.session.delete(row)
        await self.session.commit()
        return True

    async def delete_memory(self, id: UUID, user_id: str) -> bool:
        stmt = select(Memory).where(Memory.id == id)
        result = await self.session.execute(stmt)
        row = result.scalar_one_or_none()
        if not row or row.user_id != user_id:
            return False
        await self.session.delete(row)
        await self.session.commit()
        return True
