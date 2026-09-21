/**
 * Every trail line in order, as a vertical timeline coloured by the agent that wrote it.
 * Reads the ticket's `trail`; tool-call lines render as a code chip with an ok/error badge,
 * and escalation lines are emphasised in the warning tone.
 */
"use client";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/Badge";
import { agentSem, SEM } from "@/lib/semantics";
import { parseTrail } from "./parse";

export function Timeline({ trail }: { trail: string[] }) {
  if (trail.length === 0) return <div className="text-sm text-fg-muted">No trail recorded.</div>;
  return (
    <ol className="relative ml-2 border-l border-line pl-5">
      {trail.map((line, i) => {
        const p = parseTrail(line);
        const sem = p.escalation ? "warn" : agentSem(p.agent);
        return (
          <motion.li key={i} initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.25, delay: 0.05 * i }} className="relative pb-4 last:pb-0">
            {/* Dot centred on the list's left border; the ring masks the border behind it. */}
            <span className="absolute -left-[25px] top-1.5 h-2.5 w-2.5 rounded-full ring-4 ring-panel" style={{ background: SEM[sem].color }} />
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: SEM[sem].color }}>{p.agent}</span>
              <span className="num text-[11px] text-fg-faint">#{i + 1}</span>
            </div>
            {p.tool ? (
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <code className="mono max-w-full break-all rounded-md px-1.5 py-0.5 text-[11.5px]" style={{ background: SEM.info.soft, color: SEM.info.color }}>{p.tool.call}</code>
                <Badge sem={p.tool.ok ? "ok" : "crit"} dot={false}>{p.tool.ok ? p.tool.outcome : "error"}</Badge>
                {!p.tool.ok && <span className="text-xs text-fg-muted">{p.tool.outcome.replace(/^error=?/i, "")}</span>}
              </div>
            ) : (
              <div className={`mt-0.5 text-[13px] leading-snug ${p.escalation ? "font-medium" : ""}`} style={{ color: p.escalation ? SEM.warn.color : "var(--fg)" }}>{p.text}</div>
            )}
          </motion.li>
        );
      })}
    </ol>
  );
}
