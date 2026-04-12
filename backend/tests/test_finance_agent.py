"""Finance agent heuristics and orchestrator field resolution."""

from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest

from agents import finance_agent
from agents.finance_agent import extract_source, infer_transaction_type
from schemas import OrchestratorOutput


def test_infer_expense_spent():
    assert infer_transaction_type("I spent 200 on food") == "expense"


def test_infer_expense_bought():
    assert infer_transaction_type("I bought coffee for 120") == "expense"


def test_infer_income_received():
    assert infer_transaction_type("I received 1000 from sumit") == "income"


def test_extract_source_expense_to():
    assert extract_source("I paid 500 to shiv", "expense") == "shiv"


def test_extract_source_income_from():
    assert extract_source("I received 1000 from sumit", "income") == "sumit"


@pytest.mark.asyncio
@patch("agents.finance_agent.DBService")
async def test_process_uses_orchestrator_transaction_type_and_source(mock_db_cls):
    mock_svc = MagicMock()
    mock_svc.insert_transaction = AsyncMock(return_value=uuid4())
    mock_db_cls.return_value = mock_svc

    orch = OrchestratorOutput(
        type="finance",
        amount=1000,
        transaction_type="income",
        source="sumit",
        category=None,
    )
    db = MagicMock()
    out = await finance_agent.process("I received 1000 from sumit", orch, db, "user-1")

    mock_svc.insert_transaction.assert_awaited_once()
    uid, data = mock_svc.insert_transaction.await_args[0]
    assert uid == "user-1"
    assert data["type"] == "income"
    assert data["amount"] == Decimal("1000")
    assert data["source"] == "sumit"
    assert data["category"] == "general"
    assert "1000" in out
    assert "sumit" in out


@pytest.mark.asyncio
@patch("agents.finance_agent.DBService")
async def test_process_falls_back_when_orch_fields_missing(mock_db_cls):
    mock_svc = MagicMock()
    mock_svc.insert_transaction = AsyncMock(return_value=uuid4())
    mock_db_cls.return_value = mock_svc

    orch = OrchestratorOutput(type="finance", amount=200, transaction_type=None, source=None)
    db = MagicMock()
    await finance_agent.process("I spent 200 on food", orch, db, "u2")

    _, data = mock_svc.insert_transaction.await_args[0]
    assert data["type"] == "expense"
    assert data["category"] == "general"
