"""The Trust Layer, edition 17: I Trusted My Agent Judge. It Was Guessing the Whole Time.

60 support replies, each graded by me by hand (human_labels.jsonl). 40 are the
tuning set the rubric was written against; 20 are held out and never used to
write it. The script counts how often each judge agrees with me, corrects that
for the agreement luck alone would give (Cohen's kappa), and reports the held
out kappa with a bootstrap 95% interval.

Standard library only. Deterministic. Run:  python judge.py
"""
from __future__ import annotations

import csv
import json
import random
import sys
from pathlib import Path

HERE = Path(__file__).parent
LABELS = [json.loads(line) for line in open(HERE / "human_labels.jsonl", encoding="utf-8")]
TUNE = [r for r in LABELS if r["split"] == "tune"]
HELD = [r for r in LABELS if r["split"] == "held_out"]

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
def confusion(judge, rows=TUNE) -> dict[tuple[str, str], int]:
    m = {(h, j): 0 for h in ("good", "bad") for j in ("good", "bad")}
    for row in rows:
        m[(row["human"], judge(row))] += 1
    return m


def kappa(m: dict) -> tuple[float, float, float]:
    n = sum(m.values())
    p_o = (m[("good", "good")] + m[("bad", "bad")]) / n          # observed agreement
    human_good = (m[("good", "good")] + m[("good", "bad")]) / n
    judge_good = (m[("good", "good")] + m[("bad", "good")]) / n
    p_e = human_good * judge_good + (1 - human_good) * (1 - judge_good)  # luck
    return p_o, p_e, (p_o - p_e) / (1 - p_e)


def kappa_interval(judge, rows, n_boot=2000, seed=17) -> tuple[float, float]:
    """Bootstrap 95% interval: resample the labelled replies, recompute kappa."""
    rng = random.Random(seed)
    ks = []
    for _ in range(n_boot):
        sample = [rng.choice(rows) for _ in rows]
        m = confusion(judge, sample)
        p_o, p_e, k = kappa(m) if kappa_defined(m) else (0, 0, 0.0)
        ks.append(k)
    ks.sort()
    return ks[int(0.025 * n_boot)], ks[int(0.975 * n_boot) - 1]


def kappa_defined(m) -> bool:
    n = sum(m.values())
    human_good = (m[("good", "good")] + m[("good", "bad")]) / n
    judge_good = (m[("good", "good")] + m[("bad", "good")]) / n
    return human_good * judge_good + (1 - human_good) * (1 - judge_good) < 1


def rates(m) -> tuple[float, float]:
    tpr = m[("good", "good")] / (m[("good", "good")] + m[("good", "bad")])
    tnr = m[("bad", "bad")] / (m[("bad", "good")] + m[("bad", "bad")])
    return tpr, tnr


def main() -> int:
    results = {}
    for name, judge, rows in (("v1 tone only, tuning set", judge_v1, TUNE),
                              ("v2 rubric, tuning set", judge_v2, TUNE),
                              ("v2 rubric, held out", judge_v2, HELD)):
        m = confusion(judge, rows)
        p_o, p_e, k = kappa(m)
        tpr, tnr = rates(m)
        results[name] = round(k, 4)
        print(f"\n{name} ({len(rows)} replies)")
        print(f"                 judge good  judge bad")
        print(f"  human good     {m[('good','good')]:>10}  {m[('good','bad')]:>9}")
        print(f"  human bad      {m[('bad','good')]:>10}  {m[('bad','bad')]:>9}")
        print(f"  agreement {p_o:.0%}   luck alone {p_e:.0%}   kappa {k:.2f}")
        print(f"  good replies passed {tpr:.0%}   bad replies caught {tnr:.0%}")
    lo, hi = kappa_interval(judge_v2, HELD)
    print(f"\nv2 held out kappa, 95% interval: {lo:.2f} to {hi:.2f}   bar: 0.70")
    print("\nwhere the judges went wrong")
    with open(HERE / "results.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["id", "split", "topic", "human", "v1", "v2", "reply"])
        for row in LABELS:
            v1, v2 = judge_v1(row), judge_v2(row)
            w.writerow([row["id"], row["split"], row["topic"], row["human"], v1, v2, row["reply"]])
            if (v1 != row["human"] and row["split"] == "tune") or v2 != row["human"]:
                tag = " ".join(f"{n}:{v}" for n, v in (("v1", v1), ("v2", v2)) if v != row["human"])
                print(f"  {row['id']} human:{row['human']:<4} {tag:<16} {row['reply'][:58]}")

    published = HERE / "published.json"       # the numbers printed in the article
    if "--publish" in sys.argv:
        published.write_text(json.dumps(results, indent=1), encoding="utf-8")
    if "--check" in sys.argv:   # CI floor: the article's numbers must still come out of the code
        return 0 if json.loads(published.read_text(encoding="utf-8")) == results else 1
    return 0


# 4. One move at a time: python judge.py --show labels | luck | rubric
def show(mode: str) -> int:
    if mode == "labels":
        for name, rows in (("tuning set", TUNE), ("held out", HELD)):
            good = sum(r["human"] == "good" for r in rows)
            print(f"{name:<11} {len(rows)} replies graded by hand: {good} good, {len(rows) - good} bad")
        print()
        for row in (TUNE[0], TUNE[34], TUNE[36]):
            print(f"{row['id']} {row['human']:<4} {row['reply'][:70]}")
        return 0
    if mode == "luck":
        runs = [("v1 tone only, tuning set", judge_v1, TUNE)]
    else:
        runs = [("v2 rubric, tuning set", judge_v2, TUNE), ("v2 rubric, held out", judge_v2, HELD)]
    for name, judge, rows in runs:
        m = confusion(judge, rows)
        p_o, p_e, k = kappa(m)
        tpr, tnr = rates(m)
        print(name)
        print(f"  agreement {p_o:.1%}   luck alone {p_e:.1%}   kappa {k:.2f}")
        print(f"  good replies passed {tpr:.0%}   bad replies caught {tnr:.0%}")
    if mode == "rubric":
        lo, hi = kappa_interval(judge_v2, HELD)
        print(f"  held out 95% interval {lo:.2f} to {hi:.2f}   bar 0.70")
        for row in HELD:
            if judge_v2(row) != row["human"]:
                print(f"  missed {row['id']}: {row['reply']}")
    return 0


if __name__ == "__main__":
    if "--show" in sys.argv:
        sys.exit(show(sys.argv[sys.argv.index("--show") + 1]))
    sys.exit(main())
