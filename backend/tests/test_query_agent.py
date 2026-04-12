"""
Unit tests: filter_results and handle_query (no network).

Manual integration (Neon + Qdrant + API keys), server on port 6080:

1. Store: POST /process {"input": "remember bike key under table"}
   then {"input": "remember car keys in drawer"}
2. Case 1 — POST {"input": "where are my keys?"}
   Expect: multiple bullets including both memories.
3. Case 2 — POST {"input": "where is my bike key"}
   Expect: single line about bike key / table.
4. Case 3 — POST {"input": "where is my wallet"}
   Expect: I couldn't find anything.
"""

from agents.query_agent import filter_results, handle_query


def test_handle_query_empty():
    assert handle_query([]) == "I couldn't find anything."


def test_handle_query_single():
    assert handle_query([{"content": "hello world"}]) == "You said: hello world"


def test_handle_query_multiple():
    out = handle_query(
        [
            {"content": "bike key under table"},
            {"content": "car keys in drawer"},
        ]
    )
    assert "I found multiple related memories:" in out
    assert "bike key under table" in out
    assert "car keys in drawer" in out


def test_handle_query_dedupes_same_content():
    out = handle_query(
        [
            {"content": "same"},
            {"content": "same"},
        ]
    )
    assert out.count("same") == 1


def test_filter_results_case1_keys_both_memories():
    res = [
        {"content": "bike key under table"},
        {"content": "car keys in drawer"},
    ]
    out = filter_results("where are my keys?", res)
    assert len(out) == 2


def test_filter_results_case2_bike_key_only():
    res = [
        {"content": "bike key under table"},
        {"content": "car keys in drawer"},
    ]
    out = filter_results("where is my bike key", res)
    assert len(out) == 1
    assert "bike" in out[0]["content"]


def test_filter_results_no_match_returns_empty():
    res = [{"content": "only memory"}]
    out = filter_results("xyzabc unmatched tokens here", res)
    assert out == []


def test_filter_results_wallet_no_match():
    res = [
        {"content": "bike key under table"},
        {"content": "car keys in drawer"},
    ]
    out = filter_results("where is my wallet", res)
    assert out == []


def test_filter_results_empty_tokens_returns_original():
    res = [{"content": "a"}]
    out = filter_results("???", res)
    assert out == res
