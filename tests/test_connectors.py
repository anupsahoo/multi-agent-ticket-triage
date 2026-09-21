"""The connector seam: resolution by capability, validation at the boundary,
and the proof that a custom connector plugs in without touching an agent."""
import pytest

from triage.classifier import StubClassifier
from triage.connectors import Cap, Connector, NotFound, Registry, ToolSpec, safe_call
from triage.connectors.base import IssueSearchResult, KnownIssue, SearchArgs
from triage.connectors.registry import CapabilityUnavailable
from triage.graph import build_graph
from triage.llm import StubLLM
from triage.state import new_ticket


def test_registry_resolves_by_capability(registry):
    """connectors.toml binds invoice.lookup to the mock connector and its lookup_invoice spec."""
    name, spec = registry.for_capability(Cap.INVOICE_LOOKUP)
    assert name == "mock" and spec.name == "lookup_invoice"


def test_unbound_capability_fails_loudly():
    """An empty registry raises CapabilityUnavailable rather than returning nothing."""
    with pytest.raises(CapabilityUnavailable):
        Registry().for_capability(Cap.KB_SEARCH)


def test_safe_call_rejects_a_malformed_result():
    """A connector returning an off-schema result is reported as invalid_result, never passed to an agent."""
    bad = ToolSpec(Cap.ISSUES_SEARCH, "bad", "returns the wrong shape", SearchArgs, IssueSearchResult,
                   lambda query: {"totally": "wrong"})
    call = safe_call("x", bad, query="anything")
    assert not call["ok"] and call["error"].startswith("invalid_result")


def test_safe_call_rejects_bad_arguments(registry):
    """Arguments failing the args schema (SearchArgs.query min_length=2) are reported as invalid_args."""
    name, spec = registry.for_capability(Cap.KB_SEARCH)
    call = safe_call(name, spec, query="a")       # min_length is 2
    assert not call["ok"] and call["error"].startswith("invalid_args")


def test_real_connector_shapes_report_not_configured(registry, monkeypatch):
    """The shape-only Jira connector reports not_configured when its credentials are absent."""
    monkeypatch.delenv("JIRA_BASE_URL", raising=False)
    registry.bind(Cap.ISSUES_SEARCH, "jira")
    name, spec = registry.for_capability(Cap.ISSUES_SEARCH)
    call = safe_call(name, spec, query="login loop")
    assert name == "jira" and call["error"].startswith("not_configured")


# ── the extension point, proven end to end ───────────────────────────────────

class AcmeConnector(Connector):
    """A throwaway connector: serves issues.search with a single canned answer."""
    name = "acme"
    capabilities = {Cap.ISSUES_SEARCH}

    def tools(self) -> list[ToolSpec]:
        def search(query: str) -> dict:
            if "nothing" in query:
                raise NotFound("acme has no record")
            return IssueSearchResult(query=query, matches=[
                KnownIssue(issue_id="ACME-1", title="Export fails on large files", status="fixed",
                           workaround="Split the export into batches.")]).model_dump()
        return [ToolSpec(Cap.ISSUES_SEARCH, "acme_search", "Search Acme.", SearchArgs, IssueSearchResult, search)]


def test_custom_connector_plugs_in_and_the_agent_uses_it(registry):
    """Extension point: register + bind a new connector and the technical agent uses it with no agent change."""
    registry.register(AcmeConnector()).bind(Cap.ISSUES_SEARCH, "acme")
    app = build_graph(StubClassifier(), StubLLM(), registry)
    s = app.invoke(new_ticket("T-ACME", "The app crashes with an error every time I export to CSV"))
    assert s["status"] == "resolved"
    assert s["tool_calls"][0]["connector"] == "acme"
    assert s["tool_calls"][0]["name"] == "acme_search"
    assert "ACME-1" in s["resolution"]
