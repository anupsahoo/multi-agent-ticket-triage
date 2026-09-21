"""Human handoff. Closes the ticket as escalated and hands the whole state to
whichever connector serves handoff.create — a JSON file today, a Jira issue
when that connector is configured. The trail is the description a human reads.

Reads: the whole state; escalation_reason if a specialist set one, otherwise
the only way to arrive here without one is the router's low-confidence edge.
Writes: status="escalated", escalation_reason, handoff_ref, one tool_call and
two trail lines. The handoff call itself goes through safe_call, so a broken
handoff connector still yields an escalated ticket with the failure on record.
"""
from __future__ import annotations

from typing import Callable

from ..connectors import Cap, Registry, safe_call
from ..state import TicketState

Node = Callable[[TicketState], dict]


def make_escalation(registry: Registry) -> Node:
    """Build the escalation node; the handoff connector is resolved on each call
    so a runtime rebind in the console takes effect immediately."""

    def escalation(state: TicketState) -> dict:
        reason = state.get("escalation_reason") or "low routing confidence"
        name, spec = registry.for_capability(Cap.HANDOFF_CREATE)
        payload = {
            "message": state["message"],
            "intent": state.get("intent"),
            "confidence": state.get("confidence"),
            "route_history": state.get("route_history", []),
            "tool_calls": state.get("tool_calls", []),
            "trail": state.get("trail", []) + [f"escalation: {reason}"],
        }
        call = safe_call(name, spec, ticket_id=state["ticket_id"], reason=reason, payload=payload)
        ref = call["result"]["reference"] if call["ok"] else None
        where = call["result"]["location"] if call["ok"] else f"handoff failed: {call['error']}"
        return {
            "status": "escalated",
            "escalation_reason": reason,
            "handoff_ref": ref,
            "tool_calls": [call],
            "trail": [f"escalation: {reason}", f"escalation: handed to human via {name} → {where}"],
        }

    return escalation
