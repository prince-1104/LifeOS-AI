"""Async Postgres helpers for transactions (SQLAlchemy 2 + AsyncSession)."""

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
            from datetime import datetime, timezone

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
