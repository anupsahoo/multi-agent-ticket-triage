"""Classify the ticket and decide where it goes.

Honours a reroute recommendation from a specialist: if a specialist looked at
the tool result and concluded "this is not my domain, it is X", the router
sends it to X rather than re-running the same classification and looping.

Reads: state.message, state.reroute_to, state.route_history (for the trail
line), and config.INTENT_CONFIDENCE_MIN at call time.
Writes: intent, confidence, intent_probs, intent_source, trail; clears
reroute_to once honoured.
"""
from __future__ import annotations

from typing import Callable

from .. import config
from ..classifier import Classifier
from ..state import TicketState

Node = Callable[[TicketState], dict]


def make_router(classifier: Classifier) -> Node:
    """Build the router node around whichever classifier the engine selected."""

    def router(state: TicketState) -> dict:
        if state.get("reroute_to"):
            target = state["reroute_to"]
            return {
                "intent": target,
                "confidence": 1.0,   # a specialist's verdict after seeing facts outranks the first-pass classifier
                "reroute_to": None,
                "trail": [f"router: honouring handoff from {state['route_history'][-1]} → {target}"],
            }

        i = classifier.intent(state["message"])
        probs = ", ".join(f"{k} {v:.2f}" for k, v in sorted(i.probabilities.items(), key=lambda t: -t[1]))
        line = f"router[{i.source}]: intent={i.label} confidence={i.confidence:.2f} ({probs})"
        if i.confidence < config.INTENT_CONFIDENCE_MIN:
            line += f" → below {config.INTENT_CONFIDENCE_MIN:.2f}, escalating rather than guessing"
        return {
            "intent": i.label,
            "confidence": i.confidence,
            "intent_probs": i.probabilities,
            "intent_source": i.source,
            "trail": [line],
        }

    return router


def route_after_router(state: TicketState) -> str:
    """Conditional edge: the intent's node name, or "escalation" when confidence is below the threshold."""
    if state["confidence"] < config.INTENT_CONFIDENCE_MIN:
        return "escalation"
    return state["intent"]
