"""One JSON line per CLI run, and a summary over them. This is the eval hook.

Reads: the final TicketState and the run's latency (from run.py); the
runs.jsonl file for `summarise`. Writes: one appended line per run to
runs/runs.jsonl. The console's ticket store (store.py) keeps its own richer
record; this file is the flat log an offline evaluation script would consume.
"""
from __future__ import annotations

import json
from collections import Counter
from dataclasses import asdict, dataclass
from pathlib import Path

from .state import TicketState

RUNS = Path("runs/runs.jsonl")


@dataclass
class RunRecord:
    """The flattened outcome of one run: what was decided, what was called, how it ended, how long it took."""
    ticket_id: str
    intent: str
    confidence: float
    intent_source: str
    route_history: list[str]
    tools_called: list[dict]
    status: str
    escalation_reason: str | None
    latency_ms: int


def to_record(state: TicketState, latency_ms: int) -> RunRecord:
    """Project a final state onto a RunRecord; tool calls keep only name, connector and outcome."""
    return RunRecord(
        ticket_id=state["ticket_id"],
        intent=state.get("intent", "unknown"),
        confidence=round(state.get("confidence", 0.0), 3),
        intent_source=state.get("intent_source", ""),
        route_history=state.get("route_history", []),
        tools_called=[{"name": t["name"], "connector": t["connector"], "ok": t["ok"], "error": t["error"]}
                      for t in state.get("tool_calls", [])],
        status=state.get("status", "open"),
        escalation_reason=state.get("escalation_reason"),
        latency_ms=latency_ms,
    )


def record(state: TicketState, latency_ms: int, path: Path = RUNS) -> RunRecord:
    """Append one JSON line for this run and return the record written."""
    rec = to_record(state, latency_ms)
    path.parent.mkdir(exist_ok=True)
    with path.open("a") as f:
        f.write(json.dumps(asdict(rec)) + "\n")
    return rec


def summarise(path: Path = RUNS) -> str:
    """Counts by status, intent and tool, plus latency, over every recorded run."""
    if not path.exists():
        return "no runs recorded yet"
    rows = [json.loads(line) for line in path.read_text().splitlines() if line.strip()]
    by_status = Counter(r["status"] for r in rows)
    by_intent = Counter(r["intent"] for r in rows)
    lat = [r["latency_ms"] for r in rows]
    tools = Counter(t["name"] for r in rows for t in r["tools_called"])
    lines = [f"runs: {len(rows)}",
             "status: " + ", ".join(f"{k} {v}" for k, v in by_status.items()),
             "intent: " + ", ".join(f"{k} {v}" for k, v in by_intent.items()),
             "tools:  " + ", ".join(f"{k} {v}" for k, v in tools.items()),
             f"latency ms: mean {sum(lat)//max(1,len(lat))}, max {max(lat) if lat else 0}"]
    return "\n".join(lines)
