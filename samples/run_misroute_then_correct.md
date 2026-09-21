# Sample run · T-004

Captured from `python run.py --file samples/tickets.txt` on the stub classifier and stub LLM (no keys).

```text
══════════════════════════════════════════════════════════════════════════════
TICKET T-004
  Invoice INV-1002 opens but the page crashes with an error every time
──────────────────────────────────────────────────────────────────────────────
  · router[stub]: intent=billing confidence=0.75 (technical 0.67, billing 0.33, general 0.00)
  · billing: picked up ticket (hop 1)
  · billing: extracted {'invoice_id': 'INV-1002'} from the message
  · billing: mock.lookup_invoice({'invoice_id': 'INV-1002'}) → ok
  · billing: domain fit 0.33 (others: technical 0.67, general 0.00)
  · billing: not my domain — handing to technical
  · router: honouring handoff from billing → technical
  · technical: picked up ticket (hop 2)
  · technical: asked the model which tool to call → check_known_issue({'query': 'invoice inv 1002 opens but the page crashes with error every time'})
  · technical: mock.check_known_issue({'query': 'invoice inv 1002 opens but the page crashes with error every time'}) → ok
  · technical: domain fit 0.67 (others: billing 0.33, general 0.00)
  · technical: drafted reply; resolution check 0.90
  · technical: resolved
──────────────────────────────────────────────────────────────────────────────
  RESOLVED: This is a known issue (KI-201: Invoice page crashes on open, status fixed). Workaround: Clear the browser cache or use the mobile app until 4.2.1 rolls out.
  route=billing → technical  tools=['lookup_invoice', 'check_known_issue']  0 ms
```
