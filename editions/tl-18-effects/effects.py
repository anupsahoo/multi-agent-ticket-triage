"""The Trust Layer, edition 18: My Agent Did Nothing and Scored 100%.

Four agents answer the same 12 support tickets. One does the work. One copies a
perfect reply and does nothing. One prepares refunds and never submits them. One
pays every refund twice. Two scorers grade them: a reply rubric that reads only
the words, and an effect scorer that reads only the database.

Standard library only. Deterministic. Run:  python3 effects.py
"""
from __future__ import annotations

import csv
import re
import sys
from pathlib import Path

HERE = Path(__file__).parent
INVOICES = {"INV-1002": 120, "INV-1003": 80, "INV-1004": 95, "INV-2001": 60, "INV-2002": 45, "INV-2003": 150}

# 1. The tickets: what was asked, and what must be true in the database after ---
TICKETS = [
    ("T01", "Charged twice for INV-1002", "refund", "INV-1002"),
    ("T02", "Cancelled order, refund INV-1003", "refund", "INV-1003"),
    ("T03", "Duplicate payment on INV-1004", "refund", "INV-1004"),
    ("T04", "Refund INV-2001 please", "refund", "INV-2001"),
    ("T05", "Charged twice for INV-2002", "refund", "INV-2002"),
    ("T06", "Refund INV-2003, wrong item", "refund", "INV-2003"),
    ("T07", "Your app deleted my data", "escalate", "L3"),
    ("T08", "I want to speak to a manager", "escalate", "L2"),
    ("T09", "Legal notice about my account", "escalate", "L2"),
    ("T10", "What are your support hours?", "info", "hours"),
    ("T11", "Do you export to Excel?", "info", "export"),
    ("T12", "Where is my tracking number?", "info", "tracking"),
]


def checkpoints(t) -> list[tuple]:
    """A checkpoint is a row that must exist, or a count of rows this ticket may write."""
    tid, _, kind, target = t
    if kind == "refund":
        return [("row", "refunds", {"ticket": tid, "invoice": target, "amount": INVOICES[target], "status": "issued"}),
                ("count", "refunds", tid, 1), ("count", "handoffs", tid, 0)]
    if kind == "escalate":
        return [("row", "handoffs", {"ticket": tid, "queue": target}),
                ("count", "handoffs", tid, 1), ("count", "refunds", tid, 0)]
    return [("count", "refunds", tid, 0), ("count", "handoffs", tid, 0)]


# 2. The system the agent changes: a tiny database and three tools --------------
class Store:
    def __init__(self):
        self.refunds, self.handoffs = [], []

    def draft_refund(self, ticket, invoice):              # step 1: prepare
        row = {"ticket": ticket, "invoice": invoice, "amount": INVOICES[invoice], "status": "draft"}
        self.refunds.append(row)
        return row

    def submit_refund(self, row):                          # step 2: actually pay
        row["status"] = "issued"

    def open_handoff(self, ticket, queue):
        self.handoffs.append({"ticket": ticket, "queue": queue})


# 3. Four agents, each writing its own reply ------------------------------------
def reply_for(t) -> str:
    tid, _, kind, target = t
    return {"refund": f"Your refund for {target} has been issued and will reach you in 3 to 5 working days.",
            "escalate": f"I have passed this to our {target} team, who will contact you within one working day.",
            "info": f"Thanks for asking, the answer about {target} is on our help page."}[kind]


def real_agent(t, db: Store) -> str:
    if t[2] == "refund":
        db.submit_refund(db.draft_refund(t[0], t[3]))
    elif t[2] == "escalate":
        db.open_handoff(t[0], t[3])
    return reply_for(t)


def replay_agent(t, db: Store) -> str:
    return reply_for(t)                                     # perfect words, no work


def buggy_agent(t, db: Store) -> str:
    if t[2] == "refund":
        db.draft_refund(t[0], t[3])                         # BUG: never calls submit_refund
        return f"Done! I issued the refund on {t[3]}, you should see it in 3 to 5 working days."
    if t[2] == "escalate":
        db.open_handoff(t[0], t[3])
    return reply_for(t)


def double_agent(t, db: Store) -> str:
    if t[2] == "refund":
        for _ in range(2):                                  # BUG: retries a payment that already succeeded
            db.submit_refund(db.draft_refund(t[0], t[3]))
    elif t[2] == "escalate":
        db.open_handoff(t[0], t[3])
    return reply_for(t)


AGENTS = {"real": real_agent, "replay": replay_agent, "buggy": buggy_agent, "double": double_agent}


# 4. Two scorers -----------------------------------------------------------------
def text_score(t, reply: str) -> bool:
    """A reply rubric of the kind most teams write: does the reply say the right thing?"""
    tid, _, kind, target = t
    r = reply.lower()
    if kind == "refund":
        return target.lower() in r and "refund" in r and re.search(r"issued|on its way", r) is not None
    if kind == "escalate":
        return target.lower() in r and re.search(r"passed|escalat", r) is not None
    return target in r


def effect_score(t, db: Store) -> tuple[bool, str]:
    """Never reads the reply. Every checkpoint is checked against the database."""
    for c in checkpoints(t):
        if c[0] == "row":
            _, table, spec = c
            if not any(all(r.get(k) == v for k, v in spec.items()) for r in getattr(db, table)):
                return False, f"missing {table} row {spec}"
        else:
            _, table, tid, n = c
            found = sum(r["ticket"] == tid for r in getattr(db, table))
            if found != n:
                return False, f"{table} has {found} rows for {tid}, expected {n}"
    return True, "all checkpoints met"


# 5. Run all four agents through both scorers -----------------------------------
def score(agent) -> list[dict]:
    rows = []
    for t in TICKETS:
        db = Store()
        reply = agent(t, db)
        ok, why = effect_score(t, db)
        rows.append({"ticket": t[0], "kind": t[2], "text_pass": int(text_score(t, reply)),
                     "effect_pass": int(ok), "effect_detail": why, "reply": reply, "refunds": db.refunds})
    return rows


def main() -> int:
    n, out, totals = len(TICKETS), [], {}
    print(f"{'agent':<8}{'reply rubric':>14}{'effect score':>14}{'said it, effect wrong':>24}")
    for name, agent in AGENTS.items():
        rows = score(agent)
        txt, eff = sum(r["text_pass"] for r in rows), sum(r["effect_pass"] for r in rows)
        gap = sum(r["text_pass"] and not r["effect_pass"] for r in rows)
        totals[name] = (txt, eff, gap)
        print(f"{name:<8}{f'{txt} of {n}':>14}{f'{eff} of {n}':>14}{gap:>24}")
        out += [{"agent": name, **{k: v for k, v in r.items() if k not in ("reply", "refunds")}} for r in rows]
    owed = sum(INVOICES[t[3]] for t in TICKETS if t[2] == "refund")
    print(f"\nrefunds the customers were told were issued: {owed} owed in total")
    print(f"buggy agent paid 0 of it; double agent paid {2 * owed}")

    with open(HERE / "results.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(out[0]))
        w.writeheader()
        w.writerows(out)

    if "--check" in sys.argv:   # CI floor: the real agent meets every checkpoint, no broken agent does
        return 0 if totals["real"][1] == n and all(totals[a][1] < n for a in ("replay", "buggy", "double")) else 1
    return 0


# 6. One move at a time: python3 effects.py --show checkpoints | replay | buggy
def show(mode: str) -> int:
    if mode == "checkpoints":
        for t in (TICKETS[0], TICKETS[6], TICKETS[9]):
            print(f"{t[0]} {t[1]}")
            for c in checkpoints(t):
                print(f"   {c[0]:<6} {c[1]:<9} {c[2] if c[0] == 'row' else f'exactly {c[3]} for {c[2]}'}")
        return 0
    if mode == "replay":
        for r in score(replay_agent):
            print(f"{r['ticket']} {r['kind']:<9} reply {'pass' if r['text_pass'] else 'FAIL'}   "
                  f"effect {'pass' if r['effect_pass'] else 'FAIL'}   {'' if r['effect_pass'] else r['effect_detail']}")
        return 0
    for name in ("buggy", "double"):
        r = score(AGENTS[name])[0]
        print(f"{name} agent on T01")
        print(f"   reply:   {r['reply']}")
        print(f"   rubric:  {'pass' if r['text_pass'] else 'FAIL'}")
        print(f"   refunds: {r['refunds']}")
        print(f"   effect:  {'pass' if r['effect_pass'] else 'FAIL'}   {r['effect_detail']}")
    return 0


if __name__ == "__main__":
    if "--show" in sys.argv:
        sys.exit(show(sys.argv[sys.argv.index("--show") + 1]))
    sys.exit(main())
