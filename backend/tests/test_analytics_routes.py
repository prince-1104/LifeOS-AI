"""Smoke tests for analytics routes."""

from datetime import date
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from httpx import ASGITransport, AsyncClient

from auth.deps import get_authenticated_user_id
from db.postgres import get_db
from main import app


async def _fake_db():
    yield MagicMock()


@pytest.mark.asyncio
async def test_dashboard_returns_shape():
    mock_total = AsyncMock(return_value=Decimal("12.50"))
    mock_daily = AsyncMock(
        return_value=[(date(2026, 4, 6), Decimal("0"))]
    )
    mock_cats = AsyncMock(return_value=[("food", Decimal("50"))])
    mock_logs = AsyncMock(return_value=[])

    async def _fake_user():
        return "u1"

    app.dependency_overrides[get_db] = _fake_db
    app.dependency_overrides[get_authenticated_user_id] = _fake_user
    try:
        with patch("routes.analytics.DBService") as mock_svc_cls:
            instance = mock_svc_cls.return_value
            instance.get_total_spent_today = mock_total
            instance.get_daily_expense_totals_last_7_days = mock_daily
            instance.get_spending_by_category = mock_cats
            instance.get_recent_query_logs = mock_logs

            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                r = await client.get("/analytics/dashboard")
        assert r.status_code == 200
        data = r.json()
        assert data["currency"] == "INR"
        assert "total_spent_today" in data
        assert isinstance(data["weekly_series"], list)
        assert isinstance(data["category_breakdown"], list)
        assert isinstance(data["recent_activity"], list)
    finally:
        app.dependency_overrides.clear()
