"""The Trust Layer, edition 19: Passed Once. Failed Forever.

200 agent tasks that need 1, 2, 3 or 5 tool calls in a row. Every tool call
succeeds most of the time, like a real one. Each task is run 20 times, and the
same results are counted three ways:

  pass@1  the chance a single run works
  pass@k  the chance at least one of k runs works
  pass^k  the chance all k runs work (what a customer who comes back feels)

Standard library only. Seeded, so every machine gets the same numbers.
Run:  python pass_k.py
"""
from __future__ import annotations

import csv
import json
import random
import sys
from math import comb
from pathlib import Path

HERE = Path(__file__).parent
RNG = random.Random(19)
N_RUNS = 20                       # runs per task
CHAIN_LENGTHS = (1, 2, 3, 5)      # tool calls a task needs, in a row
TASKS_PER_LENGTH = 50

# 1. The tasks: each tool call has its own success rate, between 85% and 99% ----
tasks = [{"id": f"L{n}-{i:02}", "length": n,
          "step_p": [round(RNG.uniform(0.85, 0.99), 3) for _ in range(n)]}
         for n in CHAIN_LENGTHS for i in range(1, TASKS_PER_LENGTH + 1)]


# 2. One run: the task passes only if every tool call in the chain passes -------
def run_once(task: dict) -> bool:
    return all(RNG.random() < p for p in task["step_p"])


# 3. The three ways to count c passes out of n runs (unbiased estimators) -------
def pass_at_k(n: int, c: int, k: int) -> float:      # at least one of k works
    return 1.0 if n - c < k else 1 - comb(n - c, k) / comb(n, k)


def pass_hat_k(n: int, c: int, k: int) -> float:     # all k work
    return comb(c, k) / comb(n, k)


# 4. The release bar, written down
RELEASE_BAR = 0.70                # pass^3 a release must reach


def release_verdict(pass_hat_3: float) -> str:
    return "SHIP" if pass_hat_3 >= RELEASE_BAR else "DO NOT SHIP"


def interval(per_task: list[float], n_boot: int = 2000, seed: int = 191) -> tuple[float, float]:
    """Bootstrap 95% interval for the mean over tasks: is the gap to the bar just noise?"""
    rng = random.Random(seed)
    means = sorted(sum(rng.choice(per_task) for _ in per_task) / len(per_task) for _ in range(n_boot))
    return means[int(0.025 * n_boot)], means[int(0.975 * n_boot) - 1]


def main() -> int:
    rows = []
    for t in tasks:
        c = sum(run_once(t) for _ in range(N_RUNS))
        true_p = 1.0
        for p in t["step_p"]:
            true_p *= p
        rows.append({"task": t["id"], "length": t["length"], "passes": c,
                     "true_p": round(true_p, 3),
                     "pass@1": round(pass_at_k(N_RUNS, c, 1), 3),
                     "pass@5": round(pass_at_k(N_RUNS, c, 5), 3),
                     "pass^3": round(pass_hat_k(N_RUNS, c, 3), 3),
                     "pass^5": round(pass_hat_k(N_RUNS, c, 5), 3)})

    def mean(key, group):
        return sum(r[key] for r in group) / len(group)

    print(f"{'tools in chain':<16}{'pass@1':>8}{'pass@5':>8}{'pass^3':>8}{'pass^5':>8}{'tasks never failed':>21}")
    summary = {}
    for n in CHAIN_LENGTHS + ("all",):
        g = rows if n == "all" else [r for r in rows if r["length"] == n]
        clean = sum(r["passes"] == N_RUNS for r in g)
        summary[n] = {k: mean(k, g) for k in ("pass@1", "pass@5", "pass^3", "pass^5")}
        s = summary[n]
        print(f"{str(n):<16}{s['pass@1']:>8.0%}{s['pass@5']:>8.0%}{s['pass^3']:>8.0%}{s['pass^5']:>8.0%}"
              f"{f'{clean}/{len(g)}':>21}")

    with open(HERE / "results.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0]))
        w.writeheader()
        w.writerows(rows)

    published = HERE / "published.json"       # the numbers printed in the article
    if "--publish" in sys.argv:
        published.write_text(json.dumps({str(k): v for k, v in summary.items()}, indent=1), encoding="utf-8")
    if "--check" in sys.argv:    # CI floor: the article's numbers must still come out of the code
        want = json.loads(published.read_text(encoding="utf-8"))
        return 0 if all(abs(want[str(n)][k] - v) < 1e-9 for n, s in summary.items() for k, v in s.items()) else 1
    return 0


# 5. One move at a time: python pass_k.py --show runs | chain | bar
def show(mode: str) -> int:
    rng_state = RNG.getstate()
    results = {t["id"]: sum(run_once(t) for _ in range(N_RUNS)) for t in tasks}
    RNG.setstate(rng_state)
    if mode == "runs":
        for tid in ("L1-01", "L3-01", "L5-02"):
            c = results[tid]
            print(f"{tid}: passed {c} of {N_RUNS} runs   pass@1 {pass_at_k(N_RUNS, c, 1):.0%}   "
                  f"pass@5 {pass_at_k(N_RUNS, c, 5):.0%}   pass^5 {pass_hat_k(N_RUNS, c, 5):.0%}")
        return 0
    groups = {n: [t for t in tasks if t["length"] == n] for n in CHAIN_LENGTHS}
    if mode == "chain":
        for n, g in groups.items():
            p1 = sum(pass_at_k(N_RUNS, results[t["id"]], 1) for t in g) / len(g)
            p5 = sum(pass_hat_k(N_RUNS, results[t["id"]], 5) for t in g) / len(g)
            print(f"{n} tool{'s' if n > 1 else ' '} in a row   pass@1 {p1:.0%}   pass^5 {p5:.0%}")
        return 0
    c_all = [results[t["id"]] for t in tasks]
    p3 = sum(pass_hat_k(N_RUNS, c, 3) for c in c_all) / len(c_all)
    print(f"pass@1 {sum(c / N_RUNS for c in c_all) / len(c_all):.0%}   "
          f"pass@5 {sum(pass_at_k(N_RUNS, c, 5) for c in c_all) / len(c_all):.0%}   pass^3 {p3:.0%}")
    lo, hi = interval([pass_hat_k(N_RUNS, c, 3) for c in c_all])
    print(f"pass^3 95% interval {lo:.0%} to {hi:.0%}")
    print(f"release bar pass^3 >= {RELEASE_BAR:.0%}: {release_verdict(hi)} even at the top of the interval" if hi < RELEASE_BAR
          else f"release bar pass^3 >= {RELEASE_BAR:.0%}: {release_verdict(p3)}")
    return 0


if __name__ == "__main__":
    if "--show" in sys.argv:
        sys.exit(show(sys.argv[sys.argv.index("--show") + 1]))
    sys.exit(main())
