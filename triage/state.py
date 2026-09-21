"""The single state object every node reads from and writes to.

List fields carry an `operator.add` reducer, so a node returns only what it wants
to append and LangGraph merges it. That is what makes the trail a complete record
of every attempt rather than the last node's opinion.

Reads: nothing. Produces: `TicketState` (the graph's schema) and `new_ticket`,
the fully-initialised state a run starts from. Every node in agents/ returns a
partial dict of these keys; nothing else is ever merged into the state.
"""
from __future__ import annotations

import operator
import uuid
from typing import Annotated, Literal, TypedDict


class ToolCall(TypedDict):
    """One tool invocation as recorded by `connectors.safe_call`. `ok` is the only
    field an agent should branch on; `error` explains a failure for the trail."""
    connector: str
    capability: str
    name: str
    args: dict
    ok: bool
    error: str | None      # "not_found" | "not_configured: …" | "invalid_args: …" | "invalid_result: …" | "exception: …"
    result: dict | None


Intent = Literal["billing", "technical", "general", "unknown"]
Status = Literal["open", "resolved", "escalated"]
Decision = Literal["resolved", "reroute", "escalate", ""]


class TicketState(TypedDict, total=False):
    """Graph state. Written by: router (intent block), specialists (history and
    outcome), escalation (outcome). Read by: every node and the conditional edges."""
    ticket_id: str
    message: str

    # router output
    intent: Intent
    confidence: float
    intent_probs: dict[str, float]
    intent_source: str            # "jev" | "llm" | "stub" — the README explains why this matters

    # a specialist can hand the ticket back with a recommendation
    reroute_to: str | None
    last_decision: Decision

    # accumulated history; reducers append rather than replace
    route_history: Annotated[list[str], operator.add]
    hops: int
    tool_calls: Annotated[list[ToolCall], operator.add]
    trail: Annotated[list[str], operator.add]

    # outcome
    status: Status
    resolution: str | None
    escalation_reason: str | None
    handoff_ref: str | None


def new_ticket_id() -> str:
    """A short random id, e.g. "T-3F9A1C". Used by the CLI and the console store."""
    return f"T-{uuid.uuid4().hex[:6].upper()}"


def new_ticket(ticket_id: str, message: str) -> TicketState:
    """The state a run starts from: every key present, nothing decided yet."""
    return {
        "ticket_id": ticket_id,
        "message": message,
        "intent": "unknown",
        "confidence": 0.0,
        "intent_probs": {},
        "intent_source": "",
        "reroute_to": None,
        "last_decision": "",
        "route_history": [],
        "hops": 0,
        "tool_calls": [],
        "trail": [],
        "status": "open",
        "resolution": None,
        "escalation_reason": None,
        "handoff_ref": None,
    }
