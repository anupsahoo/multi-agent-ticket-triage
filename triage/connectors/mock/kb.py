"""FAQ / knowledge-base search over the fixture file.

Reads: fixtures["kb"]. Returns: KBSearchResult with every article sharing at
least one keyword with the query, best match first.
"""
from __future__ import annotations

from ..base import Cap, KBArticle, KBSearchResult, SearchArgs, ToolSpec
from ._search import rank

MIN_HITS = 1   # FAQs are short; a single matching word ("hours") is usually the right article


def specs(fixtures: dict) -> list[ToolSpec]:
    """The kb.search ToolSpec, closed over the fixture rows."""

    def search_kb(query: str) -> dict:
        words = set(query.lower().replace("?", " ").replace(",", " ").split())
        matches = [KBArticle(**row) for row in rank(words, fixtures["kb"], MIN_HITS)]
        return KBSearchResult(query=query, matches=matches).model_dump()

    return [ToolSpec(Cap.KB_SEARCH, "search_kb", "Search help articles by keywords.",
                     SearchArgs, KBSearchResult, search_kb)]
