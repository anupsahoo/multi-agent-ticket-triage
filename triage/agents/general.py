"""General specialist: direct mode against the knowledge base. The search
query is the message reduced to its meaningful words."""
from ..connectors import Cap
from ..extract import extract_query
from .common import Specialist

GENERAL = Specialist(
    domain="general",
    capabilities=[Cap.KB_SEARCH],
    mode="direct",
    extract=extract_query,
    missing_hint="a clearer question",
)
