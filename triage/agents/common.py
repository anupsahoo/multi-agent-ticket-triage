"""The specialist skeleton. All three specialists are this function with
different settings, which is what keeps them readable and identical in shape:

  1. record the visit, count the hop
  2. work out what to look up — either by extracting an identifier (direct
     mode) or by letting the LLM choose a tool call (llm mode)
  3. call the tool through safe_call
  4. handle the outcome: not found / error / not configured → escalate with reason
  5. check the ticket still belongs to this domain, now that we have facts
  6. draft a reply, then check the draft actually resolves the ticket
  7. resolve, or escalate with the reason

Reads: state.message and state.hops; the thresholds in config.py at call time
(they can be changed at runtime through the console). Writes: route_history,
hops, tool_calls, trail on every exit, plus last_decision and — depending on
the branch — reroute_to, or status/resolution, or escalation_reason.

Every branch appends to the trail. A human reading an escalation sees exactly
what was tried and why it stopped.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Callable

from .. import config
from ..classifier import Classifier
from ..config import DOMAINS
from ..connectors import Registry, safe_call
from ..llm import SpecialistLLM, ToolChoice
from ..state import TicketState

Node = Callable[[TicketState], dict]


@dataclass
class Specialist:
    """The settings that make one specialist differ from another. See billing.py,
    technical.py and general.py for the three instances."""
    domain: str
    capabilities: list[str]                       # in preference order
    mode: str                                     # "direct" | "llm"
    extract: Callable[[str], dict | None] | None  # direct mode: message → tool args, or None
    missing_hint: str                             # what to ask the human for when nothing extracts


def _escalate(domain: str, reason: str, trail: list[str], extra: dict | None = None) -> dict:
    """The partial state for "stop here and hand to a human", with the reason on the trail."""
    return {"last_decision": "escalate", "escalation_reason": reason,
            "trail": trail + [f"{domain}: escalating — {reason}"], **(extra or {})}


def make_specialist(sp: Specialist, classifier: Classifier, llm: SpecialistLLM, registry: Registry) -> Node:
    """Build the node for one specialist. The numbered comments follow the module docstring."""

    def node(state: TicketState) -> dict:
        d = sp.domain
        msg = state["message"]

        # 1. record the visit
        trail = [f"{d}: picked up ticket (hop {state['hops'] + 1})"]
        base = {"route_history": [d], "hops": state["hops"] + 1}

        # 2. what to look up
        resolved = [registry.for_capability(c) for c in sp.capabilities]
        specs = [spec for _, spec in resolved]
        connector_of = {spec.name: name for name, spec in resolved}

        choice: ToolChoice | None
        if sp.mode == "llm":
            choice = llm.choose_tool(msg, specs)
            trail.append(f"{d}: asked the model which tool to call → "
                         + (f"{choice.name}({choice.args})" if choice else "no tool chosen"))
        else:
            args = sp.extract(msg) if sp.extract else {}
            if args is None:
                return {**base, **_escalate(d, f"needs {sp.missing_hint} to look anything up", trail)}
            # the extractor's keys name the capability: {"invoice_id"} → invoice.lookup, and so on
            spec = next(s for s in specs if set(s.args_schema.model_fields) == set(args))
            choice = ToolChoice(spec.name, args)
            trail.append(f"{d}: extracted {args} from the message")

        if choice is None:
            return {**base, **_escalate(d, f"could not determine what to look up; needs {sp.missing_hint}", trail)}

        # 3. call it, safely
        spec = next(s for s in specs if s.name == choice.name)
        call = safe_call(connector_of[spec.name], spec, **choice.args)
        trail.append(f"{d}: {call['connector']}.{call['name']}({call['args']}) → "
                     + ("ok" if call["ok"] else f"error={call['error']}"))
        base = {**base, "tool_calls": [call]}

        # 4. outcome handling — never proceed on bad data
        if not call["ok"]:
            if call["error"] == "not_found":
                return {**base, **_escalate(d, f"lookup found nothing for {choice.args}; a human should confirm {sp.missing_hint}", trail)}
            return {**base, **_escalate(d, f"tool failed ({call['error']}); not guessing", trail)}
        result = call["result"]

        # 5. is this still my domain, now that we have facts?
        fit = classifier.domain_fit(msg, d, result)
        others = {o: classifier.domain_fit(msg, o, result) for o in DOMAINS if o != d}
        trail.append(f"{d}: domain fit {fit:.2f} (others: " + ", ".join(f"{k} {v:.2f}" for k, v in others.items()) + ")")
        if fit < config.DOMAIN_MIN:
            best = max(others, key=others.get)
            # this visit counts as a hop, so compare hops-after-this-visit against the limit
            if state["hops"] + 1 >= config.MAX_HOPS:
                return {**base, **_escalate(d, f"looks like {best} but hop limit {config.MAX_HOPS} reached; possible routing loop", trail)}
            return {**base, "last_decision": "reroute", "reroute_to": best,
                    "trail": trail + [f"{d}: not my domain — handing to {best}"]}

        # 6. draft, then gate the draft
        draft = llm.draft_reply(d, msg, result)
        score = classifier.resolves(msg, result, draft)
        trail.append(f"{d}: drafted reply; resolution check {score:.2f}")
        if score < config.RESOLUTION_MIN:
            return {**base, **_escalate(d, f"draft did not confidently resolve the ticket ({score:.2f} < {config.RESOLUTION_MIN})", trail)}

        # 7. resolved
        return {**base, "last_decision": "resolved", "status": "resolved", "resolution": draft,
                "trail": trail + [f"{d}: resolved"]}

    return node


def route_after_specialist(state: TicketState) -> str:
    """Conditional edge: the specialist's `last_decision` names the next node."""
    return {"resolved": "__end__", "reroute": "router", "escalate": "escalation"}[state["last_decision"]]
