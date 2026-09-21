"""Known-issue search. Stands in for Jira or GitHub issues; the real shapes in
../jira.py and ../github.py serve the same capability.

Reads: fixtures["known_issues"]. Returns: IssueSearchResult with the issues
that share at least two keywords with the query, best match first.
"""
from __future__ import annotations

from ..base import Cap, IssueSearchResult, KnownIssue, SearchArgs, ToolSpec
from ._search import rank

MIN_HITS = 2   # one shared word ("error") is too weak to call something a known issue


def specs(fixtures: dict) -> list[ToolSpec]:
    """The issues.search ToolSpec, closed over the fixture rows."""

    def check_known_issue(query: str) -> dict:
        words = set(query.lower().replace(",", " ").split())
        matches = [KnownIssue(**row) for row in rank(words, fixtures["known_issues"], MIN_HITS)]
        return IssueSearchResult(query=query, matches=matches).model_dump()

    return [ToolSpec(Cap.ISSUES_SEARCH, "check_known_issue",
                     "Search known issues by keywords; returns matches with status and workaround.",
                     SearchArgs, IssueSearchResult, check_known_issue)]
