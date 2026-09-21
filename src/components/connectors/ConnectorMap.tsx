/**
 * Three-column map: agents → the capabilities they call → the connectors that can serve each.
 * Reads the agent registry and the current bindings. Solid links are live bindings (info tone,
 * or crit when the bound connector is not configured); dashed links are available options.
 */
"use client";
import { motion } from "framer-motion";
import { SEM, agentSem } from "@/lib/semantics";
import type { Agent, ConnectorBinding } from "@/lib/types";

/** Layout in SVG units: three column centres, box widths per column, row pitch and header height. */
const W = 720, ROW_H = 44, TOP = 34;
const COL = { agent: 110, cap: 360, conn: 610 };
const BOX_W = { agent: 150, cap: 150, conn: 110 };

/** Horizontal S-curve between two points. */
const link = (x1: number, y1: number, x2: number, y2: number) => `M ${x1} ${y1} C ${(x1 + x2) / 2} ${y1}, ${(x1 + x2) / 2} ${y2}, ${x2} ${y2}`;

export function ConnectorMap({ agents, bindings }: { agents: Agent[]; bindings: ConnectorBinding[] }) {
  const caps = bindings.map((b) => b.capability);
  const connectors = Array.from(new Set(bindings.flatMap((b) => b.options)));
  const rows = Math.max(agents.length, caps.length, connectors.length);
  const H = TOP + ROW_H * rows + 10;
  // Each column is vertically centred against the tallest column.
  const yOf = (i: number, n: number) => TOP + (rows - n) * ROW_H / 2 + i * ROW_H + ROW_H / 2;
  const agentY = (id: string) => yOf(agents.findIndex((a) => a.id === id), agents.length);
  const capY = (c: string) => yOf(caps.indexOf(c), caps.length);
  const connY = (c: string) => yOf(connectors.indexOf(c), connectors.length);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Agents, the capabilities they call, and the connectors bound to each capability" className="block">
      {[["Agents", COL.agent], ["Capabilities", COL.cap], ["Connectors", COL.conn]].map(([t, x]) => (
        <text key={t as string} x={x as number} y={16} textAnchor="middle" style={{ fill: "var(--fg-faint)", fontSize: 10, letterSpacing: ".12em", textTransform: "uppercase", fontWeight: 650 }}>{t}</text>
      ))}
      {agents.flatMap((a) => a.capabilities.filter((c) => caps.includes(c)).map((c) => (
        <motion.path key={`${a.id}-${c}`} d={link(COL.agent + BOX_W.agent / 2, agentY(a.id), COL.cap - BOX_W.cap / 2, capY(c))} fill="none"
          stroke={SEM[agentSem(a.id)].color} strokeWidth={1.5} opacity={0.7}
          initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.6 }} />
      )))}
      {bindings.flatMap((b) => b.options.map((o) => {
        const bound = b.connector === o;
        return (
          <motion.path key={`${b.capability}-${o}`} d={link(COL.cap + BOX_W.cap / 2, capY(b.capability), COL.conn - BOX_W.conn / 2, connY(o))} fill="none"
            stroke={bound ? SEM[b.healthy ? "info" : "crit"].color : "var(--line-strong)"} strokeWidth={bound ? 2 : 1} strokeDasharray={bound ? undefined : "3 4"}
            initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.6, delay: 0.2 }} />
        );
      }))}
      {agents.map((a) => {
        const c = SEM[agentSem(a.id)].color, y = agentY(a.id);
        return (
          <g key={a.id}>
            {/* color-mix tints the panel with the agent's tone so the box fill tracks the theme. */}
            <rect x={COL.agent - BOX_W.agent / 2} y={y - 15} width={BOX_W.agent} height={30} rx={8} fill={`color-mix(in srgb, ${c} 10%, var(--panel))`} stroke={c} strokeWidth={1.25} />
            <text x={COL.agent} y={y + 4} textAnchor="middle" style={{ fontSize: 12, fontWeight: 600, fill: "var(--fg)" }}>{a.name.replace(" specialist", "")}</text>
          </g>
        );
      })}
      {caps.map((cp) => {
        const y = capY(cp);
        return (
          <g key={cp}>
            <rect x={COL.cap - BOX_W.cap / 2} y={y - 15} width={BOX_W.cap} height={30} rx={8} fill="var(--panel)" stroke="var(--line-strong)" strokeWidth={1.25} />
            <text x={COL.cap} y={y + 4} textAnchor="middle" className="mono" style={{ fontSize: 11.5, fontWeight: 600, fill: "var(--fg)" }}>{cp}</text>
          </g>
        );
      })}
      {connectors.map((cn) => {
        // A connector is "live" if any capability is bound to it, and healthy only if every such binding is.
        const y = connY(cn), live = bindings.some((b) => b.connector === cn), healthy = bindings.filter((b) => b.connector === cn).every((b) => b.healthy);
        const c = live ? SEM[healthy ? "info" : "crit"].color : "var(--muted)";
        return (
          <g key={cn}>
            <rect x={COL.conn - BOX_W.conn / 2} y={y - 15} width={BOX_W.conn} height={30} rx={8} fill={live ? `color-mix(in srgb, ${c} 10%, var(--panel))` : "var(--panel)"} stroke={c} strokeWidth={1.25} strokeDasharray={live ? undefined : "3 3"} />
            <text x={COL.conn} y={y + 4} textAnchor="middle" className="mono" style={{ fontSize: 12, fontWeight: 600, fill: live ? "var(--fg)" : "var(--fg-muted)" }}>{cn}</text>
          </g>
        );
      })}
    </svg>
  );
}
