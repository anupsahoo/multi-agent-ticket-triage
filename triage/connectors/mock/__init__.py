"""The mock connector: one connector, named "mock", serving every capability from
a fixture file. Split across modules by domain so each is small enough to read.

Reads: fixtures.json next to this file, once at import. Each domain module
exposes `specs(fixtures)` returning its ToolSpecs; this class concatenates them.
"""
from __future__ import annotations

import json
from pathlib import Path

from ..base import Cap, Connector, ToolSpec
from . import billing, handoff, issues, kb

FIXTURES = json.loads((Path(__file__).parent / "fixtures.json").read_text())


class MockConnector(Connector):
    """Serves all of Cap.ALL from FIXTURES; always healthy."""
    name = "mock"
    capabilities = set(Cap.ALL)

    def tools(self) -> list[ToolSpec]:
        return [
            *billing.specs(FIXTURES),
            *issues.specs(FIXTURES),
            *kb.specs(FIXTURES),
            *handoff.specs(),
        ]
