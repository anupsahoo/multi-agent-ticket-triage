"""CLI. Four modes:

  python run.py "I was charged twice for invoice INV-1002"
  python run.py --file samples/tickets.txt
  python run.py --summary
  python run.py --eval [--record] [--floor routing=1 ...]

Reads: LLM_MODEL / TYPESAFE_API_KEY from the environment (via make_llm and
make_classifier), connectors.toml, and the message, file or labelled set given.
Writes: the trail to stdout and one line per run to runs/runs.jsonl
(triage/logging.py); --eval --record appends a scored row to samples/eval.md.
The console (server.py) has its own store and does not go through this file.
"""
from __future__ import annotations

import argparse
import os
import sys
import time
from datetime import date
from pathlib import Path

from langgraph.graph.state import CompiledStateGraph

from triage.classifier import make_classifier
from triage.connectors import Registry
from triage.eval import EVAL_LOG, LABELLED, check_floor, evaluate, format_report, format_row, load_labelled, set_id
from triage.graph import build_graph
from triage.llm import make_llm
from triage.logging import record, summarise
from triage.state import new_ticket, new_ticket_id

RULE = "═" * 78
THIN = "─" * 78


def run_one(app: CompiledStateGraph, message: str, ticket_id: str | None = None) -> dict:
    """Run one message, log it, print the trail and outcome; returns the final state."""
    tid = ticket_id or new_ticket_id()
    t0 = time.perf_counter()
    final = app.invoke(new_ticket(tid, message))
    ms = int((time.perf_counter() - t0) * 1000)
    record(final, ms)

    print(f"\n{RULE}\nTICKET {tid}\n  {message}\n{THIN}")
    for line in final["trail"]:
        print(f"  · {line}")
    print(THIN)
    status = final["status"].upper()
    if final["status"] == "resolved":
        print(f"  {status}: {final['resolution']}")
    else:
        print(f"  {status}: {final['escalation_reason']}  → {final.get('handoff_ref')}")
    print(f"  route={' → '.join(final['route_history']) or 'router only'}  "
          f"tools={[t['name'] for t in final['tool_calls']]}  {ms} ms")
    return final


def run_eval(app: CompiledStateGraph, source: str, path: Path, record: bool, floors: dict[str, float]) -> int:
    """Score the configured model on the labelled set; exit 1 if any floor is breached."""
    result = evaluate(app, load_labelled(path))
    print(format_report(result))
    row = format_row(result, date=date.today().isoformat(), set_id=set_id(path),
                     model=os.getenv("LLM_MODEL") or "stub", decisions=source)
    print(f"\n{row}")
    if record:
        with EVAL_LOG.open("a") as f:
            f.write(row + "\n")
        print(f"recorded → {EVAL_LOG}")
    breaches = check_floor(result, floors)
    for b in breaches:
        print(f"FLOOR BREACHED: {b}")
    return 1 if breaches else 0


def _floor(spec: str) -> tuple[str, float]:
    """Parse one --floor metric=value argument."""
    metric, _, value = spec.partition("=")
    return metric, float(value)


def main(argv: list[str]) -> int:
    """Parse the mode, build the engine once, run. Exit 1 only when given nothing to do or a floor is breached."""
    p = argparse.ArgumentParser()
    p.add_argument("message", nargs="?")
    p.add_argument("--file", help="one ticket per line; blank lines and # comments are skipped")
    p.add_argument("--summary", action="store_true", help="summarise runs/runs.jsonl and exit")
    p.add_argument("--eval", nargs="?", const=str(LABELLED), metavar="LABELLED",
                   help="score the configured model on a labelled set (default samples/labelled.jsonl)")
    p.add_argument("--record", action="store_true", help="with --eval: append the row to samples/eval.md")
    p.add_argument("--floor", action="append", default=[], metavar="METRIC=VALUE",
                   help="with --eval: exit 1 if a step accuracy or system is below VALUE, or confident_wrong above it")
    a = p.parse_args(argv)

    if a.summary:
        print(summarise())
        return 0

    llm, chat_model, provider = make_llm()
    classifier, source = make_classifier(chat_model)
    registry = Registry.from_config()
    app = build_graph(classifier, llm, registry)
    print(f"decisions: {source} · language: {provider} · connectors: {registry.describe()}")

    if a.eval:
        return run_eval(app, source, Path(a.eval), a.record, dict(_floor(f) for f in a.floor))
    if a.file:
        lines = Path(a.file).read_text().splitlines()
        tickets = [line.strip() for line in lines if line.strip() and not line.startswith("#")]
        for i, line in enumerate(tickets, 1):
            run_one(app, line, f"T-{i:03d}")
        return 0
    if a.message:
        run_one(app, a.message)
        return 0
    p.print_help()
    return 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
