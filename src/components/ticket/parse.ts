/**
 * Reads structure out of a ticket's free-text trail and escalation reason.
 * The engine records the specialist's checks and tool calls only as trail lines, so the
 * detail page parses them back out here: check scores for the gauges, tool call / outcome
 * for the timeline, and a suggested next step from the escalation reason.
 */
import type { Ticket } from "@/lib/types";
import { trailAgent, trailText } from "@/lib/semantics";

/** Pull "domain fit 0.67" / "resolution check 0.90" out of the trail. The last occurrence wins: it is the final agent's check. */
export function parseCheck(trail: string[], label: "domain fit" | "resolution check"): number | null {
  const re = new RegExp(`${label}\\s+(\\d+(?:\\.\\d+)?)`, "i");
  for (let i = trail.length - 1; i >= 0; i--) {
    const m = trail[i].match(re);
    if (m) return Number(m[1]);
  }
  return null;
}

export interface TrailLine {
  agent: string; text: string;
  /** True for anything about handing the ticket on, so the timeline can colour it as a warning. */
  escalation: boolean;
  /** Present when the line is `tool(args) → outcome`; `ok` is false when the outcome starts with "error". */
  tool?: { call: string; outcome: string; ok: boolean };
}

/** Split a trail line into agent, text, and (if it is one) the tool call and its outcome. */
export function parseTrail(line: string): TrailLine {
  const agent = trailAgent(line);
  const text = trailText(line);
  const tool = text.match(/^([\w.]+\([^]*\))\s*→\s*([^]+)$/);
  const escalation = agent === "escalation" || /escalat/i.test(text) || /not my domain|honouring handoff/i.test(text);
  return {
    agent, text, escalation,
    tool: tool ? { call: tool[1], outcome: tool[2], ok: !/^error/i.test(tool[2]) } : undefined,
  };
}

export type NextStep = { title: string; detail: string; owner: string };

/** "What should a human do next", matched from phrases the engine uses in escalation reasons. Order matters: first match wins. */
export function nextStep(t: Ticket): NextStep {
  const r = (t.escalation_reason ?? "").toLowerCase();
  if (r.includes("needs an") || r.includes("needs a") || r.includes("missing")) {
    return { title: "Ask the customer for the id", detail: "The specialist could not find an invoice or account id in the message, so it did not guess. Reply asking for INV-… or ACC-…, then reprocess.", owner: "L2 agent" };
  }
  if (r.includes("found nothing")) {
    return { title: "Confirm the id with the customer", detail: "The lookup ran but returned no record for that id. Check for a typo, confirm it with the customer, then reprocess with the corrected id.", owner: "L2 agent" };
  }
  if (r.includes("tool failed") || r.includes("exception") || r.includes("error")) {
    return { title: "Raise with engineering", detail: "A backend call failed, so the agent stopped rather than answer from a broken result. Check the connector's health and hand the ticket to the owning engineer.", owner: "L3 / engineering" };
  }
  if (r.includes("low routing confidence") || r.includes("confidence")) {
    return { title: "Read the message and route it manually", detail: "The router could not tell which specialist should own this. Read it, pick billing, technical or general, and reprocess or answer directly.", owner: "L2 agent" };
  }
  if (r.includes("hop") || r.includes("loop")) {
    return { title: "Pick an owner and answer directly", detail: "The specialists handed the ticket back and forth past the hop limit. A person should read the trail and decide which team owns it.", owner: "L2 agent" };
  }
  return { title: "Read the trail and decide", detail: "The orchestrator handed this over without a recognised reason. Walk the timeline below before replying.", owner: "L2 agent" };
}
