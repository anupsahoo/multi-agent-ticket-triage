/**
 * Horizontal ranked bars with count and share, largest first.
 * Reads label/value items; bar length is relative to the largest item, share is relative to
 * `total` (or the items' sum). One tone per list.
 */
"use client";
import { motion } from "framer-motion";
import { SEM, fmt, type Sem } from "@/lib/semantics";

export interface RankedItem { label: string; value: number }

export function RankedBars({ items, sem = "accent", total, empty = "Nothing to show" }: {
  items: RankedItem[]; sem?: Sem;
  /** Denominator for the share column when the items do not add up to the whole (e.g. reasons vs all escalations). */
  total?: number;
  /** Text shown when there are no items. */
  empty?: string;
}) {
  const sorted = [...items].sort((a, b) => b.value - a.value);
  const sum = total ?? sorted.reduce((a, i) => a + i.value, 0);
  const max = Math.max(1, ...sorted.map((i) => i.value));
  if (sorted.length === 0) return <div className="py-6 text-center text-xs text-fg-faint">{empty}</div>;
  return (
    <ul className="space-y-2.5">
      {sorted.map((it, i) => (
        <li key={it.label} className="text-xs">
          <div className="mb-1 flex items-baseline justify-between gap-3">
            <span className="truncate font-medium capitalize">{it.label}</span>
            <span className="num shrink-0 text-fg-muted"><b className="text-fg">{fmt(it.value)}</b> · {sum ? Math.round((it.value / sum) * 100) : 0}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-panel-2">
            <motion.div className="h-full rounded-full" style={{ background: SEM[sem].color }}
              initial={{ width: 0 }} animate={{ width: `${(it.value / max) * 100}%` }} transition={{ duration: 0.6, delay: i * 0.06, ease: "easeOut" }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
