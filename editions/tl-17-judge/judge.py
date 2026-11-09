"""The Trust Layer, edition 17: I Trusted My Agent Judge. It Was Guessing the Whole Time.

40 support replies, each graded by me by hand (human_labels.jsonl). Two judges
grade the same 40. This script counts how often each judge agrees with me, then
corrects that number for the agreement you would get by luck alone (Cohen's kappa).

Standard library only. Deterministic. Run:  python judge.py
"""
from __future__ import annotations

import csv
import json
import sys
from pathlib import Path

HERE = Path(__file__).parent
LABELS = [json.loads(line) for line in open(HERE / "human_labels.jsonl")]

# 1. Judge v1: the prompt most teams start with ------------------------------
# "Is this a good support reply? Answer good or bad." With no reference answer,
# a grader can only judge tone. Polite, fluent replies pass. This stand in fails
# a reply only when it is rude, which in a support desk is almost never.
RUDE = ("not our problem", "read the manual", "stupid")


def judge_v1(row: dict) -> str:
    text = row["reply"].lower()
    return "bad" if any(w in text for w in RUDE) else "good"


# 2. Judge v2: a rubric with a reference answer ------------------------------
# Rule 1: the reply must state the fact the policy says is the answer.
# Rule 2: the reply must not promise anything the policy does not allow.
PROMISES = ("guarantee", "within 1 hour", "for free", "around the clock")


def judge_v2(row: dict) -> str:
    text = row["reply"].lower()
    if row["fact"].lower() not in text:
        return "bad"
    if any(p in text for p in PROMISES):
        return "bad"
    return "good"


# 3. The numbers: agreement, chance agreement, kappa -------------------------
def confusion(judge) -> dict[tuple[str, str], int]:
    m = {(h, j): 0 for h in ("good", "bad") for j in ("good", "bad")}
    for row in LABELS:
        m[(row["human"], judge(row))] += 1
    return m


def kappa(m: dict) -> tuple[float, float, float]:
    n = sum(m.values())
    p_o = (m[("good", "good")] + m[("bad", "bad")]) / n          # observed agreement
    human_good = (m[("good", "good")] + m[("good", "bad")]) / n
    judge_good = (m[("good", "good")] + m[("bad", "good")]) / n
    p_e = human_good * judge_good + (1 - human_good) * (1 - judge_good)  # luck
    return p_o, p_e, (p_o - p_e) / (1 - p_e)


def main() -> int:
    results = {}
    for name, judge in (("v1 tone only", judge_v1), ("v2 rubric", judge_v2)):
        m = confusion(judge)
        p_o, p_e, k = kappa(m)
        results[name] = (m, p_o, p_e, k)
        print(f"\n{name}")
        print(f"                 judge good  judge bad")
        print(f"  human good     {m[('good','good')]:>10}  {m[('good','bad')]:>9}")
        print(f"  human bad      {m[('bad','good')]:>10}  {m[('bad','bad')]:>9}")
        print(f"  agreement {p_o:.0%}   luck alone {p_e:.0%}   kappa {k:.2f}")

    print("\nwhere the judges went wrong")
    with open(HERE / "results.csv", "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["id", "topic", "human", "v1", "v2", "reply"])
        for row in LABELS:
            v1, v2 = judge_v1(row), judge_v2(row)
            w.writerow([row["id"], row["topic"], row["human"], v1, v2, row["reply"]])
            if v1 != row["human"] or v2 != row["human"]:
                tag = " ".join(f"{n}:{v}" for n, v in (("v1", v1), ("v2", v2)) if v != row["human"])
                print(f"  {row['id']} human:{row['human']:<4} {tag:<16} {row['reply'][:58]}")

    if "--check" in sys.argv:          # CI floor: only trust a judge at kappa 0.7 or above
        return 0 if results["v2 rubric"][3] >= 0.7 else 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
