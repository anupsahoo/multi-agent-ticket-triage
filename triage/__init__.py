"""Multi-agent support-ticket triage on LangGraph.

Package map, in the order a ticket meets them:

  state.py        the one TicketState every node reads and writes
  config.py       the thresholds and hop limit the decisions are made against
  extract.py      pulls ids and a search query out of the ticket text
  classifier.py   every yes/no and which-of-these decision (Jev, LLM or stub)
  llm.py          the language layer: choose a tool, draft a reply
  connectors/     capability registry, validation boundary, mock and real connectors
  agents/         router, three specialists, escalation
  graph.py        wires the agents into the compiled LangGraph graph
  logging.py      one JSON line per CLI run (run.py)
  persistence.py  file or Vercel Blob backend for the console's ticket store
  store.py        the console's ticket store, seeded from the real graph
  api.py          framework-free HTTP dispatch used by server.py and api/index.py
"""
