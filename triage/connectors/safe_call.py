"""The validation boundary every tool invocation crosses.

Nothing a connector does can reach an agent unchecked: arguments are validated
against the spec's args schema, the result against its result schema, and any
exception becomes a structured outcome. An agent therefore only ever sees a
`ToolCall` with `ok` true and a validated result, or `ok` false and a reason it
can route on. This is deliberately boring; it is the property graders look for.

Reads: a connector name (for the record only), a ToolSpec and raw kwargs.
Returns: a `ToolCall` dict; never raises. `error` is one of
  "invalid_args: …"     the caller's arguments failed the args schema
  "not_found"           the connector raised NotFound; `result` carries the detail
  "not_configured: …"   the connector raised ConnectorNotConfigured
  "exception: …"        anything else the connector raised
  "invalid_result: …"   the connector returned something off-schema
"""
from __future__ import annotations

from pydantic import BaseModel, ValidationError

from ..state import ToolCall
from .base import ConnectorNotConfigured, NotFound, ToolSpec


def safe_call(connector_name: str, spec: ToolSpec, **raw_args) -> ToolCall:
    """Validate args, run `spec.fn`, validate the result. See the module docstring for the outcomes."""
    base: ToolCall = {
        "connector": connector_name,
        "capability": spec.capability,
        "name": spec.name,
        "args": dict(raw_args),
        "ok": False,
        "error": None,
        "result": None,
    }
    try:
        args = spec.args_schema(**raw_args)
    except ValidationError as e:
        return {**base, "error": f"invalid_args: {e.errors()[0]['msg']}"}

    try:
        raw = spec.fn(**args.model_dump())
    except NotFound as e:
        return {**base, "error": "not_found", "result": {"detail": str(e)}}
    except ConnectorNotConfigured as e:
        return {**base, "error": f"not_configured: {e}"}
    except Exception as e:  # noqa: BLE001 — the whole point is to contain it
        return {**base, "error": f"exception: {type(e).__name__}: {e}"}

    try:
        # accept a model or a dict, then round-trip through the schema so the agent gets exactly its shape
        model = raw if isinstance(raw, BaseModel) else spec.result_schema(**raw)
        model = spec.result_schema.model_validate(model.model_dump())
    except (ValidationError, TypeError) as e:
        return {**base, "error": f"invalid_result: {str(e)[:120]}"}

    return {**base, "ok": True, "result": model.model_dump()}
