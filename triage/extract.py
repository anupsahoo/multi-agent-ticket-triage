"""Pulls identifiers and a search query out of a ticket's text.

Shared by the direct-mode specialists (agents/billing.py, agents/general.py),
which build tool arguments without a model, and by the offline `StubLLM`
(llm.py), which imitates a model choosing a tool. One place, so what counts as
an invoice id is the same everywhere.

Reads: the raw ticket message.
Returns: an upper-cased id or a query string, or None when nothing usable is
present. The `extract_*` functions wrap those as tool-argument dicts.
"""
from __future__ import annotations

import re

INVOICE_ID = re.compile(r"\bINV-\d+\b", re.I)
ACCOUNT_ID = re.compile(r"\bACC-\d+\b", re.I)
WORD = re.compile(r"[a-z0-9]+")

MIN_WORD_LEN = 3      # one- and two-letter words ("I", "to", "my") carry no search signal
MIN_QUERY_WORDS = 2   # fewer than this and a keyword search is a coin toss


def words(text: str) -> list[str]:
    """Lower-cased alphanumeric tokens, in order. Also the tokeniser the stub classifier uses."""
    return WORD.findall(text.lower())


def invoice_id(message: str) -> str | None:
    """"INV-1002" from anywhere in the message, upper-cased, or None."""
    m = INVOICE_ID.search(message)
    return m.group(0).upper() if m else None


def account_id(message: str) -> str | None:
    """"ACC-1001" from anywhere in the message, upper-cased, or None."""
    m = ACCOUNT_ID.search(message)
    return m.group(0).upper() if m else None


def query(message: str) -> str | None:
    """The message reduced to its search-worthy words, or None if too few remain."""
    kept = [w for w in words(message) if len(w) >= MIN_WORD_LEN]
    return " ".join(kept) if len(kept) >= MIN_QUERY_WORDS else None


def extract_billing(message: str) -> dict | None:
    """Args for invoice.lookup or account.lookup, invoice first. None means the
    billing specialist has nothing to look up and must ask a human for an id."""
    inv = invoice_id(message)
    if inv:
        return {"invoice_id": inv}
    acc = account_id(message)
    if acc:
        return {"account_id": acc}
    return None


def extract_query(message: str) -> dict | None:
    """Args for kb.search, or None when the message is too short to search on."""
    q = query(message)
    return {"query": q} if q else None
