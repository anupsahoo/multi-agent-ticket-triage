/**
 * Specialist load bars, the misroute count, and which backends are deciding and writing.
 * Reads `Stats` and the optional `Meta` (null when `/api/meta` failed; the backends then read "offline").
 */
"use client";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/Badge";
import { SEM, agentSem, fmt } from "@/lib/semantics";
import type { Meta, Stats } from "@/lib/types";

/** Misroutes above this many in the window turn the count critical rather than a warning. */
const MISROUTE_CRIT = 5;

export function OrchestratorHealth({ stats, meta }: { stats: Stats; meta: Meta | null }) {
  const load = Object.entries(stats.agent_load).sort((a, b) => b[1] - a[1]);
  const total = load.reduce((a, [, n]) => a + n, 0) || 1;
  const max = Math.max(1, ...load.map(([, n]) => n));
  const misrouteSem = stats.misroutes === 0 ? "ok" : stats.misroutes > MISROUTE_CRIT ? "crit" : "warn";
  return (
    <div>
      <div className="eyebrow mb-2">Specialist load</div>
      <ul className="space-y-2">
        {load.map(([agent, n], i) => (
          <li key={agent} className="grid grid-cols-[76px_1fr_auto] items-center gap-3 text-xs">
            <span className="truncate font-medium capitalize">{agent}</span>
            <span className="h-2 overflow-hidden rounded-full bg-panel-2">
              <motion.span className="block h-full rounded-full" style={{ background: SEM[agentSem(agent)].color }}
                initial={{ width: 0 }} animate={{ width: `${(n / max) * 100}%` }} transition={{ duration: 0.6, delay: i * 0.08, ease: "easeOut" }} />
            </span>
            <span className="num w-[68px] text-right text-fg-muted"><b className="text-fg">{fmt(n)}</b> · {Math.round((n / total) * 100)}%</span>
          </li>
        ))}
      </ul>
      <div className="mt-4 grid grid-cols-2 gap-3 border-t border-line pt-4">
        <div>
          <div className="eyebrow">Misroutes</div>
          <div className="num mt-1 text-2xl font-semibold leading-none" style={{ color: SEM[misrouteSem].color }}>{fmt(stats.misroutes)}</div>
          <div className="mt-1 text-xs text-fg-muted">re-routed after a specialist bounced</div>
        </div>
        <div>
          <div className="eyebrow">Backends</div>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            <Badge sem={meta ? "accent" : "muted"} dot={false}>decisions · {meta?.decisions ?? "offline"}</Badge>
            <Badge sem={meta ? "agent" : "muted"} dot={false}>language · {meta?.language ?? "offline"}</Badge>
          </div>
          {meta && <div className="mt-1.5 text-xs text-fg-muted">max {meta.settings.max_hops} hops · confidence ≥ {meta.settings.intent_confidence_min}</div>}
        </div>
      </div>
    </div>
  );
}
