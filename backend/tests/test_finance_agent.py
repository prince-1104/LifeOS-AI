"""Finance agent heuristics (no DB)."""

from agents.finance_agent import extract_source, infer_transaction_type


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
