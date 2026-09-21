"""Account and invoice lookups. Two fixtures are deliberately awkward:
ACC-9999 raises, and any unknown id is NotFound. Both are failure paths the
graph must survive.

Reads: fixtures["accounts"] and fixtures["invoices"], keyed by id.
Returns: the fixture row, which safe_call validates as AccountStatus / Invoice.
"""
from __future__ import annotations

from ..base import AccountArgs, AccountStatus, Cap, Invoice, InvoiceArgs, NotFound, ToolSpec

RAISE_MARKER = "__raise__"   # a fixture row with this value simulates a backend outage


def specs(fixtures: dict) -> list[ToolSpec]:
    """The account.lookup and invoice.lookup ToolSpecs, closed over the fixture rows."""

    def get_account_status(account_id: str) -> dict:
        row = fixtures["accounts"].get(account_id)
        if row is None:
            raise NotFound(f"account {account_id} does not exist")
        if row == RAISE_MARKER:
            raise ConnectionError("billing backend timed out")
        return row

    def lookup_invoice(invoice_id: str) -> dict:
        row = fixtures["invoices"].get(invoice_id)
        if row is None:
            raise NotFound(f"invoice {invoice_id} does not exist")
        return row

    return [
        ToolSpec(Cap.ACCOUNT_LOOKUP, "get_account_status", "Look up an account's plan, status and balance.",
                 AccountArgs, AccountStatus, get_account_status),
        ToolSpec(Cap.INVOICE_LOOKUP, "lookup_invoice", "Look up an invoice's amount, status and charge count.",
                 InvoiceArgs, Invoice, lookup_invoice),
    ]
