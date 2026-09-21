/**
 * The console's colour vocabulary and small formatting helpers.
 * Reads nothing; maps engine values (status, lane, priority, agent id) to one of seven
 * semantic tones, and formats numbers, durations and trail lines the same way everywhere.
 */
import type { Lane, Status, Ticket } from "./types";

/** The seven tones. Each maps to a `--{sem}` / `--{sem}-soft` pair in globals.css. */
export type Sem = "accent" | "ok" | "warn" | "crit" | "info" | "agent" | "muted";
export const SEM: Record<Sem, { color: string; soft: string; label: string }> = {
  accent: { color: "var(--accent)", soft: "var(--accent-soft)", label: "Orchestrator" },
  ok: { color: "var(--ok)", soft: "var(--ok-soft)", label: "Resolved" },
  warn: { color: "var(--warn)", soft: "var(--warn-soft)", label: "Needs a person" },
  crit: { color: "var(--crit)", soft: "var(--crit-soft)", label: "Engineering" },
  info: { color: "var(--info)", soft: "var(--info-soft)", label: "Tool" },
  agent: { color: "var(--agent)", soft: "var(--agent-soft)", label: "Agent" },
  muted: { color: "var(--muted)", soft: "var(--muted-soft)", label: "Neutral" },
};

/* ── Engine value → tone ─────────────────────────────────────────── */

export const statusSem = (s: Status): Sem => (s === "resolved" ? "ok" : s === "escalated" ? "warn" : "muted");
export const laneSem = (l: Lane): Sem => (l === "auto" ? "ok" : l === "L2" ? "warn" : "crit");
export const prioritySem = (p: Ticket["priority"]): Sem => (p === "P1" ? "crit" : p === "P2" ? "warn" : "muted");
/** Router is the orchestrator's tone, escalation is the handoff tone, every specialist shares the agent tone. */
export const agentSem = (a: string): Sem => (a === "router" ? "accent" : a === "escalation" ? "warn" : "agent");

/** Lucide icon name per intake channel; `Icon` falls back to a circle for anything else. */
export const channelIcon: Record<string, string> = { email: "Mail", chat: "MessageSquare", portal: "Globe", phone: "Phone" };

/* ── Labels and formatting ───────────────────────────────────────── */

export const statusLabel = (t: Ticket) =>
  t.status === "resolved" ? "Resolved · auto" : t.status === "escalated" ? `Escalated · ${t.lane}` : "Open";

export const fmt = (n: number) => n.toLocaleString("en-US");
export const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** "12m" / "4h" / "2d" for a span in seconds; never shows less than one minute. */
const spanLabel = (seconds: number) =>
  seconds < 3600 ? `${Math.max(1, Math.round(seconds / 60))}m`
  : seconds < 86400 ? `${Math.round(seconds / 3600)}h`
  : `${Math.round(seconds / 86400)}d`;

/** "4h ago". Depends on the wall clock, so cells that render it carry `suppressHydrationWarning`. */
export const timeAgo = (iso: string) => `${spanLabel(Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000))} ago`;

/** Time to (or since) an SLA deadline; callers phrase it. Wall-clock dependent like `timeAgo`. */
export const slaCountdown = (iso: string) => {
  const s = (new Date(iso).getTime() - Date.now()) / 1000;
  return { overdue: s < 0, span: spanLabel(Math.abs(s)) };
};

/* ── Trail lines ─────────────────────────────────────────────────── */
// A trail line looks like `billing[direct]: invoice.lookup(INV-1) → ok`. The prefix before the
// colon is the agent, optionally tagged with its source in brackets.

/** The agent that wrote a trail line: `billing[direct]: …` → `billing`. */
export const trailAgent = (line: string) => line.split(":", 1)[0].split("[", 1)[0].trim();
/** Everything after the agent prefix. */
export const trailText = (line: string) => line.slice(line.indexOf(":") + 1).trim();
