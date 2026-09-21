"""One agent per file. Router, three specialists, escalation.

Each `make_*` factory takes its collaborators (classifier, llm, registry) and
returns a LangGraph node: a function from `TicketState` to the partial dict of
state it wants merged. The `route_after_*` functions are the conditional edges
graph.py wires between them.
"""
