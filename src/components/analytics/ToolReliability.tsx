/**
 * One row per tool: a split ok/failed bar, the counts, and a success-rate badge.
 * Reads `Stats["tools"]`; rows with failures sort first so problems are at the top.
 */
"use client";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/Badge";
import { SEM, fmt } from "@/lib/semantics";
import type { Stats } from "@/lib/types";

/** A tool with failures is a warning down to this success rate, and critical below it. */
const RATE_WARN = 70;

export function ToolReliability({ tools }: { tools: Stats["tools"] }) {
  const rows = [...tools].sort((a, b) => b.failed - a.failed || b.calls - a.calls);
  const max = Math.max(1, ...rows.map((t) => t.calls));
  if (rows.length === 0) return <div className="py-6 text-center text-xs text-fg-faint">No tool calls recorded.</div>;
  return (
    // Negative margins let the table run to the panel edge and share its bottom padding.
    <div className="-mx-5 -mb-5 overflow-x-auto">
      <table className="w-full min-w-[520px] border-collapse text-xs">
        <thead>
          <tr className="border-y border-line bg-panel-2 text-[11px] uppercase tracking-[0.1em] text-fg-muted">
            <th className="px-5 py-2 text-left font-semibold">Tool</th>
            <th className="w-[38%] py-2 pr-4 text-left font-semibold">ok vs failed</th>
            <th className="num py-2 pr-4 text-right font-semibold">Calls</th>
            <th className="num py-2 pr-4 text-right font-semibold">ok</th>
            <th className="num py-2 pr-4 text-right font-semibold">Failed</th>
            <th className="num py-2 pr-5 text-right font-semibold">Success</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((t, i) => {
            const rate = t.calls ? Math.round((t.ok / t.calls) * 100) : 0;
            const sem = t.failed === 0 ? "ok" : rate >= RATE_WARN ? "warn" : "crit";
            return (
              <tr key={t.name} className="border-b border-line last:border-b-0 hover:bg-panel-2">
                <td className="px-5 py-2.5"><span className="mono font-medium">{t.name}</span></td>
                <td className="py-2.5 pr-4">
                  {/* Bar width is the tool's share of the busiest tool; the fill splits it ok / failed. */}
                  <div className="flex h-2 overflow-hidden rounded-full bg-panel-2" style={{ width: `${(t.calls / max) * 100}%`, minWidth: 24 }}>
                    <motion.span className="h-full" style={{ background: SEM.ok.color }} initial={{ width: 0 }} animate={{ width: `${(t.ok / t.calls) * 100}%` }} transition={{ duration: 0.6, delay: i * 0.06, ease: "easeOut" }} />
                    <motion.span className="h-full" style={{ background: SEM.crit.color }} initial={{ width: 0 }} animate={{ width: `${(t.failed / t.calls) * 100}%` }} transition={{ duration: 0.6, delay: 0.1 + i * 0.06, ease: "easeOut" }} />
                  </div>
                </td>
                <td className="num py-2.5 pr-4 text-right text-fg-muted">{fmt(t.calls)}</td>
                <td className="num py-2.5 pr-4 text-right" style={{ color: SEM.ok.color }}>{fmt(t.ok)}</td>
                <td className="num py-2.5 pr-4 text-right font-semibold" style={{ color: t.failed > 0 ? SEM.crit.color : "var(--fg-faint)" }}>{fmt(t.failed)}</td>
                <td className="py-2.5 pr-5 text-right"><Badge sem={sem} dot={false}>{rate}%</Badge></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
