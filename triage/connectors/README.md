# Connectors

Agents ask for a **capability** and never name a connector. The registry maps
each capability to whichever connector `connectors.toml` says should serve it.

```
agent ──asks for──▶ "issues.search" ──registry──▶ mock | jira | github | yours
                                                          │
                                              every call passes safe_call:
                                              args validated → fn → result validated
                                              NotFound / exception → structured outcome
```

| Capability | Args schema | Result schema | Served today by |
|---|---|---|---|
| `account.lookup` | `AccountArgs` | `AccountStatus` | mock |
| `invoice.lookup` | `InvoiceArgs` | `Invoice` | mock |
| `issues.search` | `SearchArgs` | `IssueSearchResult` | mock · shapes for jira, github |
| `kb.search` | `SearchArgs` | `KBSearchResult` | mock |
| `handoff.create` | `HandoffArgs` | `HandoffReceipt` | mock · shape for jira |

## Adding a connector

1. Copy `_template.py` to `<name>.py` and rename the class.
2. Set `name` and `capabilities` (constants in `Cap`).
3. Implement one function per capability; raise `NotFound` for a clean miss.
4. Return a `ToolSpec` per capability from `tools()`.
5. Bind it in `connectors.toml`.
6. Run `pytest tests/test_connectors.py`; copy the plug-in test for yours.

Result schemas live in `base.py`, not in connectors. That is what keeps agents
stable when the connector behind them changes.

## Why the real ones are shapes

The brief puts real integrations out of scope. `jira.py` and `github.py`
therefore show the exact place a live call goes, read their credentials from
the environment, and raise `ConnectorNotConfigured` until those exist. The
trail records that reason, so a misconfigured deployment escalates with a clear
message instead of failing quietly.
