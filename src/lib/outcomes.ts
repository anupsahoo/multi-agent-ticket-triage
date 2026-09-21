/**
 * Per-agent outcome tallies derived from tickets' `route_history`.
 * Reads a ticket list; returns, for each agent id, how many tickets it saw and how
 * each visit ended. Shared by the Agents page (resolution rate) and the Orchestrator
 * page (edge counts on the system graph).
 */
import type { Ticket } from "./types";

export interface AgentOutcome {
  /** Tickets whose route passed through this agent at all. */
  visited: number;
  /** Visits where this agent was the last hop and the ticket resolved. */
  resolved: number;
  /** Visits where this agent was the last hop and the ticket escalated. */
  escalated: number;
  /** Visits this agent handed back to the router ("not my domain"). */
  handedBack: number;
}

/** Tallies outcomes for every id in `ids`; route entries for other ids are ignored. */
export function routeOutcomes(tickets: Ticket[], ids: string[]): Record<string, AgentOutcome> {
  const out: Record<string, AgentOutcome> = {};
  for (const id of ids) out[id] = { visited: 0, resolved: 0, escalated: 0, handedBack: 0 };
  for (const t of tickets) {
    t.route_history.forEach((a, i) => {
      const o = out[a];
      if (!o) return;
      o.visited += 1;
      // Only the last hop owns the ticket's final status; every earlier hop was a handoff.
      if (i < t.route_history.length - 1) o.handedBack += 1;
      else if (t.status === "resolved") o.resolved += 1;
      else if (t.status === "escalated") o.escalated += 1;
    });
  }
  return out;
}
