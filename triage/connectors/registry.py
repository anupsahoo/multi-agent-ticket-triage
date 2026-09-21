"""Resolves a capability to the connector configured to serve it.

Reads: connectors.toml (`[capabilities]` table, capability → connector name)
in `from_config`; runtime rebinds arrive through `bind` from PUT
/api/connectors/{cap}. Returns: (connector name, ToolSpec) pairs for the
agents, and the read models the console shows (`describe`, `providers_of`,
`health`).
"""
from __future__ import annotations

import tomllib
from pathlib import Path

from .base import Cap, Connector, ToolSpec


class CapabilityUnavailable(Exception):
    """No usable connector for a capability: unbound, bound to an unregistered
    name, or bound to a connector that does not declare it. Raised at resolution
    time so a misconfiguration surfaces on the first ticket, not silently."""


class Registry:
    """Registered connectors plus the current capability → connector bindings."""

    def __init__(self) -> None:
        self._connectors: dict[str, Connector] = {}
        self._bindings: dict[str, str] = {}   # capability -> connector name

    # ── registration ──

    def register(self, connector: Connector) -> Registry:
        """Make a connector available for binding. Chainable."""
        self._connectors[connector.name] = connector
        return self

    def bind(self, capability: str, connector_name: str) -> Registry:
        """Point a capability at a registered connector name. Chainable.
        The name is not checked here; `for_capability` reports a bad one."""
        if capability not in Cap.ALL:
            raise KeyError(f"unknown capability {capability!r}; add it to Cap first")
        self._bindings[capability] = connector_name
        return self

    # ── resolution ──

    def for_capability(self, capability: str) -> tuple[str, ToolSpec]:
        """(connector name, spec) for a capability, or CapabilityUnavailable with the exact reason."""
        name = self._bindings.get(capability)
        if name is None:
            raise CapabilityUnavailable(f"no connector bound for {capability}")
        connector = self._connectors.get(name)
        if connector is None:
            raise CapabilityUnavailable(f"{capability} is bound to {name!r}, which is not registered")
        if capability not in connector.capabilities:
            raise CapabilityUnavailable(f"{name} does not declare {capability}")
        return name, connector.spec_for(capability)

    def describe(self) -> dict[str, str]:
        """A copy of the current bindings, capability → connector name."""
        return dict(self._bindings)

    def providers_of(self, capability: str) -> list[str]:
        """Every registered connector that declares this capability."""
        return [c.name for c in self._connectors.values() if capability in c.capabilities]

    def health(self, connector_name: str | None) -> bool:
        """False for an unknown name, else whatever the connector reports."""
        c = self._connectors.get(connector_name or "")
        return bool(c and c.health())

    # ── construction ──

    @classmethod
    def from_config(cls, path: str | Path = "connectors.toml") -> Registry:
        """Build the default registry: every known connector registered, bindings
        read from the toml file. Real connectors register too; they simply raise
        ConnectorNotConfigured when used without credentials."""
        from . import github, jira
        from .mock import MockConnector

        reg = cls()
        for c in (MockConnector(), jira.JiraConnector(), github.GitHubConnector()):
            reg.register(c)

        data = tomllib.loads(Path(path).read_text())
        for cap, name in data.get("capabilities", {}).items():
            reg.bind(cap, name)
        return reg
