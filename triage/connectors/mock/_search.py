"""Keyword ranking shared by the two mock search tools (issues.py, kb.py).

Reads: a set of query words and fixture rows that each carry a `keywords` list.
Returns: the rows with at least `min_hits` keywords present, best first, with
`keywords` removed so each row can be passed straight to its result model.
"""
from __future__ import annotations


def rank(words: set[str], rows: list[dict], min_hits: int) -> list[dict]:
    """Stable sort by keyword overlap, descending; ties keep fixture order."""
    scored = [(row, len(words & set(row["keywords"]))) for row in rows]
    return [{k: v for k, v in row.items() if k != "keywords"}
            for row, hits in sorted(scored, key=lambda t: -t[1]) if hits >= min_hits]
