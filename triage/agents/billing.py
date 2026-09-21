"""Billing specialist: direct mode. Pulls an invoice or account id out of the
message and looks it up. No id means it cannot act, and says so."""
from ..connectors import Cap
from ..extract import extract_billing
from .common import Specialist

BILLING = Specialist(
    domain="billing",
    capabilities=[Cap.INVOICE_LOOKUP, Cap.ACCOUNT_LOOKUP],
    mode="direct",
    extract=extract_billing,
    missing_hint="an invoice id (INV-…) or account id (ACC-…)",
)
