"""GitHub connector — SHAPE ONLY, by design. See jira.py for the reasoning.

Note for whoever picks this up: GitHub's issue search on a public repository
needs no authentication, so a live read-only version of `search_issues` is
about twenty lines with httpx. It is left out so the demo has no network
dependency, which the brief asks for.

Reads: GITHUB_REPO ("owner/name") and GITHUB_TOKEN from the environment at
construction. `health()` is true when GITHUB_REPO is set.
"""
from __future__ import annotations

import os

from .base import Cap, Connector, ConnectorNotConfigured, IssueSearchResult, SearchArgs, ToolSpec


class GitHubConnector(Connector):
    """Serves issues.search once GITHUB_REPO is set."""
    name = "github"
    capabilities = {Cap.ISSUES_SEARCH}

    def __init__(self) -> None:
        self.repo = os.getenv("GITHUB_REPO", "")        # "owner/name"
        self.token = os.getenv("GITHUB_TOKEN", "")      # optional for public repos

    def health(self) -> bool:
        return bool(self.repo)

    def tools(self) -> list[ToolSpec]:
        def search_issues(query: str) -> dict:
            if not self.health():
                raise ConnectorNotConfigured("set GITHUB_REPO (and GITHUB_TOKEN for private repos)")
            # GET https://api.github.com/search/issues?q={query}+repo:{repo}  → IssueSearchResult
            raise NotImplementedError("live GitHub search is out of scope for this exercise")

        return [ToolSpec(Cap.ISSUES_SEARCH, "github_search_issues", "Search GitHub issues by text.",
                         SearchArgs, IssueSearchResult, search_issues)]
