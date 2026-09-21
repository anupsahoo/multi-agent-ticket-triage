# All sample runs

```text
decisions: stub · language: stub · connectors: {'account.lookup': 'mock', 'invoice.lookup': 'mock', 'issues.search': 'mock', 'kb.search': 'mock', 'handoff.create': 'mock'}

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

══════════════════════════════════════════════════════════════════════════════
TICKET T-002
  The app crashes with an error every time I export to CSV
──────────────────────────────────────────────────────────────────────────────
  · router[stub]: intent=technical confidence=0.95 (technical 1.00, billing 0.00, general 0.00)
  · technical: picked up ticket (hop 1)
  · technical: asked the model which tool to call → check_known_issue({'query': 'the app crashes with error every time export csv'})
  · technical: mock.check_known_issue({'query': 'the app crashes with error every time export csv'}) → ok
  · technical: domain fit 1.00 (others: billing 0.00, general 0.00)
  · technical: drafted reply; resolution check 0.90
  · technical: resolved
──────────────────────────────────────────────────────────────────────────────
  RESOLVED: This is a known issue (KI-203: Export to CSV times out over 10k rows, status open). No workaround yet.
  route=technical  tools=['check_known_issue']  0 ms

══════════════════════════════════════════════════════════════════════════════
TICKET T-003
  What are your support hours?
──────────────────────────────────────────────────────────────────────────────
  · router[stub]: intent=general confidence=0.90 (general 1.00, billing 0.00, technical 0.00)
  · general: picked up ticket (hop 1)
  · general: extracted {'query': 'what are your support hours'} from the message
  · general: mock.search_kb({'query': 'what are your support hours'}) → ok
  · general: domain fit 1.00 (others: billing 0.00, technical 0.00)
  · general: drafted reply; resolution check 0.90
  · general: resolved
──────────────────────────────────────────────────────────────────────────────
  RESOLVED: Support hours: Support is available 08:00 to 20:00 UK time, Monday to Friday.
  route=general  tools=['search_kb']  0 ms

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

══════════════════════════════════════════════════════════════════════════════
TICKET T-005
  asdf qwerty zxcv
──────────────────────────────────────────────────────────────────────────────
  · router[stub]: intent=general confidence=0.34 (billing 0.33, technical 0.33, general 0.33) → below 0.60, escalating rather than guessing
  · escalation: low routing confidence
  · escalation: handed to human via mock → handoff/T-005.json
──────────────────────────────────────────────────────────────────────────────
  ESCALATED: low routing confidence  → HANDOFF-T-005
  route=router only  tools=['create_handoff']  0 ms

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

══════════════════════════════════════════════════════════════════════════════
TICKET T-008
  You billed me twice this month and I want a refund
──────────────────────────────────────────────────────────────────────────────
  · router[stub]: intent=billing confidence=0.90 (billing 1.00, technical 0.00, general 0.00)
  · billing: picked up ticket (hop 1)
  · billing: escalating — needs an invoice id (INV-…) or account id (ACC-…) to look anything up
  · escalation: needs an invoice id (INV-…) or account id (ACC-…) to look anything up
  · escalation: handed to human via mock → handoff/T-008.json
──────────────────────────────────────────────────────────────────────────────
  ESCALATED: needs an invoice id (INV-…) or account id (ACC-…) to look anything up  → HANDOFF-T-008
  route=billing  tools=['create_handoff']  0 ms
```
