"""Query agent finance shortcut (mocked DB)."""

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
