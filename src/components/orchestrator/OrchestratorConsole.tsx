/**
 * The Orchestrator page body: headline stats, the system graph with live counts, and a
 * step-by-step replay of one recent ticket with its trail appearing beside it.
 * Reads props only (stats, the 20 most recent tickets, per-specialist outcomes); the replay
 * state is local. Renders `SystemGraph` plus the picker, step strip and trail panel.
 */
"use client";
import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Play, RotateCcw, GitBranch } from "lucide-react";
import { Panel } from "@/components/ui/Panel";
import { Badge } from "@/components/ui/Badge";
import { Select } from "@/components/ui/Select";
import { Stat } from "@/components/ui/Stat";
import { SEM, agentSem, statusLabel, statusSem, trailAgent, trailText, type Sem } from "@/lib/semantics";
import type { AgentOutcome } from "@/lib/outcomes";
import type { Stats, Ticket } from "@/lib/types";
import { SystemGraph } from "./SystemGraph";
import { SPECIALISTS, buildSteps, type NodeId } from "./graph";

/** Replay cadence. Long enough to read a node's trail lines before the next lights up. */
const STEP_MS = 700;
/** Picker labels are truncated so the dropdown stays one line wide. */
const PICKER_MESSAGE_CHARS = 44;

const LEGEND: { sem: Sem; label: string; note: string }[] = [
  { sem: "accent", label: "Router", note: "classifies intent" },
  { sem: "agent", label: "Specialist", note: "tool call + checks" },
  { sem: "ok", label: "Resolved", note: "auto, no person" },
  { sem: "warn", label: "Escalation / L2", note: "needs a person" },
  { sem: "crit", label: "L3", note: "engineering" },
];

const trunc = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s);

/** Tone for a graph node in the step strip; specialists share the agent tone. */
const nodeSem = (node: NodeId): Sem =>
  node === "ticket" ? "muted" : node === "L3" ? "crit" : node === "L2" || node === "escalation" ? "warn" : node === "resolved" ? "ok" : agentSem(node);

export function OrchestratorConsole({ stats, recent, flow, misroutes }: {
  stats: Stats;
  /** Newest first; the replay picker offers exactly these. */
  recent: Ticket[];
  /** Per-specialist outcomes, keyed by specialist id, for the edge labels out of each specialist. */
  flow: Record<string, AgentOutcome>;
  misroutes: number;
}) {
  // Prefer a misrouted ticket as the default: it exercises the handoff edge, which is the interesting one.
  const defaultId = useMemo(() => recent.find((t) => t.route_history.length === 2)?.ticket_id ?? recent[0]?.ticket_id ?? "", [recent]);
  const [selected, setSelected] = useState(defaultId);
  const [run, setRun] = useState(0);
  const [step, setStep] = useState(-1);

  const ticket = recent.find((t) => t.ticket_id === selected) ?? null;
  const steps = useMemo(() => (ticket ? buildSteps(ticket) : []), [ticket]);

  // Advance one step per tick; `run` is bumped to restart the same ticket from the top.
  useEffect(() => {
    if (steps.length === 0) return;
    let i = -1;
    const id = setInterval(() => {
      i += 1;
      setStep(i);
      if (i >= steps.length - 1) clearInterval(id);
    }, STEP_MS);
    return () => clearInterval(id);
  }, [run, selected, steps.length]);

  const restart = () => { setStep(-1); setRun((r) => r + 1); };
  const choose = (v: string) => { setSelected(v); setStep(-1); setRun((r) => r + 1); };

  const activeNodes = new Set<NodeId>(), activeEdges = new Set<string>();
  steps.slice(0, step + 1).forEach((s) => { activeNodes.add(s.node); if (s.edge) activeEdges.add(s.edge); });
  const current = step >= 0 && step < steps.length ? steps[step].node : null;
  const shownLines = steps.slice(0, step + 1).flatMap((s) => s.lines);
  const trail = ticket?.trail ?? [];
  const done = step >= steps.length - 1 && steps.length > 0;

  // Edge labels, keyed like graph.ts edge ids. Desk-wide, not per replay.
  const counts: Record<string, number | undefined> = {
    "ticket>router": stats.total,
    "router>escalation": stats.escalation_reasons["low confidence"] ?? 0,
    "escalation>L2": stats.by_lane.L2 ?? 0, "escalation>L3": stats.by_lane.L3 ?? 0,
  };
  for (const s of SPECIALISTS) {
    counts[`router>${s}`] = stats.agent_load[s] ?? 0;
    counts[`${s}>resolved`] = flow[s]?.resolved ?? 0;
    counts[`${s}>escalation`] = flow[s]?.escalated ?? 0;
    counts[`${s}>router`] = flow[s]?.handedBack ?? 0;
  }
  const nodeCounts = {
    ticket: `${stats.total} in`, router: `${stats.total} routed`,
    billing: `${stats.agent_load.billing ?? 0} visits`, technical: `${stats.agent_load.technical ?? 0} visits`, general: `${stats.agent_load.general ?? 0} visits`,
    resolved: `${stats.resolved} · ${stats.auto_resolution_rate}%`, escalation: `${stats.escalated} handed off`,
    L2: `${stats.open_l2} open`, L3: `${stats.open_l3} open`,
  };

  const options = recent.map((t) => ({
    value: t.ticket_id, label: `${t.ticket_id} · ${trunc(t.message, PICKER_MESSAGE_CHARS)}`,
    meta: t.status === "resolved" ? "resolved" : t.status === "escalated" ? `→ ${t.lane}` : "open",
    detail: t.route_history.length === 2 ? `misroute: ${t.route_history.join(" → ")}` : t.route_history.length === 0 ? "router escalated directly" : t.route_history.join(" → "),
  }));

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
      <div className="flex min-w-0 flex-col gap-4">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Panel className="p-4!"><Stat size="md" label="Tickets routed" value={stats.total} /></Panel>
          <Panel className="p-4!"><Stat size="md" label="Auto-resolved" value={stats.auto_resolution_rate} suffix="%" sem="ok" hint={`${stats.resolved} tickets`} /></Panel>
          <Panel className="p-4!"><Stat size="md" label="Handed to a person" value={stats.escalated} sem="warn" hint={`L2 ${stats.by_lane.L2 ?? 0} · L3 ${stats.by_lane.L3 ?? 0}`} /></Panel>
          <Panel className="p-4!"><Stat size="md" label="Misroutes corrected" value={misroutes} sem="agent" hint="specialist handed back" /></Panel>
        </div>

        <Panel eyebrow="System graph" title="How a ticket moves through the agents"
          right={<div className="hidden flex-wrap justify-end gap-x-3 gap-y-1 sm:flex">
            {LEGEND.map((l) => <span key={l.label} className="inline-flex items-center gap-1.5 text-[11px] text-fg-muted"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: SEM[l.sem].color }} />{l.label}</span>)}
          </div>}>
          <SystemGraph counts={counts} nodeCounts={nodeCounts} activeNodes={activeNodes} activeEdges={activeEdges} current={current} />
          <div className="mt-2 flex flex-wrap items-start gap-x-4 gap-y-2 border-t border-line pt-3 text-xs text-fg-muted">
            <span className="inline-flex items-center gap-1.5"><GitBranch size={13} style={{ color: SEM.accent.color }} /><span>Every arrow is a <b className="text-fg">LangGraph conditional edge</b>: the router and each specialist return a decision and the graph follows it. No prompt decides where a ticket goes.</span></span>
            <span className="ml-auto text-fg-faint">Edge labels are counts across all {stats.total} tickets · dashed edges are handoffs back to the router</span>
          </div>
          {/* Legend with notes, for narrow screens where the header legend is hidden. */}
          <div className="mt-3 grid grid-cols-2 gap-2 sm:hidden">
            {LEGEND.map((l) => <span key={l.label} className="inline-flex items-center gap-1.5 text-[11px] text-fg-muted"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: SEM[l.sem].color }} />{l.label} <span className="text-fg-faint">· {l.note}</span></span>)}
          </div>
        </Panel>

        <Panel eyebrow="Replay a ticket" title="Pick one of the 20 most recent tickets and watch its route"
          right={<Badge sem={done ? "ok" : "accent"} dot={!done} className={done ? "" : "pulse-dot"}>{done ? "Replayed" : step < 0 ? "Starting" : `Step ${step + 1} / ${steps.length}`}</Badge>}>
          <div className="flex flex-col gap-3 md:flex-row md:items-end">
            <Select label="Ticket" value={selected} options={options} onChange={choose} className="min-w-0 flex-1" />
            <button type="button" onClick={restart} className="flex h-[38px] shrink-0 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold text-white" style={{ background: "var(--accent)" }}>
              {done ? <RotateCcw size={14} /> : <Play size={14} />} Replay
            </button>
          </div>
          {ticket && (
            <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
              <div className="min-w-0">
                <div className="truncate text-sm text-fg">“{ticket.message}”</div>
                <div className="mt-1 text-xs text-fg-muted">{ticket.customer} · {ticket.company} · {ticket.channel} · {ticket.priority}</div>
              </div>
              <div className="flex flex-wrap items-center gap-1.5 sm:justify-end">
                <Badge sem={agentSem(ticket.intent)}>{ticket.intent} · {Math.round(ticket.confidence * 100)}%</Badge>
                <Badge sem={ticket.route_history.length === 2 ? "warn" : "muted"} dot={false}>{ticket.hops} hop{ticket.hops === 1 ? "" : "s"}</Badge>
                <Badge sem={statusSem(ticket.status)}>{statusLabel(ticket)}</Badge>
              </div>
            </div>
          )}
          {steps.length > 0 && (
            <ol className="mt-4 flex flex-wrap items-center gap-1.5">
              {steps.map((s, i) => {
                const sem = nodeSem(s.node);
                const on = i <= step;
                return (
                  <li key={i} className="flex items-center gap-1.5">
                    <span className="rounded-md px-2 py-0.5 text-[11px] font-semibold transition"
                      style={{ background: on ? SEM[sem].soft : "var(--panel-2)", color: on ? SEM[sem].color : "var(--fg-faint)", outline: i === step ? `1.5px solid ${SEM[sem].color}` : undefined }}>
                      {s.node}
                    </span>
                    {i < steps.length - 1 && <span className="text-fg-faint">›</span>}
                  </li>
                );
              })}
            </ol>
          )}
        </Panel>
      </div>

      <Panel eyebrow="Trail" title={ticket ? `${ticket.ticket_id} · what each agent wrote` : "Trail"} className="xl:sticky xl:top-20 xl:self-start" padded={false}>
        <div className="max-h-[640px] overflow-y-auto px-3 pb-4">
          {!ticket && <div className="px-2 py-10 text-center text-sm text-fg-faint">Select a ticket to replay its trail.</div>}
          {ticket && shownLines.length === 0 && <div className="px-2 py-10 text-center text-sm text-fg-faint">Ticket received · waiting for the router…</div>}
          <ol className="flex flex-col gap-1">
            <AnimatePresence initial={false}>
              {shownLines.map((li) => {
                const line = trail[li], agent = trailAgent(line), sem = agentSem(agent);
                // Stagger only the lines of the step that just lit up; earlier lines are already on screen.
                const k = current ? steps[step].lines.indexOf(li) : -1;
                return (
                  <motion.li key={li} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.25, delay: k > 0 ? Math.min(k * 0.12, STEP_MS / 1000 - 0.2) : 0 }}
                    className="grid grid-cols-[6px_1fr] gap-2 rounded-lg px-2 py-1.5 hover:bg-panel-2">
                    <span className="mt-1.5 h-2.5 w-1.5 rounded-full" style={{ background: SEM[sem].color }} />
                    <span className="min-w-0">
                      <span className="mono text-[11px] font-semibold" style={{ color: SEM[sem].color }}>{agent}</span>
                      <span className="mono block break-words text-[12px] leading-snug text-fg">{trailText(line)}</span>
                    </span>
                  </motion.li>
                );
              })}
            </AnimatePresence>
          </ol>
          {ticket && done && (
            <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="mt-3 rounded-lg border px-3 py-2 text-xs"
              style={{ borderColor: SEM[statusSem(ticket.status)].color, background: SEM[statusSem(ticket.status)].soft }}>
              <div className="font-semibold" style={{ color: SEM[statusSem(ticket.status)].color }}>{statusLabel(ticket)}{ticket.handoff_ref ? ` · ${ticket.handoff_ref}` : ""}</div>
              <div className="mt-0.5 text-fg">{ticket.resolution ?? ticket.escalation_reason ?? "—"}</div>
            </motion.div>
          )}
        </div>
      </Panel>
    </div>
  );
}
