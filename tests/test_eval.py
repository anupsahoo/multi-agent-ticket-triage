"""The eval harness: the stub baseline is a fixed point, a wrong expectation is
visible in both the step and the system number, and a resolve-when-you-should-
escalate is counted as the failure that logs itself as success.
"""
from triage.eval import check_floor, evaluate, load_labelled, score_case
from triage.state import new_ticket


def test_stub_baseline_is_a_fixed_point(make_app):
    """The committed labelled set scores 1.00 on every step against the stub — this pins samples/ to the code."""
    result = evaluate(make_app(), load_labelled())
    assert result.n == 8
    assert all(result.accuracy(step) == 1.0 for step in ("routing", "tool_choice", "arguments", "outcome"))
    assert result.system == 1.0
    assert result.confident_wrong == []
    assert check_floor(result, {"routing": 1, "outcome": 1, "system": 1, "confident_wrong": 0}) == []


def test_wrong_expectation_lowers_the_step_and_the_system(make_app):
    """Mislabel one case's tool: tool and argument accuracy each drop to 7/8 and the product compounds
    them (0.875 × 0.875), while routing stays 1.00 — the system number is lower than any single step."""
    cases = load_labelled()
    cases[0] = {**cases[0], "tool": "search_kb"}
    result = evaluate(make_app(), cases)
    assert result.accuracy("routing") == 1.0
    assert result.accuracy("tool_choice") == result.accuracy("arguments") == 0.875
    assert result.system == 0.766
    assert result.cases[0].tool_choice is False


def test_resolving_when_told_to_escalate_is_confident_wrong(make_app):
    """A ticket that resolves although the label says escalate is counted, named, and trips the floor."""
    app = make_app()
    case = {"id": "X", "message": "What are your support hours?", "intent": "general",
            "tool": "search_kb", "args": {"query": "*"}, "status": "escalated"}
    final = app.invoke(new_ticket("X", case["message"]))
    scored = score_case(case, final, 1)
    assert scored.outcome is False and scored.confident_wrong is True
    result = evaluate(app, [case])
    assert result.confident_wrong == ["X"]
    assert check_floor(result, {"confident_wrong": 0}) == ["confident_wrong=1 > 0"]
