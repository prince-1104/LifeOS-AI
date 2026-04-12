"""Router and orchestrator wiring; OpenAI mocked — no network."""

import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from orchestrator.orchestrator_llm import classify_llm
from orchestrator.router import route
from schemas import OrchestratorOutput


@pytest.mark.asyncio
@patch("orchestrator.router.finance_agent.process", new_callable=AsyncMock)
async def test_route_finance_delegates(mock_fin):
    mock_fin.return_value = "Recorded expense of ₹500 for general (shiv)."
    db = MagicMock()
    orch = OrchestratorOutput(type="finance", amount=500.0, category="general")
    text, t = await route("I paid 500 to shiv", orch, db, "default")
    assert t == "finance"
    assert "Recorded" in text
    mock_fin.assert_awaited_once()


@pytest.mark.asyncio
async def test_route_reminder_stub():
    db = MagicMock()
    orch = OrchestratorOutput(type="reminder", task="go gym", time="06:00")
    text, t = await route("remind me tomorrow at 6", orch, db, "default")
    assert t == "reminder"
    assert "not implemented" in text.lower()


@pytest.mark.asyncio
async def test_route_unknown():
    orch = OrchestratorOutput(type="unknown")
    text, t = await route("???", orch, MagicMock(), "default")
    assert t == "unknown"
    assert "didn't understand" in text.lower()


@pytest.mark.asyncio
@patch("orchestrator.router.memory_agent.process", new_callable=AsyncMock)
async def test_route_memory_delegates(mock_mem):
    mock_mem.return_value = "Memory saved: bike key under table"
    db = MagicMock()
    orch = OrchestratorOutput(
        type="memory",
        content="bike key under table",
        tags=["bike", "keys"],
    )
    text, t = await route("I kept my bike key under table", orch, db, "u1")
    assert t == "memory"
    assert text == "Memory saved: bike key under table"
    mock_mem.assert_awaited_once()
    call_kw = mock_mem.await_args
    assert call_kw.kwargs["orchestrator"] == orch


@pytest.mark.asyncio
@patch("orchestrator.router.query_agent.process", new_callable=AsyncMock)
async def test_route_query_uses_orch_query(mock_q):
    mock_q.return_value = "You said: keys"
    db = MagicMock()
    orch = OrchestratorOutput(type="query", query="keys location")
    text, t = await route("can you tell me where my keys are", orch, db, "u1")
    assert t == "query"
    mock_q.assert_awaited_once_with("keys location", user_id="u1", db=db)


@pytest.mark.asyncio
@patch("orchestrator.router.query_agent.process", new_callable=AsyncMock)
async def test_route_query_fallback_user_text(mock_q):
    mock_q.return_value = "ok"
    orch = OrchestratorOutput(type="query", query=None)
    db = MagicMock()
    await route("raw question", orch, db, "u1")
    mock_q.assert_awaited_once_with("raw question", user_id="u1", db=db)


@pytest.mark.asyncio
@patch("orchestrator.orchestrator_llm._client")
async def test_classify_llm_parses_json(mock_client):
    orch_json = {
        "type": "memory",
        "content": "bike key under table",
        "tags": ["bike", "location"],
    }
    mock_resp = MagicMock()
    mock_resp.choices = [
        MagicMock(message=MagicMock(content=json.dumps(orch_json)))
    ]
    mock_client.chat.completions.create = AsyncMock(return_value=mock_resp)

    out = await classify_llm("I kept my bike key under table")
    assert out.type == "memory"
    assert out.content == "bike key under table"
    assert out.tags == ["bike", "location"]


@pytest.mark.asyncio
@patch("orchestrator.orchestrator_llm._client")
async def test_classify_llm_invalid_json_returns_unknown(mock_client):
    mock_resp = MagicMock()
    mock_resp.choices = [MagicMock(message=MagicMock(content="not json"))]
    mock_client.chat.completions.create = AsyncMock(return_value=mock_resp)

    out = await classify_llm("x")
    assert out.type == "unknown"
