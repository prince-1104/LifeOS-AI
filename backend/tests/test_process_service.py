"""process_input orchestration + error paths."""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from schemas import OrchestratorOutput
from services.process_service import MSG_TEMPORARY, process_input


def _rid():
    return "00000000-0000-4000-8000-000000000001"


@pytest.mark.asyncio
@patch("services.process_service.check_rate_limit", return_value=True)
@patch("services.process_service.log_query", new_callable=AsyncMock)
@patch("services.process_service.log_agent_step", new_callable=AsyncMock)
@patch("services.process_service.log_orchestrator_step", new_callable=AsyncMock)
@patch("services.process_service.route", new_callable=AsyncMock)
@patch("services.process_service.classify_llm", new_callable=AsyncMock)
async def test_process_input_success(
    mock_classify, mock_route, mock_orch_log, mock_agent_log, mock_log, _mock_rl
):
    mock_classify.return_value = OrchestratorOutput(type="memory", content="x", tags=[])
    mock_route.return_value = ("ok", "memory")
    db = MagicMock()

    out = await process_input("user-1", "hello", db, request_id=_rid())

    assert out["success"] is True
    assert out["type"] == "memory"
    assert out["response"] == "ok"
    assert out["request_id"] == _rid()
    assert out["data"] == {"content": "x"}
    mock_classify.assert_awaited_once_with("hello")
    mock_route.assert_awaited_once()
    mock_log.assert_awaited_once()


@pytest.mark.asyncio
@patch("services.process_service.check_rate_limit", return_value=True)
@patch("services.process_service.log_orchestrator_step", new_callable=AsyncMock)
@patch("services.process_service.log_error", new_callable=AsyncMock)
@patch("services.process_service.classify_llm", new_callable=AsyncMock)
async def test_process_input_error_on_classify(
    mock_classify, mock_err, mock_orch, _mock_rl
):
    mock_classify.side_effect = RuntimeError("api down")
    db = MagicMock()

    out = await process_input("user-1", "hello", db, request_id=_rid())

    assert out["success"] is False
    assert out["type"] == "error"
    assert out["response"] == MSG_TEMPORARY
    mock_err.assert_awaited()


@pytest.mark.asyncio
@patch("services.process_service.check_rate_limit", return_value=True)
@patch("services.process_service.log_agent_step", new_callable=AsyncMock)
@patch("services.process_service.log_orchestrator_step", new_callable=AsyncMock)
@patch("services.process_service.log_error", new_callable=AsyncMock)
@patch("services.process_service.route", new_callable=AsyncMock)
@patch("services.process_service.classify_llm", new_callable=AsyncMock)
async def test_process_input_error_on_route(
    mock_classify, mock_route, mock_err, mock_orch, mock_agent, _mock_rl
):
    mock_classify.return_value = OrchestratorOutput(type="memory", content="x", tags=[])
    mock_route.side_effect = RuntimeError("boom")
    db = MagicMock()

    out = await process_input("user-1", "hello", db, request_id=_rid())

    assert out["success"] is False
    assert out["response"] == MSG_TEMPORARY
    mock_err.assert_awaited()


@pytest.mark.asyncio
@patch("services.process_service.check_rate_limit", return_value=True)
@patch("services.process_service.log_query", new_callable=AsyncMock)
@patch("services.process_service.log_agent_step", new_callable=AsyncMock)
@patch("services.process_service.log_orchestrator_step", new_callable=AsyncMock)
@patch("services.process_service.route", new_callable=AsyncMock)
@patch("services.process_service.classify_llm", new_callable=AsyncMock)
async def test_process_input_succeeds_when_log_query_fails(
    mock_classify, mock_route, mock_orch, mock_agent, mock_log, _mock_rl
):
    mock_classify.return_value = OrchestratorOutput(type="query", query="q")
    mock_route.return_value = ("answer", "query")
    mock_log.side_effect = RuntimeError("db full")
    db = MagicMock()

    out = await process_input("u1", "q", db, request_id=_rid())

    assert out["success"] is True
    assert out["response"] == "answer"


@pytest.mark.asyncio
async def test_process_input_empty():
    db = MagicMock()
    out = await process_input("u1", "   ", db, request_id=_rid())
    assert out["success"] is False
    assert "Please enter" in out["response"]


@pytest.mark.asyncio
async def test_process_input_too_long():
    db = MagicMock()
    out = await process_input("u1", "x" * 501, db, request_id=_rid())
    assert out["success"] is False
    assert "too long" in out["response"].lower()


@pytest.mark.asyncio
@patch("services.process_service.check_rate_limit", return_value=False)
@patch("services.process_service.log_error", new_callable=AsyncMock)
async def test_process_input_rate_limited(mock_err, _mock_rl):
    db = MagicMock()
    out = await process_input("u1", "hello", db, request_id=_rid())
    assert out["success"] is False
    assert "many requests" in out["response"].lower()
    mock_err.assert_awaited()
