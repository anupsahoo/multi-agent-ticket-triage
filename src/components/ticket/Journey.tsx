/**
 * The ticket's path as a horizontal chain: router → specialist(s) → resolved or human.
 * Reads the ticket's intent, confidence, route history, status, lane and assignee. A second
 * specialist is drawn with a dashed "handoff" connector, since it means the first bounced it.
 */
"use client";
import { motion } from "framer-motion";
import { ArrowRight, Bot, CheckCircle2, Radar, UserRound } from "lucide-react";
import type { Ticket } from "@/lib/types";
import { agentSem, SEM, type Sem } from "@/lib/semantics";

interface Step {
  key: string; label: string; sub: string; sem: Sem; icon: React.ReactNode;
  /** The connector into this step is a handoff from the previous specialist. */
  handoff?: boolean;
}

export function Journey({ ticket: t }: { ticket: Ticket }) {
  const steps: Step[] = [
    { key: "router", label: "Router", sub: `${t.intent} · ${t.confidence.toFixed(2)}`, sem: "accent", icon: <Radar size={14} /> },
    ...t.route_history.map<Step>((a, i) => ({
      key: `${a}-${i}`, label: a, sub: `hop ${i + 1}`, sem: agentSem(a), icon: <Bot size={14} />, handoff: i > 0,
    })),
    t.status === "resolved"
      ? { key: "end", label: "Resolved", sub: "auto", sem: "ok", icon: <CheckCircle2 size={14} /> }
      : { key: "end", label: `Human · ${t.lane}`, sub: t.assignee, sem: t.lane === "L3" ? "crit" : "warn", icon: <UserRound size={14} /> },
  ];
  return (
    <ol className="flex items-stretch gap-0 overflow-x-auto pb-1">
      {steps.map((s, i) => (
        <li key={s.key} className="flex shrink-0 items-center">
          {i > 0 && (
            <div className="flex w-14 flex-col items-center justify-center gap-0.5 md:w-20">
              {s.handoff && <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: SEM.warn.color }}>handoff</span>}
              <motion.div initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 0.35, delay: 0.12 * i }} style={{ originX: 0 }} className="flex w-full items-center">
                <span className="h-px flex-1" style={{ background: s.handoff ? SEM.warn.color : "var(--line-strong)", borderTop: s.handoff ? `1px dashed ${SEM.warn.color}` : undefined }} />
                <ArrowRight size={12} style={{ color: s.handoff ? SEM.warn.color : "var(--fg-faint)" }} className="-ml-1" />
              </motion.div>
              {s.handoff && <span className="text-[10px] text-fg-faint">not my domain</span>}
            </div>
          )}
          <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.12 * i }}
            className="flex min-w-[110px] items-center gap-2.5 rounded-xl border px-3 py-2" style={{ borderColor: "var(--line)", background: "var(--panel-2)" }}>
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg" style={{ background: SEM[s.sem].soft, color: SEM[s.sem].color }}>{s.icon}</span>
            <span className="min-w-0">
              <span className="block truncate text-[13px] font-semibold capitalize leading-tight">{s.label}</span>
              <span className="num block truncate text-[11px] text-fg-muted">{s.sub}</span>
            </span>
          </motion.div>
        </li>
      ))}
    </ol>
  );
}
