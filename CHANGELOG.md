# Changelog

All notable changes to this project are recorded here. Releases are tagged
`vMAJOR.MINOR.PATCH`; the Release workflow publishes notes for each tag.

## [1.0.0] — Initial release

- LangGraph triage graph: router, billing / technical / general specialists, human handoff.
- Pluggable connectors resolved by capability, with a validation boundary on every tool call.
- Decision layer behind a protocol: calibrated classifier, LLM fallback, deterministic stub.
- Eight failure paths, nineteen offline tests, JSONL evaluation hook.
- Engine API (local server and Vercel function) with a durable ticket store.
- L2/L3 support-desk console with seven screens and a bottom-pinned composer.
