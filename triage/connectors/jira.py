"""Jira connector — SHAPE ONLY, by design.

Real external integrations are out of scope for this exercise (see the brief),
so this file exists to show exactly where one goes: the capabilities it serves,
the tool signatures, the result schemas it must satisfy, and the credentials it
reads. Every tool raises ConnectorNotConfigured until those are set, and the
trail records that reason rather than failing silently.

Making it live is a small change per tool: replace the raise with an httpx call
to /rest/api/3/search (issues.search) or POST /rest/api/3/issue (handoff.create)
and map the response onto the schema in base.py. Validation stays in safe_call.

Reads: JIRA_BASE_URL, JIRA_EMAIL, JIRA_API_TOKEN from the environment at
construction. `health()` is true only when all three are set.
"""
from __future__ import annotations

import os

from .base import Cap, Connector, ConnectorNotConfigured, HandoffArgs, HandoffReceipt, IssueSearchResult, SearchArgs, ToolSpec


class JiraConnector(Connector):
    """Serves issues.search and handoff.create once credentials are present."""
    name = "jira"
    capabilities = {Cap.ISSUES_SEARCH, Cap.HANDOFF_CREATE}

    def __init__(self) -> None:
        self.base_url = os.getenv("JIRA_BASE_URL", "")
        self.email = os.getenv("JIRA_EMAIL", "")
        self.token = os.getenv("JIRA_API_TOKEN", "")

    def health(self) -> bool:
        return bool(self.base_url and self.email and self.token)

    def _require(self) -> None:
        """Raise ConnectorNotConfigured (which safe_call reports verbatim) when credentials are missing."""
        if not self.health():
            raise ConnectorNotConfigured("set JIRA_BASE_URL, JIRA_EMAIL and JIRA_API_TOKEN")

    def tools(self) -> list[ToolSpec]:
        def search_issues(query: str) -> dict:
            self._require()
            # GET {base_url}/rest/api/3/search?jql=text~"{query}"  → map to IssueSearchResult
            raise NotImplementedError("live Jira search is out of scope for this exercise")

        def create_issue(ticket_id: str, reason: str, payload: dict) -> dict:
            self._require()
            # POST {base_url}/rest/api/3/issue with the trail as the description → HandoffReceipt
            raise NotImplementedError("live Jira issue creation is out of scope for this exercise")

        return [
            ToolSpec(Cap.ISSUES_SEARCH, "jira_search_issues", "Search Jira issues by text.", SearchArgs, IssueSearchResult, search_issues),
            ToolSpec(Cap.HANDOFF_CREATE, "jira_create_issue", "Open a Jira issue for a human to pick up.", HandoffArgs, HandoffReceipt, create_issue),
        ]
