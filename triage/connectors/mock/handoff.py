"""Human handoff. The mock writes the whole ticket state to handoff/<id>.json,
which is the artefact a person would open. A Jira connector would create an
issue with the trail as its description; same capability, same call.

Reads: nothing. Writes: HANDOFF_DIR/<ticket_id>.json (tests point HANDOFF_DIR
at a temp dir). Returns: HandoffReceipt with the file path as the location.
"""
from __future__ import annotations

import json
from pathlib import Path

from ...persistence import writable_dir
from ..base import Cap, HandoffArgs, HandoffReceipt, ToolSpec

HANDOFF_DIR = Path("handoff")   # falls back to /tmp/handoff on a read-only filesystem


def specs() -> list[ToolSpec]:
    """The handoff.create ToolSpec."""

    def create_handoff(ticket_id: str, reason: str, payload: dict) -> dict:
        path = writable_dir(HANDOFF_DIR) / f"{ticket_id}.json"
        path.write_text(json.dumps({"ticket_id": ticket_id, "reason": reason, **payload}, indent=2))
        return HandoffReceipt(reference=f"HANDOFF-{ticket_id}", location=str(path)).model_dump()

    return [ToolSpec(Cap.HANDOFF_CREATE, "create_handoff",
                     "Hand a ticket to a human with its full history.",
                     HandoffArgs, HandoffReceipt, create_handoff)]
