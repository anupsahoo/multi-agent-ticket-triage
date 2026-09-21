"""What every connector must provide, and the result shapes agents can rely on.

Result schemas live here, not in the connectors, so an agent's contract is fixed
regardless of which connector serves it. A connector that returns something
else fails validation in `safe_call` before an agent ever sees it.

Reads: nothing. Defines: the capability names (`Cap`), the two exceptions a
connector may raise on purpose, the pydantic result and argument schemas per
capability, `ToolSpec` (one implemented capability) and the `Connector` base
class every connector subclasses.
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Callable

from pydantic import BaseModel, Field


class Cap:
    """Capability names. Constants so a typo fails at import time, not in production."""
    ACCOUNT_LOOKUP = "account.lookup"
    INVOICE_LOOKUP = "invoice.lookup"
    ISSUES_SEARCH = "issues.search"
    KB_SEARCH = "kb.search"
    HANDOFF_CREATE = "handoff.create"

    ALL = (ACCOUNT_LOOKUP, INVOICE_LOOKUP, ISSUES_SEARCH, KB_SEARCH, HANDOFF_CREATE)


# ── errors a connector may raise; safe_call turns them into structured outcomes ──

class NotFound(Exception):
    """The lookup ran correctly and the thing does not exist. Distinct from an error."""


class ConnectorNotConfigured(Exception):
    """A real connector whose credentials are absent. Named so the trail says exactly why."""


# ── result schemas: the contract agents are written against ──────────────────

class AccountStatus(BaseModel):
    account_id: str
    plan: str
    status: str = Field(description="active | past_due | suspended")
    balance_due: float
    currency: str = "GBP"


class Invoice(BaseModel):
    invoice_id: str
    account_id: str
    amount: float
    currency: str = "GBP"
    status: str = Field(description="paid | open | refunded | disputed")
    charges: int = Field(description="how many times this invoice was charged")


class KnownIssue(BaseModel):
    issue_id: str
    title: str
    status: str = Field(description="open | fixed | investigating")
    workaround: str | None = None
    affected_versions: list[str] = []


class IssueSearchResult(BaseModel):
    query: str
    matches: list[KnownIssue]


class KBArticle(BaseModel):
    article_id: str
    title: str
    answer: str


class KBSearchResult(BaseModel):
    query: str
    matches: list[KBArticle]


class HandoffReceipt(BaseModel):
    reference: str
    location: str = Field(description="where a human can find the escalated ticket")


# ── argument schemas ─────────────────────────────────────────────────────────

class AccountArgs(BaseModel):
    account_id: str


class InvoiceArgs(BaseModel):
    invoice_id: str


class SearchArgs(BaseModel):
    query: str = Field(min_length=2)


class HandoffArgs(BaseModel):
    ticket_id: str
    reason: str
    payload: dict


# ── the unit a connector exposes ─────────────────────────────────────────────

@dataclass(frozen=True)
class ToolSpec:
    """One capability, implemented. `fn` takes validated kwargs and returns a raw
    dict or model; `safe_call` validates it against `result_schema`."""
    capability: str
    name: str
    description: str
    args_schema: type[BaseModel]
    result_schema: type[BaseModel]
    fn: Callable[..., object]


class Connector(ABC):
    """Subclass this. Declare a name, the capabilities you serve, and return a
    ToolSpec per capability from `tools()`. See `_template.py`."""

    name: str               # what connectors.toml refers to
    capabilities: set[str]  # subset of Cap.ALL; only what tools() actually serves

    @abstractmethod
    def tools(self) -> list[ToolSpec]: ...

    def health(self) -> bool:
        """Override for real connectors: reachable, authenticated, etc."""
        return True

    def spec_for(self, capability: str) -> ToolSpec:
        """The ToolSpec this connector serves for a capability; KeyError if it declares none."""
        for spec in self.tools():
            if spec.capability == capability:
                return spec
        raise KeyError(f"{self.name} does not serve {capability}")
