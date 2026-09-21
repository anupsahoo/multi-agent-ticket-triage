# Sample run · T-007

Captured from `python run.py --file samples/tickets.txt` on the stub classifier and stub LLM (no keys).

```text
══════════════════════════════════════════════════════════════════════════════
TICKET T-007
  My account ACC-9999 shows the wrong plan and I was billed for it
──────────────────────────────────────────────────────────────────────────────
  · router[stub]: intent=billing confidence=0.75 (billing 1.00, technical 0.00, general 0.00)
  · billing: picked up ticket (hop 1)
  · billing: extracted {'account_id': 'ACC-9999'} from the message
  · billing: mock.get_account_status({'account_id': 'ACC-9999'}) → error=exception: ConnectionError: billing backend timed out
  · billing: escalating — tool failed (exception: ConnectionError: billing backend timed out); not guessing
  · escalation: tool failed (exception: ConnectionError: billing backend timed out); not guessing
  · escalation: handed to human via mock → handoff/T-007.json
──────────────────────────────────────────────────────────────────────────────
  ESCALATED: tool failed (exception: ConnectionError: billing backend timed out); not guessing  → HANDOFF-T-007
  route=billing  tools=['get_account_status', 'create_handoff']  0 ms
```
