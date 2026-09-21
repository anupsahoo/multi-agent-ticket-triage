"""Connectors: the seam between agents and the systems they act on.

Agents ask the registry for a *capability* ("issues.search") and never name a
connector. Mock connectors ship with the repo; real ones drop in behind the same
interface. See README.md in this folder for how to add one.

  base.py       Cap names, result/argument schemas, ToolSpec, the Connector ABC
  registry.py   capability → connector resolution, loaded from connectors.toml
  safe_call.py  the validation boundary every tool call crosses
  mock/         the "mock" connector, serving every capability from fixtures.json
  jira.py, github.py   shape-only real connectors; raise until configured
"""
from .base import Cap, Connector, ConnectorNotConfigured, NotFound, ToolSpec
from .registry import Registry
from .safe_call import safe_call

__all__ = ["Cap", "Connector", "ConnectorNotConfigured", "NotFound", "ToolSpec", "Registry", "safe_call"]
