/**
 * Static layout of the system graph (nodes, edges, bezier geometry) and the replay builder.
 * Reads nothing at runtime except the ticket handed to `buildSteps`; exports the geometry
 * `SystemGraph` draws and the ordered steps `OrchestratorConsole` animates through.
 */
import { trailAgent, type Sem } from "@/lib/semantics";
import type { Ticket } from "@/lib/types";

export type NodeId = "ticket" | "router" | "billing" | "technical" | "general" | "resolved" | "escalation" | "L2" | "L3";
export interface GraphNode { id: NodeId; x: number; y: number; w: number; label: string; sem: Sem }
export interface GraphEdge {
  id: string; from: NodeId; to: NodeId;
  /** `fwd` is the normal left-to-right path, `back` a handoff to the router, `drop` the router escalating directly. */
  kind: "fwd" | "back" | "drop";
  sem: Sem;
  /** Where along the curve (0..1) the count label sits; 0.3 keeps converging edges from overlapping their labels. */
  labelT: number;
}

/** The specialist node ids, in graph order. Also the agent ids that appear in `route_history`. */
export const SPECIALISTS: NodeId[] = ["billing", "technical", "general"];

export const NODE_H = 44;
export const VIEW = { w: 940, h: 420 };

// Five columns at x = 70 / 250 / 450 / 650 / 850; SystemGraph's captions sit on the same x values.
export const NODES: GraphNode[] = [
  { id: "ticket", x: 70, y: 170, w: 100, label: "Ticket", sem: "muted" },
  { id: "router", x: 250, y: 170, w: 120, label: "Router", sem: "accent" },
  { id: "billing", x: 450, y: 70, w: 120, label: "Billing", sem: "agent" },
  { id: "technical", x: 450, y: 170, w: 120, label: "Technical", sem: "agent" },
  { id: "general", x: 450, y: 270, w: 120, label: "General", sem: "agent" },
  { id: "resolved", x: 650, y: 120, w: 120, label: "Resolved", sem: "ok" },
  { id: "escalation", x: 650, y: 320, w: 120, label: "Escalation", sem: "warn" },
  { id: "L2", x: 850, y: 280, w: 110, label: "L2 queue", sem: "warn" },
  { id: "L3", x: 850, y: 375, w: 110, label: "L3 engineering", sem: "crit" },
];
const NODE = Object.fromEntries(NODES.map((n) => [n.id, n])) as Record<NodeId, GraphNode>;

/** Edge ids are `from>to`; `OrchestratorConsole` keys its counts by the same strings. */
export const EDGES: GraphEdge[] = [
  { id: "ticket>router", from: "ticket", to: "router", kind: "fwd", sem: "accent", labelT: 0.5 },
  ...SPECIALISTS.map<GraphEdge>((s) => ({ id: `router>${s}`, from: "router", to: s, kind: "fwd", sem: "agent", labelT: 0.5 })),
  ...SPECIALISTS.map<GraphEdge>((s) => ({ id: `${s}>router`, from: s, to: "router", kind: "back", sem: "warn", labelT: 0.5 })),
  { id: "router>escalation", from: "router", to: "escalation", kind: "drop", sem: "warn", labelT: 0.5 },
  ...SPECIALISTS.map<GraphEdge>((s) => ({ id: `${s}>resolved`, from: s, to: "resolved", kind: "fwd", sem: "ok", labelT: 0.3 })),
  ...SPECIALISTS.map<GraphEdge>((s) => ({ id: `${s}>escalation`, from: s, to: "escalation", kind: "fwd", sem: "warn", labelT: 0.3 })),
  { id: "escalation>L2", from: "escalation", to: "L2", kind: "fwd", sem: "warn", labelT: 0.5 },
  { id: "escalation>L3", from: "escalation", to: "L3", kind: "fwd", sem: "crit", labelT: 0.5 },
];

/* ── Geometry ────────────────────────────────────────────────────── */

type Pt = [number, number];

/** Cubic bezier control points for an edge, by kind. */
function bezierPoints(e: GraphEdge): [Pt, Pt, Pt, Pt] {
  const a = NODE[e.from], b = NODE[e.to];
  if (e.kind === "back") {
    // Specialist hands the ticket back to the router: a parallel dashed edge 12px under the forward one.
    const x1 = a.x - a.w / 2, y1 = a.y + 12, x2 = b.x + b.w / 2, y2 = b.y + 12, dx = (x1 - x2) / 2;
    return [[x1, y1], [x1 - dx, y1], [x2 + dx, y2], [x2, y2]];
  }
  if (e.kind === "drop") {
    // Router gives up (low confidence): leaves from the bottom and swings under the specialists.
    const x1 = a.x, y1 = a.y + NODE_H / 2, x2 = b.x - b.w / 2, y2 = b.y;
    return [[x1, y1], [x1, y1 + 160], [x2 - 160, y2 + 30], [x2, y2]];
  }
  const x1 = a.x + a.w / 2, y1 = a.y, x2 = b.x - b.w / 2, y2 = b.y, dx = (x2 - x1) / 2;
  return [[x1, y1], [x1 + dx, y1], [x2 - dx, y2], [x2, y2]];
}

/** SVG path data for an edge. */
export function edgePath(e: GraphEdge) {
  const [p0, p1, p2, p3] = bezierPoints(e);
  return `M ${p0[0]} ${p0[1]} C ${p1[0]} ${p1[1]}, ${p2[0]} ${p2[1]}, ${p3[0]} ${p3[1]}`;
}

/** Point on the curve at `labelT`; back edges push the label below the line so it clears the forward edge's label. */
export function edgeLabelPoint(e: GraphEdge): Pt {
  const [p0, p1, p2, p3] = bezierPoints(e);
  const t = e.labelT, u = 1 - t;
  const f = (i: 0 | 1) => u ** 3 * p0[i] + 3 * u * u * t * p1[i] + 3 * u * t * t * p2[i] + t ** 3 * p3[i];
  return [f(0), f(1) + (e.kind === "back" ? 12 : 0)];
}

/* ── Replay ──────────────────────────────────────────────────────── */

/** One replay step: a node lights up (via an edge) and the trail lines it wrote appear. */
export interface Step { node: NodeId; edge?: string; lines: number[] }

/** Turn a ticket into the ordered list of graph steps its route actually took, with trail line indexes attached. */
export function buildSteps(t: Ticket): Step[] {
  const steps: Step[] = [{ node: "ticket", lines: [] }, { node: "router", edge: "ticket>router", lines: [] }];
  let prev: NodeId = "router";
  t.route_history.forEach((a, i) => {
    const node = a as NodeId;
    if (i > 0) steps.push({ node: "router", edge: `${prev}>router`, lines: [] });
    steps.push({ node, edge: `router>${node}`, lines: [] });
    prev = node;
  });
  if (t.status === "resolved") steps.push({ node: "resolved", edge: `${prev}>resolved`, lines: [] });
  else if (t.status === "escalated") {
    steps.push({ node: "escalation", edge: `${prev}>escalation`, lines: [] });
    if (t.lane === "L2" || t.lane === "L3") steps.push({ node: t.lane, edge: `escalation>${t.lane}`, lines: [] });
  }
  // Attach each trail line to the first step, from the current one onward, written by that agent.
  // Lines from agents with no node (or written before their node) stay with the current step.
  let si = 0;
  t.trail.forEach((line, li) => {
    const agent = trailAgent(line);
    let j = si;
    while (j < steps.length && steps[j].node !== agent) j++;
    if (j < steps.length) si = j;
    steps[si].lines.push(li);
  });
  return steps;
}
