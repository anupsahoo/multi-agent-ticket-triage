"""Shared fixtures. Every test runs offline against the stubs, in well under a
second. Nothing here touches a network or a model.

`registry` → `make_app` → `run` build on each other: a real registry from
connectors.toml with handoff files redirected to a temp dir, a graph factory
that accepts StubClassifier overrides, and a one-call runner.
"""
from __future__ import annotations

import pytest

from triage.classifier import StubClassifier
from triage.connectors import Registry
from triage.graph import build_graph
from triage.llm import StubLLM
from triage.state import new_ticket


@pytest.fixture
def registry(tmp_path, monkeypatch):
    """The default registry (mock, jira, github) with handoff files written to a temp dir, never the repo."""
    from triage.connectors.mock import handoff
    monkeypatch.setattr(handoff, "HANDOFF_DIR", tmp_path / "handoff")
    return Registry.from_config()


@pytest.fixture
def make_app(registry):
    """Build a graph with optional classifier overrides, e.g. make_app(domain_fit=0.0)."""
    def _make(**overrides):
        return build_graph(StubClassifier(overrides or None), StubLLM(), registry)
    return _make


@pytest.fixture
def run(make_app):
    """Run one message through a fresh graph and return the final state, e.g. run(msg, resolves=0.1)."""
    def _run(message: str, **overrides):
        app = make_app(**overrides)
        return app.invoke(new_ticket("T-TEST", message))
    return _run
