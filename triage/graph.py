"""Wires the agents into a LangGraph graph. All control flow lives here.

        ┌─────────┐   low confidence   ┌────────────┐
   ─────▶ router  ├───────────────────▶│ escalation ├──▶ END
        └────┬────┘                    └─────▲──────┘
             │ intent                        │ cannot resolve / tool failed /
     ┌───────┼──────────┐                    │ hop limit
     ▼       ▼          ▼                    │
  billing technical  general ────────────────┘
     │       │          │
     │  reroute (hops < MAX_HOPS) ──▶ router
     └──────┴───────────┴── resolved ──▶ END

Reads: the three collaborators the engine chose (classifier, llm, registry).
Returns: a compiled graph whose `invoke(new_ticket(...))` returns the final
TicketState. Node names equal the specialist domains, which is what lets the
router's intent label double as the edge target.
"""
from __future__ import annotations

from langgraph.graph import END, START, StateGraph
from langgraph.graph.state import CompiledStateGraph

from .agents.billing import BILLING
from .agents.common import Specialist, make_specialist, route_after_specialist
from .agents.escalation import make_escalation
from .agents.general import GENERAL
from .agents.router import make_router, route_after_router
from .agents.technical import TECHNICAL
from .classifier import Classifier
from .connectors import Registry
from .llm import SpecialistLLM
from .state import TicketState

SPECIALISTS: tuple[Specialist, ...] = (BILLING, TECHNICAL, GENERAL)


def build_graph(classifier: Classifier, llm: SpecialistLLM, registry: Registry) -> CompiledStateGraph:
    """Assemble and compile the graph drawn above."""
    g = StateGraph(TicketState)

    g.add_node("router", make_router(classifier))
    for sp in SPECIALISTS:
        g.add_node(sp.domain, make_specialist(sp, classifier, llm, registry))
    g.add_node("escalation", make_escalation(registry))

    g.add_edge(START, "router")
    g.add_conditional_edges("router", route_after_router,
                            {sp.domain: sp.domain for sp in SPECIALISTS} | {"escalation": "escalation"})
    for sp in SPECIALISTS:
        g.add_conditional_edges(sp.domain, route_after_specialist,
                                {"__end__": END, "router": "router", "escalation": "escalation"})
    g.add_edge("escalation", END)
    return g.compile()
