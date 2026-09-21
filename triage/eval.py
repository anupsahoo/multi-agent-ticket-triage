"""Score the whole chain on a fixed labelled set, one configured model at a time.

A ticket passes through four decisions — intent, tool, arguments, outcome — and
a review that signs them off one at a time never sees the number that matters:
their product. Five steps at 85% each is a 44% system. This module scores each
step on `samples/labelled.jsonl`, multiplies them, and separately counts the
failure that logs itself as success: a ticket that resolved when it should
have escalated, or resolved under the wrong intent.

Reads: the labelled cases (message + expected intent / tool / args / status)
and a compiled graph. Writes: nothing; `run.py --eval` prints the report and,
with --record, appends the summary row to samples/eval.md. `check_floor` is
what CI calls so the deterministic stub baseline is a regression gate.
"""
from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass, field
from pathlib import Path
from statistics import quantiles
from time import perf_counter

from langgraph.graph.state import CompiledStateGraph

from .state import TicketState, new_ticket

LABELLED = Path("samples/labelled.jsonl")
EVAL_LOG = Path("samples/eval.md")
HANDOFF_TOOL = "create_handoff"   # the escalation's own call; never counts as a specialist's tool choice
STEPS = ("routing", "tool_choice", "arguments", "outcome")


@dataclass
class CaseResult:
    """Expected versus actual for one ticket, one flag per step."""
    id: str
    expected: dict
    intent: str
    tools: list[str]
    status: str
    latency_ms: int
    routing: bool
    tool_choice: bool
    arguments: bool
    outcome: bool
    confident_wrong: bool


@dataclass
class EvalResult:
    """Per-step accuracies, their product, and the counts a reviewer asks about first."""
    cases: list[CaseResult] = field(default_factory=list)

    @property
    def n(self) -> int:
        return len(self.cases)

    def accuracy(self, step: str) -> float:
        return round(sum(getattr(c, step) for c in self.cases) / max(1, self.n), 3)

    @property
    def system(self) -> float:
        """The multiplied number: what a ticket's chance of passing every step is."""
        out = 1.0
        for step in STEPS:
            out *= self.accuracy(step)
        return round(out, 3)

    @property
    def confident_wrong(self) -> list[str]:
        return [c.id for c in self.cases if c.confident_wrong]

    @property
    def escalation_rate(self) -> float:
        return round(sum(c.status == "escalated" for c in self.cases) / max(1, self.n), 3)

    @property
    def latency_p95_ms(self) -> int:
        ms = sorted(c.latency_ms for c in self.cases)
        if len(ms) < 2:
            return ms[0] if ms else 0
        return int(quantiles(ms, n=20)[-1])   # 95th percentile, not the mean: slow tails are what people feel


# ── labelled set ──

def load_labelled(path: Path = LABELLED) -> list[dict]:
    """One case per line; blank lines are skipped."""
    return [json.loads(line) for line in path.read_text().splitlines() if line.strip()]


def set_id(path: Path = LABELLED) -> str:
    """Eight hex characters of the file's SHA-256, so every row says which labelled set it was scored on."""
    return hashlib.sha256(path.read_bytes()).hexdigest()[:8]


# ── scoring ──

def _args_match(expected: dict | None, actual: dict) -> bool:
    """Every expected key is present; "*" accepts any non-empty value, anything else must be equal."""
    if not expected:
        return True
    return all(k in actual and (bool(actual[k]) if v == "*" else actual[k] == v) for k, v in expected.items())


def score_case(case: dict, final: TicketState, latency_ms: int) -> CaseResult:
    """Apply the four step checks to one final state."""
    specialist_calls = [t for t in final["tool_calls"] if t["name"] != HANDOFF_TOOL]
    names = [t["name"] for t in specialist_calls]
    expected_tool = case.get("tool")

    routing = case.get("intent") is None or final.get("intent") == case["intent"]
    tool_choice = (not names) if expected_tool is None else expected_tool in names
    if expected_tool is None:
        arguments = tool_choice
    else:
        matching = [t for t in specialist_calls if t["name"] == expected_tool]
        arguments = bool(matching) and _args_match(case.get("args"), matching[0]["args"])
    outcome = final["status"] == case["status"]
    confident_wrong = final["status"] == "resolved" and (case["status"] != "resolved" or not routing)

    return CaseResult(
        id=case["id"], expected=case, intent=final.get("intent", ""), tools=[t["name"] for t in final["tool_calls"]],
        status=final["status"], latency_ms=latency_ms,
        routing=routing, tool_choice=tool_choice, arguments=arguments, outcome=outcome, confident_wrong=confident_wrong,
    )


def evaluate(app: CompiledStateGraph, cases: list[dict]) -> EvalResult:
    """Run every case through the graph and score it."""
    result = EvalResult()
    for case in cases:
        t0 = perf_counter()
        final = app.invoke(new_ticket(case["id"], case["message"]))
        result.cases.append(score_case(case, final, int((perf_counter() - t0) * 1000)))
    return result


def check_floor(result: EvalResult, floors: dict[str, float]) -> list[str]:
    """Names every metric below its floor (confident_wrong is a ceiling); an empty list is a pass."""
    breaches = []
    for metric, floor in floors.items():
        if metric == "confident_wrong":
            if len(result.confident_wrong) > floor:
                breaches.append(f"confident_wrong={len(result.confident_wrong)} > {floor:g}")
        else:
            value = result.system if metric == "system" else result.accuracy(metric)
            if value < floor:
                breaches.append(f"{metric}={value} < {floor:g}")
    return breaches


# ── reporting ──

def format_report(result: EvalResult) -> str:
    """Per-case table for the terminal, confident-wrong cases marked with !!."""
    lines = [f"{'case':<7}{'intent':<24}{'tools':<44}{'status':<22}{'route tool args outc':<22}ms"]
    for c in result.cases:
        exp = c.expected
        intent = f"{c.intent}/{exp.get('intent') or '*'}"
        tools = ",".join(c.tools) or "-"
        status = f"{c.status}/{exp['status']}" + ("  !!" if c.confident_wrong else "")
        steps = "  ".join("✓" if getattr(c, s) else "✗" for s in STEPS)
        lines.append(f"{c.id:<7}{intent:<24}{tools[:42]:<44}{status:<22}{steps:<22}{c.latency_ms}")
    best = max(result.accuracy(s) for s in STEPS)
    lines += [
        "",
        f"routing {result.accuracy('routing'):.2f} · tool {result.accuracy('tool_choice'):.2f} · "
        f"args {result.accuracy('arguments'):.2f} · outcome {result.accuracy('outcome'):.2f}",
        f"system (product) {result.system:.2f} vs best step {best:.2f}",
        f"confident-wrong {len(result.confident_wrong)} {result.confident_wrong or ''}".rstrip(),
        f"escalations {result.escalation_rate:.2f} · p95 latency {result.latency_p95_ms} ms · n={result.n}",
    ]
    return "\n".join(lines)


def format_row(result: EvalResult, *, date: str, set_id: str, model: str, decisions: str) -> str:
    """One Markdown table row for samples/eval.md."""
    return (f"| {date} | `{set_id}` | `{model}` | {decisions} | {result.accuracy('routing'):.2f} | "
            f"{result.accuracy('tool_choice'):.2f} | {result.accuracy('arguments'):.2f} | {result.accuracy('outcome'):.2f} | "
            f"**{result.system:.2f}** | {len(result.confident_wrong)} | {result.escalation_rate:.2f} | {result.latency_p95_ms} |")
