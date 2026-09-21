"""The graph cases the brief asks for, plus the failure paths that matter.

Required by the brief: one clean resolution per specialist, one misroute then
correct route, one escalation. The rest exist because failure handling is the
part the exercise says is most revealing.
"""
from triage.config import MAX_HOPS


# ── clean resolutions, one per specialist ────────────────────────────────────

def test_billing_resolves(run):
    """Brief: clean billing resolution — direct-mode id extraction, one lookup, a refund in the reply."""
    s = run("I was charged twice for invoice INV-1002")
    assert s["status"] == "resolved"
    assert s["route_history"] == ["billing"]
    assert [t["name"] for t in s["tool_calls"]] == ["lookup_invoice"]
    assert "refund" in s["resolution"].lower()


def test_technical_resolves_via_llm_tool_calling(run):
    """Brief: clean technical resolution through the LLM tool-calling path, picking the right known issue."""
    s = run("The app crashes with an error every time I export to CSV")
    assert s["status"] == "resolved"
    assert s["route_history"] == ["technical"]
    call = s["tool_calls"][0]
    assert call["name"] == "check_known_issue" and call["ok"]
    assert "KI-203" in s["resolution"]                      # the export issue, not the invoice one
    assert any("asked the model which tool to call" in line for line in s["trail"])


def test_general_resolves(run):
    """Brief: clean general resolution via the knowledge base."""
    s = run("What are your support hours?")
    assert s["status"] == "resolved"
    assert s["route_history"] == ["general"]
    assert "08:00" in s["resolution"]


# ── misroute, then the right route ───────────────────────────────────────────

def test_misroute_then_correct_route(run):
    """Brief: first-pass router sends it to billing; the facts say technical; the handoff is honoured and it resolves."""
    s = run("Invoice INV-1002 opens but the page crashes with an error every time")
    assert s["status"] == "resolved"
    assert s["route_history"] == ["billing", "technical"]
    assert [t["name"] for t in s["tool_calls"]] == ["lookup_invoice", "check_known_issue"]
    assert any("handing to technical" in line for line in s["trail"])
    assert any("honouring handoff from billing" in line for line in s["trail"])


# ── escalations: every path ends with a reason and a handoff, never a guess ──

def _escalated(s):
    """Every escalation must carry a reason, a handoff reference, a successful handoff call and no resolution."""
    assert s["status"] == "escalated"
    assert s["escalation_reason"]
    assert s["handoff_ref"] and s["handoff_ref"].startswith("HANDOFF-")
    assert s["tool_calls"][-1]["name"] == "create_handoff" and s["tool_calls"][-1]["ok"]
    assert s["resolution"] is None


def test_low_confidence_escalates_without_visiting_a_specialist(run):
    """Brief: below INTENT_CONFIDENCE_MIN the router escalates directly; no specialist, no tool call."""
    s = run("asdf qwerty zxcv")
    _escalated(s)
    assert s["route_history"] == []
    assert s["confidence"] < 0.6
    assert "low routing confidence" in s["escalation_reason"]


def test_tool_not_found_escalates(run):
    """Failure path: a NotFound from the connector becomes an escalation, not a guessed answer."""
    s = run("Please refund invoice INV-0000, it was a mistake")
    _escalated(s)
    assert s["tool_calls"][0]["error"] == "not_found"
    assert "found nothing" in s["escalation_reason"]


def test_tool_exception_is_contained_and_escalates(run):
    """Failure path: an exception inside a connector is contained by safe_call and escalates with the reason."""
    s = run("My account ACC-9999 shows the wrong plan")
    _escalated(s)
    assert s["tool_calls"][0]["error"].startswith("exception:")
    assert "not guessing" in s["escalation_reason"]


def test_missing_identifier_escalates_before_calling_anything(run):
    """Failure path: a billing ticket with no INV-/ACC- id asks a human for it rather than calling any tool."""
    s = run("You billed me twice this month and I want a refund")
    _escalated(s)
    assert [t["name"] for t in s["tool_calls"]] == ["create_handoff"]   # no lookup attempted
    assert "invoice id" in s["escalation_reason"]


def test_resolution_gate_blocks_a_weak_draft(run):
    """Failure path: a draft scoring below RESOLUTION_MIN is discarded and the ticket escalates."""
    s = run("I was charged twice for invoice INV-1002", resolves=0.1)
    _escalated(s)
    assert "did not confidently resolve" in s["escalation_reason"]
    assert s["tool_calls"][0]["ok"]                          # the lookup itself was fine


def test_hop_limit_stops_a_routing_loop(run):
    """Failure path: when every specialist disowns the ticket, MAX_HOPS ends the bounce with an escalation."""
    s = run("I was charged twice for invoice INV-1002", domain_fit=0.0)
    _escalated(s)
    assert len(s["route_history"]) == MAX_HOPS
    assert "hop limit" in s["escalation_reason"]


# ── the trail is a complete record ───────────────────────────────────────────

def test_trail_records_every_step_for_a_human(run):
    """The trail names every node visited, every tool called and every decision, in order."""
    s = run("Invoice INV-1002 opens but the page crashes with an error every time")
    joined = "\n".join(s["trail"])
    for expected in ("router[stub]", "billing: picked up", "lookup_invoice", "domain fit",
                     "handing to technical", "technical: picked up", "check_known_issue", "resolved"):
        assert expected in joined
