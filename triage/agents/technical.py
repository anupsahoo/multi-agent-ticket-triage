"""Technical specialist: LLM tool-calling mode. The model is bound to the
issues.search tool and decides whether and how to call it. This is the one
agent that exercises genuine function calling, per the brief; the other two
extract identifiers directly because it is deterministic and easier to test.
The README discusses the trade-off."""
from ..connectors import Cap
from .common import Specialist

TECHNICAL = Specialist(
    domain="technical",
    capabilities=[Cap.ISSUES_SEARCH],
    mode="llm",
    extract=None,
    missing_hint="a description of what fails, with any error text",
)
