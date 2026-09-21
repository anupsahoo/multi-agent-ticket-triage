# Sample run · T-001

Captured from `python run.py --file samples/tickets.txt` on the stub classifier and stub LLM (no keys).

```text
══════════════════════════════════════════════════════════════════════════════
TICKET T-001
  I was charged twice for invoice INV-1002
──────────────────────────────────────────────────────────────────────────────
  · router[stub]: intent=billing confidence=0.95 (billing 1.00, technical 0.00, general 0.00)
  · billing: picked up ticket (hop 1)
  · billing: extracted {'invoice_id': 'INV-1002'} from the message
  · billing: mock.lookup_invoice({'invoice_id': 'INV-1002'}) → ok
  · billing: domain fit 1.00 (others: technical 0.00, general 0.00)
  · billing: drafted reply; resolution check 0.90
  · billing: resolved
──────────────────────────────────────────────────────────────────────────────
  RESOLVED: Invoice INV-1002 for 149.00 GBP is marked paid. I can see it was charged twice, so a refund of the duplicate is due.
  route=billing  tools=['lookup_invoice']  1 ms
```
