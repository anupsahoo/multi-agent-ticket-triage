"""Copy this file to add a connector. Five steps; the sixth is a test.

1. Rename the class and set `name` (this is what connectors.toml refers to).
2. Declare `capabilities` from `Cap`. Only declare what you implement.
3. Write one function per capability. Take the args from the matching args
   schema in base.py, return a dict or model matching the result schema.
   Raise NotFound when the thing does not exist; let real errors raise.
4. Return a ToolSpec per capability from `tools()`.
5. Bind it in connectors.toml:   "issues.search" = "acme"
6. Run:  pytest tests/test_connectors.py   (there is a test that plugs in a
   throwaway connector and proves an agent picks it up — copy it for yours)

This file is not registered anywhere; it exists only to be copied.
"""
from __future__ import annotations

from .base import Cap, Connector, IssueSearchResult, NotFound, SearchArgs, ToolSpec


class AcmeConnector(Connector):
    """Example: serves issues.search and nothing else."""
    name = "acme"
    capabilities = {Cap.ISSUES_SEARCH}

    def tools(self) -> list[ToolSpec]:
        def search(query: str) -> dict:
            # call your system here
            if not query:
                raise NotFound("nothing matched")
            return IssueSearchResult(query=query, matches=[]).model_dump()

        return [ToolSpec(Cap.ISSUES_SEARCH, "acme_search", "Search Acme for known issues.",
                         SearchArgs, IssueSearchResult, search)]
