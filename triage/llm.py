"""The language layer, kept deliberately narrow.

Specialists need two things from a model: to choose a tool call (the technical
agent uses genuine LLM tool calling) and to draft a reply from a validated
result. Everything else — routing, domain fit, whether the reply resolves the
ticket — is a decision, and decisions live in classifier.py.

Reads: LLM_MODEL from the environment (in `make_llm`), the ticket message and
the ToolSpecs a specialist offers, and a validated tool result.
Returns: a `ToolChoice` (or None when no tool applies) and a reply string.
Used by: agents/common.py, via the `SpecialistLLM` protocol only.
"""
from __future__ import annotations

import os
from dataclasses import dataclass
from typing import TYPE_CHECKING, Callable, Protocol

from . import extract
from .connectors.base import ToolSpec

if TYPE_CHECKING:  # typing only; the provider package is loaded lazily in make_llm()
    from langchain_core.language_models import BaseChatModel


@dataclass
class ToolChoice:
    """Which tool to call and with what arguments. `name` matches a ToolSpec.name."""
    name: str
    args: dict


class SpecialistLLM(Protocol):
    """What a specialist may ask of the language layer. Nothing more."""

    def choose_tool(self, message: str, specs: list[ToolSpec]) -> ToolChoice | None: ...
    def draft_reply(self, domain: str, message: str, tool_result: dict | None) -> str: ...


# ── real adapter ─────────────────────────────────────────────────────────────

class ChatModelLLM:
    """Wraps any LangChain chat model that supports tool binding. The provider is
    chosen by configuration, not by code; see make_llm()."""

    def __init__(self, chat_model: BaseChatModel) -> None:
        self.model = chat_model

    def choose_tool(self, message: str, specs: list[ToolSpec]) -> ToolChoice | None:
        """Bind the specs as tools and let the model pick one. First call wins;
        no call means the model saw nothing worth looking up."""
        from langchain_core.tools import StructuredTool

        tools = [StructuredTool.from_function(func=s.fn, name=s.name, description=s.description,
                                              args_schema=s.args_schema) for s in specs]
        bound = self.model.bind_tools(tools)
        out = bound.invoke("Decide which tool to call, and with what arguments, to investigate this "
                           f"support ticket. Call at most one tool.\n\nTicket: {message}")
        calls = getattr(out, "tool_calls", None) or []
        if not calls:
            return None
        return ToolChoice(calls[0]["name"], dict(calls[0]["args"]))

    def draft_reply(self, domain: str, message: str, tool_result: dict | None) -> str:
        """A short customer reply grounded only in the lookup result."""
        out = self.model.invoke(
            f"You are the {domain} support specialist. Using ONLY the facts in the lookup result, write a "
            "short reply to the customer. If the lookup does not answer the question, say so plainly.\n\n"
            f"Ticket: {message}\nLookup result: {tool_result}")
        return out.content if isinstance(out.content, str) else str(out.content)


# ── stub ─────────────────────────────────────────────────────────────────────

# How the stub fills a single-argument tool from the message, by argument name.
_FILLERS: dict[str, Callable[[str], str | None]] = {
    "query": extract.query,
    "invoice_id": extract.invoice_id,
    "account_id": extract.account_id,
}


class StubLLM:
    """Offline. Picks the first tool whose single argument it can fill from the
    message, and drafts a templated reply from the validated result."""

    def choose_tool(self, message: str, specs: list[ToolSpec]) -> ToolChoice | None:
        for spec in specs:
            fields = list(spec.args_schema.model_fields)
            if len(fields) != 1 or fields[0] not in _FILLERS:
                continue
            value = _FILLERS[fields[0]](message)
            if value is not None:
                return ToolChoice(spec.name, {fields[0]: value})
        return None

    def draft_reply(self, domain: str, message: str, tool_result: dict | None) -> str:
        """Templated on the result's shape: invoice, account, search matches, or anything else."""
        if not tool_result:
            return "I could not find a record to base an answer on."
        r = tool_result
        if "invoice_id" in r:
            extra = " I can see it was charged twice, so a refund of the duplicate is due." if r["charges"] > 1 else ""
            return (f"Invoice {r['invoice_id']} for {r['amount']:.2f} {r['currency']} is marked {r['status']}."
                    f"{extra}")
        if "account_id" in r and "plan" in r:
            return f"Account {r['account_id']} is on the {r['plan']} plan, status {r['status']}, balance due {r['balance_due']:.2f}."
        if "matches" in r:
            if not r["matches"]:
                return "I searched but found nothing matching."
            m = r["matches"][0]
            if "workaround" in m:   # a KnownIssue rather than a KBArticle
                wa = f" Workaround: {m['workaround']}" if m.get("workaround") else " No workaround yet."
                return f"This is a known issue ({m['issue_id']}: {m['title']}, status {m['status']}).{wa}"
            return f"{m['title']}: {m['answer']}"
        return "Here is what I found: " + str(r)


# ── selection ────────────────────────────────────────────────────────────────

def make_llm() -> tuple[SpecialistLLM, BaseChatModel | None, str]:
    """Returns (specialist llm, underlying chat model or None, provider label).

    Set LLM_MODEL to any LangChain model string, e.g. "openai:gpt-4o-mini",
    "ollama:llama3.2", "google_genai:gemini-2.0-flash".
    The matching provider package must be installed and its API key set in the
    environment under that provider's usual variable. With LLM_MODEL unset the
    deterministic stub is used, which is also what the tests use.

    The chat model is returned separately so `classifier.make_classifier` can
    reuse it for structured output when Jev is not configured.
    """
    spec = os.getenv("LLM_MODEL", "").strip()
    if not spec:
        return StubLLM(), None, "stub"
    from langchain.chat_models import init_chat_model
    model = init_chat_model(spec, temperature=0)
    provider = spec.split(":", 1)[0] if ":" in spec else "llm"
    return ChatModelLLM(model), model, provider
