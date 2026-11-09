# The Trust Layer, edition 18
## My Agent Did Nothing and Scored 100%.

Three agents answer the same 12 tickets (6 refunds, 3 escalations, 3 questions). Two scorers grade them: one reads the reply, one reads the database.

Standard library only. No install, no API key.

```bash
git clone https://github.com/anupsahoo/multi-agent-ticket-triage
cd multi-agent-ticket-triage/editions/tl-18-effects
python3 effects.py   # on Windows: python effects.py
```

Each move in the article also runs on its own: `python3 effects.py --show checkpoints`, `--show replay` or `--show buggy`.

## What you get

| Agent | Text score | Effect score | Said it, did not do it |
| --- | --- | --- | --- |
| real: does the work | 100% | 100% | 0 |
| replay: copies the perfect reply, does nothing | 100% | 25% | 9 |
| buggy: prepares refunds, never submits them | 100% | 50% | 6 |

A checkpoint is either a row that must exist (a refund with status `issued`, a handoff in the right queue) or a table that must stay untouched (no refund on an escalated ticket). The effect scorer never reads the reply.

## CI floor
`python effects.py --check` fails if the real agent misses any checkpoint, or if the replay cheat ever passes the effect scorer.
