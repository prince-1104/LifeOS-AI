"""Query agent finance shortcut (mocked DB)."""

from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from agents import query_agent


@pytest.mark.asyncio
@patch("agents.query_agent.DBService")
async def test_spend_today_branch(mock_svc_cls):
    mock_svc = MagicMock()
    mock_svc.get_total_spent_today = AsyncMock(return_value=320)
    mock_svc_cls.return_value = mock_svc

    db = MagicMock()
    out = await query_agent.process(
        "How much did I spend today?",
        user_id="u1",
        db=db,
    )
    assert "320" in out
    assert "today" in out.lower()
    mock_svc.get_total_spent_today.assert_awaited_once_with("u1")


@pytest.mark.asyncio
@patch("agents.query_agent.DBService")
async def test_spend_last_7_days_branch(mock_svc_cls):
    mock_svc = MagicMock()
    mock_svc.get_total_spent_last_7_days = AsyncMock(return_value=Decimal("1500.50"))
    mock_svc_cls.return_value = mock_svc

    db = MagicMock()
    out = await query_agent.process(
        "How much did I spend this week?",
        user_id="u1",
        db=db,
    )
    assert "1500.50" in out or "1500.5" in out
    assert "7" in out
    mock_svc.get_total_spent_last_7_days.assert_awaited_once_with("u1")
    mock_svc.get_total_spent_today.assert_not_called()


@pytest.mark.asyncio
@patch("agents.query_agent.DBService")
async def test_week_spend_appends_high_spend_note(mock_svc_cls):
    mock_svc = MagicMock()
    mock_svc.get_total_spent_last_7_days = AsyncMock(return_value=Decimal("6000"))
    mock_svc_cls.return_value = mock_svc

    db = MagicMock()
    out = await query_agent.process(
        "How much did I spend in the last week?",
        user_id="u1",
        db=db,
    )
    assert "6000" in out
    assert "quite high" in out.lower()


@pytest.mark.asyncio
@patch("agents.query_agent.DBService")
async def test_top_categories_branch(mock_svc_cls):
    mock_svc = MagicMock()
    mock_svc.get_spending_by_category = AsyncMock(
        return_value=[
            ("food", Decimal("400")),
            ("transport", Decimal("200")),
            ("misc", Decimal("100")),
        ]
    )
    mock_svc_cls.return_value = mock_svc

    db = MagicMock()
    out = await query_agent.process(
        "Where am I spending the most?",
        user_id="u1",
        db=db,
    )
    assert "food" in out
    assert "400" in out
    assert "transport" in out
    mock_svc.get_spending_by_category.assert_awaited_once()
    call_kw = mock_svc.get_spending_by_category.await_args
    assert call_kw[0][0] == "u1"


@pytest.mark.asyncio
@patch("agents.query_agent.DBService")
async def test_top_categories_empty(mock_svc_cls):
    mock_svc = MagicMock()
    mock_svc.get_spending_by_category = AsyncMock(return_value=[])
    mock_svc_cls.return_value = mock_svc

    db = MagicMock()
    out = await query_agent.process(
        "Top spending categories",
        user_id="u1",
        db=db,
    )
    assert "No spending data" in out
