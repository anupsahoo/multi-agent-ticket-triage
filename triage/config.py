"""Every tunable in one place.

Reads: nothing. These are module-level constants; the console's PUT
/api/settings rebinds them at runtime through `api.Engine.update_settings`,
which is why the agents read `config.X` at call time rather than importing
the values.

None of the thresholds have been calibrated against labelled tickets; they are
sensible starting points and the README says so.
"""

# Router: below this the ticket goes straight to a human rather than to a guess.
INTENT_CONFIDENCE_MIN = 0.60

# Inside a specialist, after it has looked at the tool result: "is this still my
# domain?" Below this the specialist hands the ticket back with a recommendation.
DOMAIN_MIN = 0.50

# After a reply is drafted: "does this actually answer the question?" Below this
# the draft is discarded and the ticket escalates, so a confident-sounding but
# wrong answer never reaches the user.
RESOLUTION_MIN = 0.70

# How many specialist visits a ticket may take before it is treated as a routing
# loop and escalated.
MAX_HOPS = 2

# The specialist domains, in the order the router's probabilities are reported.
DOMAINS = ("billing", "technical", "general")
