"""Async Postgres helpers for transactions (SQLAlchemy 2 + AsyncSession)."""

from datetime import datetime, timedelta, timezone
from decimal import Decimal
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from db.models import Transaction


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

    async def get_total_spent_today(self, user_id: str) -> Decimal:
        stmt = select(func.coalesce(func.sum(Transaction.amount), 0)).where(
            Transaction.user_id == user_id,
            Transaction.type == "expense",
            func.date(Transaction.event_time) == func.current_date(),
        )
        result = await self.session.execute(stmt)
        total = result.scalar_one()
        return Decimal(str(total)) if total is not None else Decimal("0")

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
        self, user_id: str, limit: int = 10
    ) -> list[tuple[str, Decimal]]:
        """Sum expenses by category; NULL category becomes 'uncategorized'."""
        cat = func.coalesce(Transaction.category, "uncategorized")
        stmt = (
            select(cat, func.sum(Transaction.amount))
            .where(
                Transaction.user_id == user_id,
                Transaction.type == "expense",
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
