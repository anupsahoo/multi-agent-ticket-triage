"""The Trust Layer, edition 18: My Agent Did Nothing and Scored 100%.

Three agents answer the same 12 support tickets. One does the work. One copies the
perfect reply and does nothing. One has a small, common bug: it prepares a refund
and never submits it. Two scorers grade them: one reads the reply, one reads the
database.

Standard library only. Deterministic. Run:  python effects.py
"""
from __future__ import annotations

import csv
import re
import sys
from pathlib import Path

HERE = Path(__file__).parent
INVOICES = {"INV-1002": 120, "INV-1003": 80, "INV-1004": 95, "INV-2001": 60, "INV-2002": 45, "INV-2003": 150}

# 1. The tickets: message, the reply we expect, and the effects we expect -------
# A checkpoint is a row that must exist (refund issued, handoff opened) or a table
# that must stay untouched. Effects are checked in the database, not in the reply.
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
    ("T10", "What are your support hours?", "info", None),
    ("T11", "Do you export to Excel?", "info", None),
    ("T12", "Where is my tracking number?", "info", None),
]
REPLY = {
    "refund": "Your refund for {x} has been issued and will reach you in 3 to 5 working days.",
    "escalate": "I have passed this to our {x} team, who will contact you within one working day.",
    "info": "Thanks for asking, the answer is on our help page under {x}.",
}


def expected_reply(t) -> str:
    return REPLY[t[2]].format(x=t[3] or t[0])


def checkpoints(t) -> list[tuple]:
    kind, target = t[2], t[3]
    if kind == "refund":
        return [("row", "refunds", {"invoice": target, "amount": INVOICES[target], "status": "issued"})]
    if kind == "escalate":
        return [("row", "handoffs", {"ticket": t[0], "queue": target}), ("empty", "refunds", t[0])]
    return [("empty", "refunds", t[0]), ("empty", "handoffs", t[0])]


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


# 3. Three agents -------------------------------------------------------------
def real_agent(t, db: Store) -> str:
    if t[2] == "refund":
        db.submit_refund(db.draft_refund(t[0], t[3]))
    elif t[2] == "escalate":
        db.open_handoff(t[0], t[3])
    return expected_reply(t)


def replay_agent(t, db: Store) -> str:
    return expected_reply(t)                                # perfect words, no work


def buggy_agent(t, db: Store) -> str:
    if t[2] == "refund":
        db.draft_refund(t[0], t[3])                         # BUG: never calls submit_refund
    elif t[2] == "escalate":
        db.open_handoff(t[0], t[3])
    return expected_reply(t)


# 4. Two scorers --------------------------------------------------------------
def words(s: str) -> set[str]:
    return set(re.findall(r"[a-z0-9-]+", s.lower()))


def text_score(t, reply: str) -> bool:                      # does it SAY the right thing
    ref = words(expected_reply(t))
    return len(ref & words(reply)) / len(ref) >= 0.8


def effect_score(t, db: Store) -> tuple[bool, str]:          # did the right thing HAPPEN
    for kind, table, spec in checkpoints(t):
        rows = getattr(db, table)
        if kind == "row" and not any(all(r.get(k) == v for k, v in spec.items()) for r in rows):
            return False, f"missing {table} row {spec}"
        if kind == "empty" and any(r["ticket"] == spec for r in rows):
            return False, f"unexpected write in {table}"
    return True, "all checkpoints met"


# 5. Run all three agents through both scorers -------------------------------
def main() -> int:
    rows, totals = [], {}
    for name, agent in (("real", real_agent), ("replay", replay_agent), ("buggy", buggy_agent)):
        txt = eff = said_not_done = 0
        for t in TICKETS:
            db = Store()
            reply = agent(t, db)
            ok_text, (ok_eff, why) = text_score(t, reply), effect_score(t, db)
            txt += ok_text
            eff += ok_eff
            said_not_done += ok_text and not ok_eff
            rows.append({"agent": name, "ticket": t[0], "kind": t[2], "text_pass": int(ok_text),
                         "effect_pass": int(ok_eff), "effect_detail": why})
        totals[name] = (txt, eff, said_not_done)

    n = len(TICKETS)
    print(f"{'agent':<8}{'text score':>12}{'effect score':>14}{'said it, did not do it':>25}")
    for name, (txt, eff, gap) in totals.items():
        print(f"{name:<8}{txt / n:>12.0%}{eff / n:>14.0%}{gap:>25}")
    print("\nfailed checkpoints, buggy agent")
    for r in rows:
        if r["agent"] == "buggy" and not r["effect_pass"]:
            print(f"  {r['ticket']} {r['effect_detail']}")

    with open(HERE / "results.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0]))
        w.writeheader()
        w.writerows(rows)

    if "--check" in sys.argv:   # CI floor: the real agent meets every checkpoint, the cheat cannot pass
        return 0 if totals["real"][1] == n and totals["replay"][1] < n else 1
    return 0


# 6. One move at a time: python effects.py --show checkpoints | replay | buggy
def show(mode: str) -> int:
    if mode == "checkpoints":
        for t in (TICKETS[0], TICKETS[6], TICKETS[9]):
            print(f"{t[0]} {t[1]}")
            for c in checkpoints(t):
                print(f"   {c[0]:<6} {c[1]:<9} {c[2]}")
        return 0
    agent = replay_agent if mode == "replay" else buggy_agent
    for t in TICKETS if mode == "replay" else TICKETS[:2]:
        db = Store()
        reply = agent(t, db)
        ok, why = effect_score(t, db)
        print(f"{t[0]} {t[2]:<9} text {'pass' if text_score(t, reply) else 'FAIL'}   "
              f"effect {'pass' if ok else 'FAIL'}   {why if not ok else ''}")
        if mode == "buggy":
            print(f"   reply:  {reply}")
            print(f"   refunds table: {db.refunds}")
    return 0


if __name__ == "__main__":
    if "--show" in sys.argv:
        sys.exit(show(sys.argv[sys.argv.index("--show") + 1]))
    sys.exit(main())
