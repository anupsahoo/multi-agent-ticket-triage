/**
 * The routing topology as an SVG: nodes, edges, per-edge counts, and the replay highlight.
 * Reads the geometry from `graph.ts` and, via props, the edge/node counts plus which nodes and
 * edges the current replay has reached. Renders only; `OrchestratorConsole` drives the state.
 */
"use client";
import { motion } from "framer-motion";
import { SEM, type Sem } from "@/lib/semantics";
import { EDGES, NODES, NODE_H, VIEW, edgeLabelPoint, edgePath, type NodeId } from "./graph";

/** One arrowhead marker per tone, so a lit edge's arrow matches its stroke. */
const SEMS = Object.keys(SEM) as Sem[];

/** Column captions sit on the same x values as the nodes in `graph.ts`. */
const COLUMNS: [string, number][] = [["Intake", 70], ["Orchestration", 250], ["Specialists", 450], ["Outcome", 650], ["Human lanes", 850]];

export function SystemGraph({ counts, nodeCounts, activeNodes, activeEdges, current }: {
  /** Cumulative desk counts keyed by edge id (`from>to`); undefined hides the label. */
  counts: Record<string, number | undefined>;
  /** Caption under each node, e.g. "80 routed". */
  nodeCounts: Partial<Record<NodeId, number | string>>;
  /** Nodes and edges the replay has lit so far, and the node it is on right now. */
  activeNodes: Set<NodeId>; activeEdges: Set<string>; current: NodeId | null;
}) {
  return (
    <svg viewBox={`0 0 ${VIEW.w} ${VIEW.h}`} width="100%" role="img" aria-label="Ticket flow through router, specialists and escalation" className="block">
      <defs>
        {SEMS.map((s) => (
          <marker key={s} id={`arrow-${s}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill={SEM[s].color} />
          </marker>
        ))}
        <marker id="arrow-base" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--line-strong)" />
        </marker>
      </defs>

      {COLUMNS.map(([t, x]) => (
        <text key={t} x={x} y={22} textAnchor="middle" className="eyebrow" style={{ fill: "var(--fg-faint)", fontSize: 10, letterSpacing: ".12em", textTransform: "uppercase", fontWeight: 650 }}>{t}</text>
      ))}

      {EDGES.map((e) => {
        const d = edgePath(e), on = activeEdges.has(e.id), [lx, ly] = edgeLabelPoint(e), n = counts[e.id];
        // Handoff edges are the exception in the graph, so a zero would only add noise.
        const showLabel = n !== undefined && (e.kind !== "back" || n > 0);
        return (
          <g key={e.id}>
            <path d={d} fill="none" stroke="var(--line-strong)" strokeWidth={e.kind === "back" ? 1 : 1.5}
              strokeDasharray={e.kind === "back" ? "3 4" : e.kind === "drop" ? "5 4" : undefined} markerEnd="url(#arrow-base)" opacity={e.kind === "back" ? 0.7 : 1} />
            {on && (
              <motion.path d={d} fill="none" stroke={SEM[e.sem].color} strokeWidth={2.5} strokeLinecap="round" markerEnd={`url(#arrow-${e.sem})`}
                initial={{ pathLength: 0, opacity: 0.6 }} animate={{ pathLength: 1, opacity: 1 }} transition={{ duration: 0.55, ease: "easeInOut" }} />
            )}
            {showLabel && (
              // paintOrder + stroke gives the label a panel-coloured halo so it stays legible over the edge.
              <text x={lx} y={ly + 4} textAnchor="middle" className="num"
                style={{ fontSize: 11, fontWeight: 600, fill: on ? SEM[e.sem].color : "var(--fg-muted)", paintOrder: "stroke", stroke: "var(--panel)", strokeWidth: 5, strokeLinejoin: "round" }}>
                {e.kind === "back" ? `handoff ${n}` : n}
              </text>
            )}
          </g>
        );
      })}

      {NODES.map((n) => {
        const visited = activeNodes.has(n.id), isCurrent = current === n.id, c = SEM[n.sem].color;
        const count = nodeCounts[n.id];
        return (
          <g key={n.id}>
            {isCurrent && (
              <motion.rect x={n.x - n.w / 2} y={n.y - NODE_H / 2} width={n.w} height={NODE_H} rx={11} fill="none" stroke={c} strokeWidth={2}
                initial={{ opacity: 0.8, scale: 1 }} animate={{ opacity: 0, scale: 1.18 }} transition={{ duration: 0.9, repeat: Infinity, ease: "easeOut" }}
                style={{ transformOrigin: `${n.x}px ${n.y}px` }} />
            )}
            {/* color-mix tints the panel with the node's tone, so visited nodes fill consistently for any theme value. */}
            <rect x={n.x - n.w / 2} y={n.y - NODE_H / 2} width={n.w} height={NODE_H} rx={10}
              fill={visited ? `color-mix(in srgb, ${c} 14%, var(--panel))` : "var(--panel)"} stroke={c} strokeWidth={isCurrent ? 2.5 : visited ? 2 : 1.25}
              style={{ filter: isCurrent ? `drop-shadow(0 0 6px color-mix(in srgb, ${c} 55%, transparent))` : undefined, transition: "fill .25s, stroke-width .25s" }} />
            {/* The label sits centred when there is no caption, and shifts up to make room when there is. */}
            <text x={n.x} y={n.y - (count !== undefined ? 3 : -5)} textAnchor="middle" style={{ fontSize: 13, fontWeight: 600, fill: visited ? c : "var(--fg)" }}>{n.label}</text>
            {count !== undefined && (
              <text x={n.x} y={n.y + 14} textAnchor="middle" className="num" style={{ fontSize: 10.5, fill: "var(--fg-muted)" }}>{count}</text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
