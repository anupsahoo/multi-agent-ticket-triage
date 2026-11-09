# The Trust Layer, edition 19
## Passed Once. Failed Forever.

200 agent tasks that need 1, 2, 3 or 5 tool calls in a row. Each tool call succeeds between 85% and 99% of the time. Every task runs 20 times, and the same results are counted three ways:

- **pass@1**: the chance a single run works
- **pass@5**: the chance at least one of 5 runs works
- **pass^k**: the chance all k runs work, which is what a returning customer feels

Standard library only, seeded, same numbers everywhere.

```bash
git clone https://github.com/anupsahoo/multi-agent-ticket-triage
cd multi-agent-ticket-triage/editions/tl-19-pass-k
python3 pass_k.py   # on Windows: python pass_k.py
```

Each move in the article also runs on its own: `python3 pass_k.py --show runs`, `--show chain` or `--show bar`.

## What you get

| Tools in chain | pass@1 | pass@5 | pass^3 | pass^5 | Tasks never failed |
| --- | --- | --- | --- | --- | --- |
| 1 | 92% | 100% | 78% | 66% | 13/50 |
| 2 | 85% | 100% | 64% | 49% | 8/50 |
| 3 | 75% | 100% | 44% | 26% | 1/50 |
| 5 | 67% | 100% | 30% | 14% | 0/50 |
| all | 80% | 100% | 54% | 39% | 22/200 |

pass@k and pass^k use the unbiased estimators: `1 - C(n-c, k) / C(n, k)` and `C(c, k) / C(n, k)`, for c passes out of n runs.

## CI floor
`python pass_k.py --check` fails if the numbers above stop coming out of the code (`published.json`).
