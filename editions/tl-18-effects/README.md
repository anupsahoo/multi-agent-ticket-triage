# The Trust Layer, edition 18
## My Agent Did Nothing and Scored 100%.

Four agents answer the same 12 tickets (6 refunds, 3 escalations, 3 questions). Two scorers grade them: a reply rubric that reads only the words, and an effect scorer that reads only the database.

Standard library only. No install, no API key.

```bash
git clone https://github.com/anupsahoo/multi-agent-ticket-triage
cd multi-agent-ticket-triage/editions/tl-18-effects
python3 effects.py   # on Windows: python effects.py
```

Each move in the article also runs on its own: `python3 effects.py --show checkpoints`, `--show replay` or `--show buggy`.

## What you get

```
agent     reply rubric  effect score   said it, effect wrong
real          12 of 12      12 of 12                       0
replay        12 of 12       3 of 12                       9
buggy         12 of 12       6 of 12                       6
double        12 of 12       6 of 12                       6

refunds the customers were told were issued: 550 owed in total
buggy agent paid 0 of it; double agent paid 1100
```

The reply rubric checks that the reply names the invoice and says the refund was issued. The effect scorer never reads the reply: each checkpoint is a row that must exist for this ticket, or an exact count of rows this ticket may write.

## CI floor
`python3 effects.py --check` fails if the real agent misses any checkpoint, or if any broken agent passes every checkpoint.
