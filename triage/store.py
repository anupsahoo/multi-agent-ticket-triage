"""Ticket store for the console: every ticket that has been through the graph,
with the operational metadata a support desk actually tracks (customer,
channel, priority, SLA, L2/L3 lane). Persisted through persistence.py so a
restart keeps history. Seeded on first start by running a realistic set of
messages through the real graph, so every seeded ticket has a genuine trail.

Reads: the backend's JSON document at construction; a compiled graph (`app`)
on every run. Writes: the whole document back after each run (or once after a
seed). Returns: stored tickets, which are the graph's final TicketState plus
the desk fields `enrich` adds.
"""
from __future__ import annotations

import random
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path

from langgraph.graph.state import CompiledStateGraph

from .persistence import Backend, backend_from_env
from .state import TicketState, new_ticket, new_ticket_id

STORE = Path("runs/tickets.json")

CUSTOMERS = [
    ("Priya Nair", "Northwind Logistics"), ("Tom Ashby", "Ashby & Sons"), ("Lena Fischer", "Fischer Retail"),
    ("Marcus Obi", "Obi Freight"), ("Sofia Reyes", "Reyes Pharma"), ("Daniel Kim", "Kim Robotics"),
    ("Aisha Bello", "Bello Foods"), ("Jonas Weber", "Weber Engineering"), ("Hannah Cole", "Cole Media"),
    ("Ravi Menon", "Menon Textiles"), ("Grace Liu", "Liu Analytics"), ("Omar Haddad", "Haddad Trading"),
]
CHANNELS = ["email", "chat", "portal", "phone"]
L2_ASSIGNEES = ["Priya S.", "Dan R.", "Alex M."]
L3_ASSIGNEES = ["Platform eng.", "Billing eng."]
SLA_HOURS = {"P1": 4, "P2": 8, "P3": 24, "P4": 72}

# Message templates by the path they exercise. Ids are chosen so the mock
# fixtures produce a known outcome, which keeps the seed realistic and honest.
TEMPLATES = {
    "billing_ok": [
        "I was charged twice for invoice {inv_ok}, please refund the duplicate.",
        "Invoice {inv_ok} shows as paid but I've been billed again this month.",
        "Can you check invoice {inv_ok}? The payment went through twice.",
        "Account {acc_ok} — what plan am I on and is there a balance due?",
    ],
    "technical_ok": [
        "The app crashes with an error every time I export to CSV.",
        "Login loop after password reset, keeps sending me back to sign in.",
        "Export to CSV times out on anything over a few thousand rows.",
        "Invoice page crashes on open, error every single time.",
    ],
    "general_ok": [
        "What are your support hours?",
        "How do I change my plan to a higher tier?",
        "How do I export my data?",
        "I'd like to request a feature: bulk edit for orders.",
    ],
    "misroute": [
        "Invoice {inv_ok} opens but the page crashes with an error every time.",
        "Invoice {inv_ok} is fine but the export crashes with an error.",
    ],
    "low_confidence": [
        "hello?", "asdf qwerty zxcv", "??", "Following up on the thing from before.",
    ],
    "not_found": [
        "Please refund invoice {inv_missing}, it was a mistake.",
        "Invoice {inv_missing} was charged but I never ordered anything.",
    ],
    "tool_error": [
        "My account {acc_raise} shows the wrong plan and I was billed for it.",
        "Account {acc_raise} is suspended but I've paid, please check the billing.",
    ],
    "missing_id": [
        "You billed me twice this month and I want a refund.",
        "I was charged for a subscription I cancelled, please refund.",
    ],
}
IDS = {"inv_ok": ["INV-1002", "INV-1003", "INV-1004"], "acc_ok": ["ACC-1001", "ACC-1002", "ACC-1003"],
       "inv_missing": ["INV-0000", "INV-7777", "INV-4242"], "acc_raise": ["ACC-9999"]}

# Weighting: a realistic desk auto-resolves most tickets and escalates a minority.
MIX = [("billing_ok", 22), ("technical_ok", 18), ("general_ok", 16), ("misroute", 6),
       ("low_confidence", 4), ("not_found", 5), ("tool_error", 3), ("missing_id", 6)]


def _lane(state: TicketState) -> str:
    """Which human lane an escalation lands in. Tool failures and loops are
    engineering (L3); everything that just needs a person is L2."""
    if state["status"] != "escalated":
        return "auto"
    r = (state.get("escalation_reason") or "").lower()
    if "tool failed" in r or "routing loop" in r or "hop limit" in r or "not_configured" in r:
        return "L3"
    return "L2"


def _priority(state: TicketState, rng: random.Random) -> str:
    """Engineering escalations are P1, billing escalations P2, the rest a weighted draw."""
    if state["status"] == "escalated" and _lane(state) == "L3":
        return "P1"
    if state.get("intent") == "billing" and state["status"] == "escalated":
        return "P2"
    return rng.choice(["P2", "P3", "P3", "P4"])


def enrich(state: TicketState, meta: dict) -> dict:
    """A stored ticket: the graph's final state plus desk metadata (lane, SLA
    due/breached, assignee). `meta` must carry created_at and priority."""
    lane = _lane(state)
    due = datetime.fromisoformat(meta["created_at"]) + timedelta(hours=SLA_HOURS[meta["priority"]])
    return {
        **state,
        **meta,
        "lane": lane,
        "sla_due": due.isoformat(),
        "sla_breached": state["status"] == "escalated" and due < datetime.now(timezone.utc),
        "assignee": {"auto": "Orchestrator", "L2": meta.get("assignee_l2", "L2 queue"), "L3": meta.get("assignee_l3", "L3 engineering")}[lane],
    }


class TicketStore:
    """In-memory dict of tickets by id, mirrored to a persistence backend."""

    def __init__(self, backend: Backend | None = None) -> None:
        self.backend = backend or backend_from_env(STORE)
        self.tickets: dict[str, dict] = {t["ticket_id"]: t for t in self.backend.load()}

    # ── persistence ──

    def save(self) -> None:
        """Write every ticket to the backend as one document."""
        self.backend.save(list(self.tickets.values()))

    # ── access ──

    def all(self) -> list[dict]:
        """Every ticket, newest first."""
        return sorted(self.tickets.values(), key=lambda t: t["created_at"], reverse=True)

    def get(self, tid: str) -> dict | None:
        return self.tickets.get(tid)

    def query(self, q: dict[str, str]) -> list[dict]:
        """Filter by exact field matches and a free-text term over id, message, customer and company."""
        rows = self.all()
        for key in ("status", "intent", "lane", "priority", "channel"):
            if q.get(key):
                rows = [t for t in rows if t.get(key) == q[key]]
        if q.get("q"):
            s = q["q"].lower()
            rows = [t for t in rows if any(s in str(t[f]).lower() for f in ("ticket_id", "message", "customer", "company"))]
        return rows

    # ── writes ──

    def run(self, app: CompiledStateGraph, message: str, *, customer: str | None = None, company: str | None = None,
            channel: str = "portal", priority: str | None = None, created_at: str | None = None,
            ticket_id: str | None = None, rng: random.Random | None = None, persist: bool = True) -> dict:
        """Run one message through the graph, enrich the result and store it.
        Unset desk fields are drawn from `rng` (seeded during `seed` for a
        deterministic history). `persist=False` lets the seed save once at the end."""
        rng = rng or random.Random()
        tid = ticket_id or new_ticket_id()
        t0 = time.perf_counter()
        final = app.invoke(new_ticket(tid, message))
        ms = int((time.perf_counter() - t0) * 1000)
        cust = (customer, company) if customer else rng.choice(CUSTOMERS)
        meta = {
            "customer": cust[0], "company": cust[1], "channel": channel,
            "priority": priority or _priority(final, rng),
            "created_at": created_at or datetime.now(timezone.utc).isoformat(),
            "latency_ms": ms,
            "assignee_l2": rng.choice(L2_ASSIGNEES),
            "assignee_l3": rng.choice(L3_ASSIGNEES),
        }
        t = enrich(final, meta)
        self.tickets[tid] = t
        if persist:
            self.save()
        return t

    def reprocess(self, app: CompiledStateGraph, tid: str) -> dict | None:
        """Re-run a stored ticket's message under the current settings, keeping
        its id and desk fields. None if the id is unknown."""
        old = self.tickets.get(tid)
        if not old:
            return None
        return self.run(app, old["message"], customer=old["customer"], company=old["company"],
                        channel=old["channel"], priority=old["priority"], created_at=old["created_at"], ticket_id=tid)

    # ── seed ──

    def seed(self, app: CompiledStateGraph, n: int = 80, seed: int = 7) -> int:
        """Populate an empty store by running realistic messages through the real
        graph. Deterministic, so every environment starts with the same history.
        Returns how many tickets were created (0 if the store was not empty)."""
        if self.tickets:
            return 0
        rng = random.Random(seed)
        now = datetime.now(timezone.utc)
        pool = [k for k, w in MIX for _ in range(w)]   # weighted by repetition; rng.choice then samples the mix
        for i in range(n):
            kind = rng.choice(pool)
            msg = rng.choice(TEMPLATES[kind])
            for key, opts in IDS.items():
                msg = msg.replace("{" + key + "}", rng.choice(opts))
            created = now - timedelta(days=rng.random() * 7, minutes=rng.random() * 600)
            self.run(app, msg, channel=rng.choice(CHANNELS), created_at=created.isoformat(),
                     ticket_id=f"T-{10240 + i}", rng=rng, persist=False)
        self.save()
        return n
