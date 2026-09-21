/**
 * Shapes of what the triage engine returns.
 * Mirrors the JSON of `/api/meta`, `/api/stats`, `/api/tickets`, `/api/connectors`
 * and `/api/settings`. Nothing here is computed in the console; it is the API contract.
 */

export type Status = "open" | "resolved" | "escalated";
/** Where a ticket ends up: closed by the orchestrator, or waiting on a desk agent (L2) or engineering (L3). */
export type Lane = "auto" | "L2" | "L3";
export type Intent = "billing" | "technical" | "general" | "unknown";

/** One connector call a specialist made, with the validated result or the error that stopped it. */
export interface ToolCall {
  connector: string; capability: string; name: string; args: Record<string, unknown>;
  ok: boolean; error: string | null; result: Record<string, unknown> | null;
}

export interface Ticket {
  ticket_id: string; message: string;
  intent: Intent; confidence: number; intent_probs: Record<string, number>;
  /** Which backend classified it: `jev`, `llm` or `stub`. */
  intent_source: string;
  /** Specialists visited, in order. Two entries means one misroute handoff. Empty means the router escalated directly. */
  route_history: string[]; hops: number; tool_calls: ToolCall[];
  /** Human-readable log, one line per agent action, in the form `agent[source]: text`. */
  trail: string[];
  status: Status; resolution: string | null; escalation_reason: string | null; handoff_ref: string | null;
  customer: string; company: string; channel: string; priority: "P1" | "P2" | "P3" | "P4";
  created_at: string; latency_ms: number; lane: Lane; sla_due: string; sla_breached: boolean; assignee: string;
}

export interface Agent {
  id: string; name: string; role: string; kind: "orchestration" | "specialist" | "handoff";
  /** Capabilities this agent may call, e.g. `invoice.lookup`. Empty for agents that only decide. */
  capabilities: string[];
  /** Specialists only: `direct` (extracts ids itself) or `llm` (asks the model which tool to call). */
  mode?: string;
  /** Orchestration only: the decisions backend in use. */
  decision?: string;
}

/** Which connector currently serves a capability, and the connectors that could. `healthy` is false when the bound connector lacks credentials. */
export interface ConnectorBinding { capability: string; connector: string | null; healthy: boolean; options: string[] }

/** The three gates (0..1) and the hop limit: the only knobs the orchestrator exposes. */
export interface Settings { intent_confidence_min: number; domain_min: number; resolution_min: number; max_hops: number }

/** Engine identity: which backends decide and write, plus the live agent and connector registry. */
export interface Meta { decisions: string; language: string; settings: Settings; agents: Agent[]; connectors: ConnectorBinding[]; seeded: number }

/** Desk-wide aggregates over the last 7 days. */
export interface Stats {
  total: number; resolved: number; escalated: number; auto_resolution_rate: number;
  open_l2: number; open_l3: number; sla_breached: number; mean_latency_ms: number;
  by_intent: Record<string, number>; by_channel: Record<string, number>; by_lane: Record<string, number>;
  escalation_reasons: Record<string, number>;
  series: { day: string; date: string; total: number; resolved: number; escalated: number }[];
  tools: { name: string; calls: number; ok: number; failed: number }[];
  /** Visits per specialist. */
  agent_load: Record<string, number>;
  /** Tickets a specialist handed back to the router. */
  misroutes: number;
}
