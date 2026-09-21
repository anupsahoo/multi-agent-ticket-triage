"""The decision layer: every yes/no and which-of-these decision in the graph.

Three implementations behind one protocol:

  JevClassifier   — TypeSafe's Jev via langchain-typesafe. A fast classifier
                    (not a generative model) that returns a probability per
                    option and a confidence derived from the distribution. That
                    is a *calibrated* signal, which is what a routing threshold
                    should be driven by. Used when TYPESAFE_API_KEY is set.
  LLMClassifier   — structured output from a chat model. Its confidence is
                    self-reported by the model, which is a weaker signal; the
                    trail records the source so a reviewer knows which they got.
  StubClassifier  — deterministic keyword rules. Used by every test and as the
                    zero-config default, so the repo runs with no keys at all.

Reads: the ticket message, the current domain and the validated tool result
(all passed in by the agents); TYPESAFE_API_KEY from the environment in
`make_classifier`. Returns: an `Intent` for routing, and 0..1 scores for
"is this still my domain" and "does this draft resolve the ticket". The
agents compare those scores against config.py; nothing here knows the thresholds.

Nodes only see the protocol. The graph does not know or care which one it has.
"""
from __future__ import annotations

import os
from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Protocol

from .config import DOMAINS
from .extract import words

if TYPE_CHECKING:  # typing only; the chat model is created by llm.make_llm()
    from langchain_core.language_models import BaseChatModel

DOMAIN_DESCRIPTIONS = {
    "billing": "Charges, invoices, refunds, subscriptions, plans and payment problems.",
    "technical": "Bugs, crashes, errors, things that do not work as designed.",
    "general": "How-to questions, account information, feature requests, anything else.",
}


@dataclass
class Intent:
    """The router's verdict. `confidence` is what route_after_router thresholds;
    `probabilities` and `reason` are recorded in the trail for a reviewer."""
    label: str                         # one of DOMAINS
    confidence: float                  # 0..1
    probabilities: dict[str, float] = field(default_factory=dict)
    source: str = ""                   # "jev" | "llm" | "stub"
    reason: str = ""


class Classifier(Protocol):
    """The three decisions the graph makes. Scores are probabilities in 0..1."""

    def intent(self, message: str, context: str | None = None) -> Intent: ...
    def domain_fit(self, message: str, domain: str, tool_result: dict | None) -> float: ...
    def resolves(self, message: str, tool_result: dict | None, draft: str) -> float: ...


# ── Jev ─────────────────────────────────────────────────────────────────────

class JevClassifier:
    """Calibrated probabilities from TypeSafe's Jev. Imports are lazy because
    langchain-typesafe is an optional dependency."""

    def __init__(self) -> None:
        from langchain_typesafe import TypeSafeClassifier
        self._c = TypeSafeClassifier()

    def intent(self, message: str, context: str | None = None) -> Intent:
        from langchain_typesafe import Choice
        state = message if context is None else f"{message}\n\nContext: {context}"
        r = self._c.invoke({"state": state, "questions": {
            "intent": Choice(instructions="Which team should handle this support ticket?",
                             criteria=DOMAIN_DESCRIPTIONS)}})
        a = r.answers["intent"]
        return Intent(a.choice, float(a.confidence), {k: float(v) for k, v in a.probabilities.items()}, "jev",
                      "Jev Choice over the three domains")

    def domain_fit(self, message: str, domain: str, tool_result: dict | None) -> float:
        from langchain_typesafe import Noul
        r = self._c.invoke({"state": {"ticket": message, "lookup": tool_result}, "questions": {
            "fit": Noul(instructions=f"Given the lookup result, this ticket is a {domain} problem "
                                     f"({DOMAIN_DESCRIPTIONS[domain]})")}})
        return float(r.answers["fit"].noul)

    def resolves(self, message: str, tool_result: dict | None, draft: str) -> float:
        from langchain_typesafe import Noul
        r = self._c.invoke({"state": {"ticket": message, "lookup": tool_result, "reply": draft}, "questions": {
            "resolves": Noul(instructions="The reply fully answers the ticket using facts from the lookup, "
                                          "without guessing.")}})
        return float(r.answers["resolves"].noul)


# ── LLM fallback ─────────────────────────────────────────────────────────────

class LLMClassifier:
    """Structured output from a chat model. Confidence is the model's own claim."""

    def __init__(self, chat_model: BaseChatModel) -> None:
        from pydantic import BaseModel, Field

        class IntentOut(BaseModel):
            label: str = Field(description="billing | technical | general")
            confidence: float = Field(ge=0, le=1)
            reason: str

        class ProbOut(BaseModel):
            probability: float = Field(ge=0, le=1)

        self._intent = chat_model.with_structured_output(IntentOut)
        self._prob = chat_model.with_structured_output(ProbOut)

    def intent(self, message: str, context: str | None = None) -> Intent:
        desc = "\n".join(f"- {k}: {v}" for k, v in DOMAIN_DESCRIPTIONS.items())
        out = self._intent.invoke(
            f"Classify this support ticket into exactly one domain.\n{desc}\n\nTicket: {message}"
            + (f"\nContext: {context}" if context else ""))
        label = out.label if out.label in DOMAINS else "general"   # a model may invent a label; never route on it
        return Intent(label, float(out.confidence), {label: float(out.confidence)}, "llm", out.reason)

    def domain_fit(self, message: str, domain: str, tool_result: dict | None) -> float:
        out = self._prob.invoke(f"Probability (0-1) that this ticket is a {domain} problem given the lookup.\n"
                                f"Ticket: {message}\nLookup: {tool_result}")
        return float(out.probability)

    def resolves(self, message: str, tool_result: dict | None, draft: str) -> float:
        out = self._prob.invoke("Probability (0-1) that the reply fully answers the ticket using only facts "
                                f"from the lookup.\nTicket: {message}\nLookup: {tool_result}\nReply: {draft}")
        return float(out.probability)


# ── Stub ─────────────────────────────────────────────────────────────────────

KEYWORDS = {
    "billing": {"invoice", "invoiced", "charge", "charged", "refund", "bill", "billing", "payment", "paid",
                "subscription", "double", "twice", "card", "receipt", "plan"},
    "technical": {"crash", "crashes", "crashed", "error", "bug", "broken", "fails", "failed", "failing", "500",
                  "login", "loop", "timeout", "times", "freeze", "freezes", "stuck", "export", "csv"},
    "general": {"how", "what", "when", "where", "hours", "feature", "request", "add", "wish", "would", "like",
                "contact", "change", "upgrade", "downgrade", "data", "download"},
}


def _hits(text: str) -> dict[str, int]:
    """How many words of `text` are keywords of each domain."""
    ws = words(text)
    return {d: sum(1 for w in ws if w in KEYWORDS[d]) for d in DOMAINS}


class StubClassifier:
    """Deterministic and offline.

    `intent` uses the *first* domain keyword in the message: a cheap first-pass
    router. `domain_fit` uses the *share* of all domain keywords, i.e. a closer
    look. The two can disagree on purpose — that is how the misroute-then-correct
    case arises naturally rather than being special-cased in a test.

    `overrides` lets a test force specific answers without touching the rules:
    {"intent": {"label", "confidence"}, "domain_fit": float, "resolves": float}.
    """

    def __init__(self, overrides: dict | None = None) -> None:
        self.overrides = overrides or {}

    def intent(self, message: str, context: str | None = None) -> Intent:
        if "intent" in self.overrides:
            i = self.overrides["intent"]
            return Intent(i["label"], i["confidence"], {i["label"]: i["confidence"]}, "stub", "override")
        hits = _hits(message)
        first = next((d for w in words(message) for d in DOMAINS if w in KEYWORDS[d]), None)
        total = sum(hits.values())
        if first is None or total == 0:
            # uniform and just above 1/3: far enough below INTENT_CONFIDENCE_MIN to escalate, not to guess
            probs = {d: 1 / 3 for d in DOMAINS}
            return Intent("general", 0.34, probs, "stub", "no domain keywords found")
        conf = min(0.95, 0.60 + 0.15 * hits[first])   # one keyword clears the router threshold; more adds confidence
        probs = {d: (hits[d] / total) for d in DOMAINS}
        return Intent(first, conf, probs, "stub", f"first domain keyword was {first!r}")

    def domain_fit(self, message: str, domain: str, tool_result: dict | None) -> float:
        if "domain_fit" in self.overrides:
            return float(self.overrides["domain_fit"])
        hits = _hits(message)
        total = sum(hits.values())
        return 1.0 if total == 0 else hits[domain] / total

    def resolves(self, message: str, tool_result: dict | None, draft: str) -> float:
        if "resolves" in self.overrides:
            return float(self.overrides["resolves"])
        # no facts, or a search with no matches, cannot ground a reply; anything else is taken as answered
        if not tool_result:
            return 0.2
        if tool_result.get("matches") == []:
            return 0.25
        return 0.9


# ── selection ────────────────────────────────────────────────────────────────

def make_classifier(llm_chat_model: BaseChatModel | None = None) -> tuple[Classifier, str]:
    """Pick by environment: Jev if TYPESAFE_API_KEY is set and the package is
    installed, else structured output on the chat model if there is one, else
    the stub. Returns (classifier, source label) — the label ends up in every
    trail line the router writes."""
    if os.getenv("TYPESAFE_API_KEY"):
        try:
            return JevClassifier(), "jev"
        except ImportError:
            pass   # key set but package missing: fall through rather than fail the whole engine
    if llm_chat_model is not None:
        return LLMClassifier(llm_chat_model), "llm"
    return StubClassifier(), "stub"
