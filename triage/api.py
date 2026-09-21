"""The engine's HTTP surface, independent of any server framework.

`dispatch()` takes a method, path, query and JSON body and returns a status and
a JSON-serialisable payload. Two thin adapters call it:

  server.py      a local standard-library server, for development
  api/index.py   a Vercel serverless function, for the deployed console

Keeping the routing here means there is exactly one place that knows what the
API does, and both adapters are a dozen lines.

Reads: the process-wide `Engine` (built once, lazily, by `engine()`): the
compiled graph, the registry, the ticket store, and config.py for settings.
Writes: tickets into the store (POST), bindings into the registry and values
into config (PUT). Returns: (HTTP status, payload) — never raises to the adapter
for a bad request; those come back as 400/404 payloads.

Endpoints
  GET  /api/meta                    engine configuration: decision source, language provider, thresholds, agents, connectors
  GET  /api/tickets                 list, filterable by status, intent, lane, priority, channel, q
  GET  /api/tickets/{id}            one ticket with its full trail
  POST /api/tickets                 {message, customer?, company?, channel?, priority?} — runs the graph
  POST /api/tickets/{id}/reprocess  runs the same message again, under the current settings
  GET  /api/stats                   aggregates for the command centre and analytics
  GET  /api/connectors              capability → connector bindings, with health
  PUT  /api/connectors/{cap}        {connector} — rebinds at runtime
  GET  /api/settings                the four thresholds
  PUT  /api/settings                partial update of the thresholds
"""
from __future__ import annotations

from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone
from functools import lru_cache

from . import config
from .agents.billing import BILLING
from .agents.general import GENERAL
from .agents.technical import TECHNICAL
from .classifier import make_classifier
from .connectors import Cap, Registry
from .graph import build_graph
from .llm import make_llm
from .store import TicketStore

Response = tuple[int, object]

# API key → config attribute. One table drives both GET and PUT /api/settings.
SETTINGS = {
    "intent_confidence_min": "INTENT_CONFIDENCE_MIN",
    "domain_min": "DOMAIN_MIN",
    "resolution_min": "RESOLUTION_MIN",
    "max_hops": "MAX_HOPS",
}

SERIES_DAYS = 7   # the command centre's daily chart covers the last week


class Engine:
    """Everything a request needs, built once per process: the language layer
    and classifier chosen from the environment, the registry from
    connectors.toml, the compiled graph, and the ticket store (seeded on an
    empty backend)."""

    def __init__(self) -> None:
        self.llm, chat_model, self.language = make_llm()
        self.classifier, self.decisions = make_classifier(chat_model)
        self.registry = Registry.from_config()
        self.app = build_graph(self.classifier, self.llm, self.registry)
        self.store = TicketStore()
        self.seeded = self.store.seed(self.app)

    # ── read models ──

    def agents(self) -> list[dict]:
        """The agent roster the console draws, with each specialist's capabilities and mode."""
        return [
            {"id": "router", "name": "Router", "kind": "orchestration", "capabilities": [],
             "role": "Classifies intent and routes; honours specialist handoffs", "decision": self.decisions},
            {"id": "billing", "name": "Billing specialist", "kind": "specialist", "capabilities": BILLING.capabilities,
             "role": "Invoices, charges, refunds, plans", "mode": BILLING.mode},
            {"id": "technical", "name": "Technical specialist", "kind": "specialist", "capabilities": TECHNICAL.capabilities,
             "role": "Bugs, crashes, known issues", "mode": TECHNICAL.mode},
            {"id": "general", "name": "General specialist", "kind": "specialist", "capabilities": GENERAL.capabilities,
             "role": "How-to, account questions, feature requests", "mode": GENERAL.mode},
            {"id": "escalation", "name": "Human handoff", "kind": "handoff", "capabilities": [Cap.HANDOFF_CREATE],
             "role": "Packages the trail and hands to L2 or L3"},
        ]

    @staticmethod
    def settings() -> dict:
        """The current thresholds, read live from config so runtime updates show."""
        return {key: getattr(config, attr) for key, attr in SETTINGS.items()}

    def connectors(self) -> list[dict]:
        """Per capability: the bound connector, its health, and the alternatives that could serve it."""
        bound = self.registry.describe()
        return [{
            "capability": cap,
            "connector": bound.get(cap),
            "healthy": self.registry.health(bound.get(cap)),
            "options": self.registry.providers_of(cap),
        } for cap in Cap.ALL]

    def stats(self) -> dict:
        """Aggregates over every stored ticket for the command centre and analytics views."""
        ts = self.store.all()
        now = datetime.now(timezone.utc)
        by_status = Counter(t["status"] for t in ts)
        by_lane = Counter(t["lane"] for t in ts)

        reasons: Counter = Counter()
        for t in ts:
            if t["status"] == "escalated":
                reasons[_reason_bucket(t.get("escalation_reason") or "")] += 1

        days = [(now - timedelta(days=i)).date() for i in range(SERIES_DAYS - 1, -1, -1)]
        series = []
        for d in days:
            rows = [t for t in ts if datetime.fromisoformat(t["created_at"]).date() == d]
            series.append({"day": d.strftime("%a"), "date": d.isoformat(), "total": len(rows),
                           "resolved": sum(t["status"] == "resolved" for t in rows),
                           "escalated": sum(t["status"] == "escalated" for t in rows)})

        tool_ok: dict[str, list[int]] = defaultdict(lambda: [0, 0])   # name -> [ok, failed]
        for t in ts:
            for c in t["tool_calls"]:
                tool_ok[c["name"]][0 if c["ok"] else 1] += 1
        latencies = [t["latency_ms"] for t in ts]

        return {
            "total": len(ts),
            "resolved": by_status.get("resolved", 0),
            "escalated": by_status.get("escalated", 0),
            "auto_resolution_rate": round(100 * by_status.get("resolved", 0) / max(1, len(ts))),
            "open_l2": by_lane.get("L2", 0),
            "open_l3": by_lane.get("L3", 0),
            "sla_breached": sum(bool(t.get("sla_breached")) for t in ts),
            "mean_latency_ms": sum(latencies) // max(1, len(latencies)),
            "by_intent": dict(Counter(t["intent"] for t in ts)),
            "by_channel": dict(Counter(t["channel"] for t in ts)),
            "by_lane": dict(by_lane),
            "escalation_reasons": dict(reasons),
            "series": series,
            "tools": [{"name": k, "calls": v[0] + v[1], "ok": v[0], "failed": v[1]}
                      for k, v in sorted(tool_ok.items(), key=lambda kv: -(kv[1][0] + kv[1][1]))],
            "agent_load": dict(Counter(a for t in ts for a in t["route_history"])),
            "misroutes": sum(len(t["route_history"]) > 1 for t in ts),
        }

    # ── writes ──

    def update_settings(self, body: dict) -> dict:
        """Partial update; each value is coerced to the type of the constant it replaces (int for max_hops)."""
        for key, attr in SETTINGS.items():
            if key in body:
                setattr(config, attr, type(getattr(config, attr))(body[key]))
        return self.settings()


@lru_cache(maxsize=1)
def engine() -> Engine:
    """The process-wide Engine, built on first request."""
    return Engine()


def dispatch(method: str, path: str, query: dict[str, str], body: dict) -> Response:
    """Route one request. Paths are matched after stripping a trailing slash."""
    e = engine()
    p = path.rstrip("/")
    parts = p.split("/")   # "/api/tickets/T-1" -> ["", "api", "tickets", "T-1"]

    if method == "GET":
        if p == "/api/meta":
            return 200, {"decisions": e.decisions, "language": e.language, "settings": e.settings(),
                         "agents": e.agents(), "connectors": e.connectors(), "seeded": e.seeded}
        if p == "/api/tickets":
            return 200, e.store.query(query)
        if p.startswith("/api/tickets/") and len(parts) == 4:
            t = e.store.get(parts[3])
            return (200, t) if t else (404, {"error": "not found"})
        if p == "/api/stats":
            return 200, e.stats()
        if p == "/api/connectors":
            return 200, e.connectors()
        if p == "/api/settings":
            return 200, e.settings()

    if method == "POST":
        if p == "/api/tickets":
            message = (body.get("message") or "").strip()
            if not message:
                return 400, {"error": "message required"}
            t = e.store.run(e.app, message, customer=body.get("customer"), company=body.get("company"),
                            channel=body.get("channel", "portal"), priority=body.get("priority"))
            return 201, t
        if p.startswith("/api/tickets/") and p.endswith("/reprocess"):
            t = e.store.reprocess(e.app, parts[3])
            return (200, t) if t else (404, {"error": "not found"})

    if method == "PUT":
        if p.startswith("/api/connectors/"):
            try:
                e.registry.bind(p.split("/", 3)[3], body.get("connector"))
            except KeyError as err:
                return 400, {"error": str(err)}
            return 200, e.connectors()
        if p == "/api/settings":
            return 200, e.update_settings(body)

    return 404, {"error": "not found"}


# ── private helpers ──

def _reason_bucket(reason: str) -> str:
    """Collapse free-text escalation reasons into the handful of causes the desk tracks.
    Order matters: the phrases are checked most-specific first."""
    r = reason.lower()
    if "tool failed" in r:
        return "tool error"
    if "found nothing" in r:
        return "not found"
    if "confidence" in r:
        return "low confidence"
    if "needs" in r:
        return "missing info"
    if "loop" in r or "hop" in r:
        return "routing loop"
    if "resolve" in r:
        return "weak draft"
    return "other"
