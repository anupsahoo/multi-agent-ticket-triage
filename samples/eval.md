# Evaluation log

Every row is one configured model scored on the fixed labelled set
(`samples/labelled.jsonl`) by `python run.py --eval --record`. The model is
configuration (`LLM_MODEL`), so the choice of model is an evaluation result,
recorded here, not a preference written into code.

## Columns

| Column | Meaning |
| --- | --- |
| `set` | First eight hex characters of the labelled file's SHA-256. Rows with different ids were scored on different sets and are not comparable |
| `model` | The `LLM_MODEL` string, or `stub` |
| `decisions` | Which classifier produced intent, domain fit and resolution: `jev` (calibrated), `llm` (self-reported) or `stub` (rules) |
| `routing` | Share of tickets whose final intent matched the label |
| `tool` | Share whose expected tool was called (or, when none is expected, where no specialist tool was called) |
| `args` | Share whose call to that tool carried the expected arguments; `"*"` in a label accepts any non-empty value |
| `outcome` | Share that resolved or escalated as labelled |
| `system` | The product of the four step accuracies: a ticket's chance of passing every step. This is the system's number, not the best step's |
| `confident-wrong` | Tickets that resolved when the label says escalate, or resolved under the wrong intent. The failure that logs itself as success; the count a reviewer should read first |
| `escalations` | Share of tickets escalated |
| `p95 ms` | 95th-percentile latency per ticket, not the mean; slow tails are what people feel |

## Rules

- The labelled set is fixed. Changing it changes `set`, and every earlier row stops being comparable; add cases in a new set rather than editing old ones.
- **Floors, written down.** The stub baseline must stay at 1.00 on every step with 0 confident-wrong; CI enforces this on every push (`.github/workflows/ci.yml`), so it is a regression gate on the graph's seams, not a model test. A candidate model is considered when `routing ≥ 0.85`, `outcome ≥ 0.85` and `confident-wrong = 0` on the set, and is never adopted on one number alone.
- Add a row: `LLM_MODEL=<provider:model> python run.py --eval --record`. The provider package must be installed and its usual key variable set; nothing else changes.

## Rows

| date | set | model | decisions | routing | tool | args | outcome | system | confident-wrong | escalations | p95 ms |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-09-21 | `aecafca9` | `stub` | stub | 1.00 | 1.00 | 1.00 | 1.00 | **1.00** | 0 | 0.50 | 1 |
