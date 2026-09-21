# Sample run · T-006

Captured from `python run.py --file samples/tickets.txt` on the stub classifier and stub LLM (no keys).

```text
══════════════════════════════════════════════════════════════════════════════
TICKET T-006
  Please refund invoice INV-0000, it was a mistake
──────────────────────────────────────────────────────────────────────────────
  · router[stub]: intent=billing confidence=0.90 (billing 1.00, technical 0.00, general 0.00)
  · billing: picked up ticket (hop 1)
  · billing: extracted {'invoice_id': 'INV-0000'} from the message
  · billing: mock.lookup_invoice({'invoice_id': 'INV-0000'}) → error=not_found
  · billing: escalating — lookup found nothing for {'invoice_id': 'INV-0000'}; a human should confirm an invoice id (INV-…) or account id (ACC-…)
  · escalation: lookup found nothing for {'invoice_id': 'INV-0000'}; a human should confirm an invoice id (INV-…) or account id (ACC-…)
  · escalation: handed to human via mock → handoff/T-006.json
──────────────────────────────────────────────────────────────────────────────
  ESCALATED: lookup found nothing for {'invoice_id': 'INV-0000'}; a human should confirm an invoice id (INV-…) or account id (ACC-…)  → HANDOFF-T-006
  route=billing  tools=['lookup_invoice', 'create_handoff']  0 ms
```
