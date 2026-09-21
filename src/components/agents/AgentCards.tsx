/**
 * One card per agent in the graph, plus the seven-step walkthrough of how a specialist works.
 * Reads `Meta` (agent registry and settings), `Stats` (load) and the per-agent outcome tallies
 * from `routeOutcomes`. Each card's middle rows depend on the agent's kind.
 */
"use client";
import { motion } from "framer-motion";
import { Panel } from "@/components/ui/Panel";
import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";
import { SEM, agentSem, fmt, type Sem } from "@/lib/semantics";
import type { AgentOutcome } from "@/lib/outcomes";
import type { Agent, Meta, Stats } from "@/lib/types";

const KIND: Record<Agent["kind"], { sem: Sem; label: string; icon: string }> = {
  orchestration: { sem: "accent", label: "orchestration", icon: "Workflow" },
  specialist: { sem: "agent", label: "specialist", icon: "Bot" },
  handoff: { sem: "warn", label: "handoff", icon: "UserRound" },
};
/** Specialist `mode` values the engine reports. */
const MODE: Record<string, { label: string; note: string }> = {
  direct: { label: "Direct extraction", note: "pulls ids from the message, calls the tool itself" },
  llm: { label: "LLM tool calling", note: "asks the model which tool to call, then runs it" },
};
/** Decisions backends the engine reports, with a one-line explanation. */
const DECISIONS: Record<string, string> = {
  jev: "Jev classifier · calibrated probabilities",
  llm: "language model · JSON classification",
  stub: "keyword stub · deterministic",
};
/** Resolution-rate colour bands: ok at or above the first, warn at or above the second, crit below. */
const RATE_OK = 70, RATE_WARN = 40;

const STEPS: { icon: string; title: string; note: string }[] = [
  { icon: "ClipboardList", title: "Record", note: "log the pickup and hop count on the trail" },
  { icon: "Search", title: "Look up", note: "extract ids or ask the model which tool fits" },
  { icon: "PlugZap", title: "Call tool", note: "through safe_call — never a raw connector call" },
  { icon: "ShieldAlert", title: "Handle outcome", note: "ok, not found or tool error decide the next edge" },
  { icon: "Compass", title: "Domain check", note: "is this really my domain? if not, hand back" },
  { icon: "PenLine", title: "Draft + gate", note: "write the reply, score it against resolution_min" },
  { icon: "CheckCheck", title: "Resolve / escalate", note: "close it or package the trail for a person" },
];

function Bar({ value, max, sem }: { value: number; max: number; sem: Sem }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full" style={{ background: "var(--muted-soft)" }}>
      <motion.div className="h-full rounded-full" style={{ background: SEM[sem].color }} initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.7, ease: "easeOut" }} />
    </div>
  );
}

/** Key / value line inside a card. */
function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-t border-line py-2 text-xs">
      <span className="text-fg-muted">{k}</span>
      <span className="min-w-0 text-right font-medium text-fg">{v}</span>
    </div>
  );
}

export function AgentCards({ meta, stats, outcomes }: { meta: Meta; stats: Stats; outcomes: Record<string, AgentOutcome> }) {
  // Bars share one scale so the router (which sees every ticket) is always the full bar.
  const maxLoad = Math.max(stats.total, ...Object.values(stats.agent_load));
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {meta.agents.map((a, i) => {
          const kind = KIND[a.kind], sem = agentSem(a.id);
          // "Load" means something different per kind: tickets routed, handoffs created, or specialist visits.
          const load = a.kind === "orchestration" ? stats.total : a.kind === "handoff" ? stats.escalated : stats.agent_load[a.id] ?? 0;
          const o = outcomes[a.id];
          const rate = o && o.visited > 0 ? Math.round((o.resolved / o.visited) * 100) : null;
          return (
            <motion.div key={a.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <Panel className="h-full">
                <div className="flex items-start gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl" style={{ background: SEM[sem].soft, color: SEM[sem].color }}><Icon name={kind.icon} size={18} /></span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-[15px] font-semibold tracking-tight">{a.name}</h3>
                      <Badge sem={kind.sem} dot={false}>{kind.label}</Badge>
                    </div>
                    <p className="mt-0.5 text-xs text-fg-muted">{a.role}</p>
                  </div>
                </div>

                <div className="mt-4">
                  <div className="flex items-baseline justify-between text-xs">
                    <span className="text-fg-muted">{a.kind === "orchestration" ? "Tickets routed" : a.kind === "handoff" ? "Handoffs created" : "Load · visits"}</span>
                    <span className="num font-semibold text-fg">{fmt(load)}</span>
                  </div>
                  <div className="mt-1.5"><Bar value={load} max={maxLoad} sem={sem} /></div>
                </div>

                <div className="mt-4">
                  {a.kind === "specialist" && (
                    <>
                      <Row k="Mode" v={<span title={MODE[a.mode ?? ""]?.note}>{MODE[a.mode ?? ""]?.label ?? a.mode ?? "—"}</span>} />
                      <Row k="Resolution rate" v={rate === null ? <span className="text-fg-faint">no visits yet</span> :
                        <span className="inline-flex items-center gap-2"><span className="num" style={{ color: rate >= RATE_OK ? SEM.ok.color : rate >= RATE_WARN ? SEM.warn.color : SEM.crit.color }}>{rate}%</span><span className="text-fg-faint">{o.resolved} of {o.visited}</span></span>} />
                      <Row k="Escalated · handed back" v={<span className="num">{o?.escalated ?? 0} · {o?.handedBack ?? 0}</span>} />
                    </>
                  )}
                  {a.kind === "orchestration" && (
                    <>
                      <Row k="Decisions source" v={<span className="inline-flex items-center gap-1.5"><Badge sem="accent" dot={false}>{a.decision ?? meta.decisions}</Badge><span className="hidden text-fg-faint sm:inline">{DECISIONS[a.decision ?? meta.decisions] ?? ""}</span></span>} />
                      <Row k="Confidence threshold" v={<span className="num">≥ {meta.settings.intent_confidence_min.toFixed(2)} <span className="text-fg-faint">else escalate</span></span>} />
                      <Row k="Misroutes corrected" v={<span className="num">{stats.misroutes}</span>} />
                    </>
                  )}
                  {a.kind === "handoff" && (
                    <>
                      <Row k="L2 queue · L3 engineering" v={<span className="num">{stats.by_lane.L2 ?? 0} · {stats.by_lane.L3 ?? 0}</span>} />
                      <Row k="Top reason" v={Object.entries(stats.escalation_reasons).sort((x, y) => y[1] - x[1])[0]?.[0] ?? "—"} />
                      <Row k="Max hops before handoff" v={<span className="num">{meta.settings.max_hops}</span>} />
                    </>
                  )}
                </div>

                <div className="mt-3 border-t border-line pt-3">
                  <div className="eyebrow mb-1.5">Capabilities</div>
                  {a.capabilities.length === 0 ? <span className="text-xs text-fg-faint">none — decides, does not call tools</span> : (
                    <div className="flex flex-wrap gap-1.5">
                      {a.capabilities.map((c) => <span key={c} className="mono rounded-md px-1.5 py-0.5 text-[11px] font-medium" style={{ background: SEM.info.soft, color: SEM.info.color }}>{c}</span>)}
                    </div>
                  )}
                </div>
              </Panel>
            </motion.div>
          );
        })}
      </div>

      <Panel eyebrow="How a specialist works" title="Seven steps, every ticket, every specialist">
        <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
          {STEPS.map((s, i) => (
            <li key={s.title} className="relative rounded-xl border border-line bg-panel-2 p-3">
              <div className="flex items-center gap-2">
                <span className="num grid h-6 w-6 place-items-center rounded-full text-[11px] font-bold text-white" style={{ background: SEM.agent.color }}>{i + 1}</span>
                <Icon name={s.icon} size={15} style={{ color: SEM.agent.color }} />
              </div>
              <div className="mt-2 text-[13px] font-semibold">{s.title}</div>
              <div className="mt-0.5 text-[11px] leading-snug text-fg-muted">{s.note}</div>
              {/* Chevron between cards only when all seven sit in one row. */}
              {i < STEPS.length - 1 && <span className="absolute -right-2 top-1/2 hidden -translate-y-1/2 text-fg-faint xl:block">›</span>}
            </li>
          ))}
        </ol>
        <p className="mt-3 text-xs text-fg-faint">Steps 4, 5 and 6 are the conditional edges: a tool error, a wrong domain or a weak draft each route to a different node.</p>
      </Panel>
    </div>
  );
}
