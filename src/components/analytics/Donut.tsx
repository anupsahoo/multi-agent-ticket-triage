/**
 * Donut with a headline in the hole and a legend beside it.
 * Reads slices (label, value, tone) and draws each as an arc of one circle, offset by the
 * slices before it; the legend shows each slice's count and share.
 */
"use client";
import { motion } from "framer-motion";
import { SEM, fmt, type Sem } from "@/lib/semantics";

export interface Slice { label: string; value: number; sem: Sem; hint?: string }

/** Rendered size in px; the SVG is drawn in a 100-unit box and scaled. */
const SIZE = 150;
/** Radius 40 with a 12-unit stroke fills the box without clipping. */
const R = 40, C = 2 * Math.PI * R;

export function Donut({ slices, centre, centreLabel }: { slices: Slice[]; centre: string; centreLabel: string }) {
  const total = slices.reduce((a, s) => a + s.value, 0) || 1;
  // Each arc starts where the previous one ended (offset is a fraction of the full turn).
  const arcs = slices.reduce<(Slice & { frac: number; offset: number })[]>((out, s) => {
    const prev = out[out.length - 1];
    const offset = prev ? prev.offset + prev.frac : 0;
    return [...out, { ...s, frac: s.value / total, offset }];
  }, []);
  return (
    <div className="flex flex-wrap items-center gap-6">
      <div className="relative shrink-0" style={{ width: SIZE, height: SIZE }}>
        {/* -rotate-90 puts the first arc's start at 12 o'clock. */}
        <svg viewBox="0 0 100 100" width={SIZE} height={SIZE} role="img" aria-label={slices.map((s) => `${s.label} ${s.value}`).join(", ")} className="-rotate-90">
          <circle cx={50} cy={50} r={R} fill="none" stroke="var(--panel-2)" strokeWidth={12} />
          {arcs.map((a, i) => a.value > 0 && (
            <motion.circle key={a.label} cx={50} cy={50} r={R} fill="none" stroke={SEM[a.sem].color} strokeWidth={12} strokeLinecap="butt"
              strokeDasharray={C} initial={{ strokeDashoffset: C }} animate={{ strokeDashoffset: C * (1 - a.frac) }}
              transition={{ duration: 0.7, delay: 0.1 + i * 0.12, ease: "easeOut" }}
              transform={`rotate(${a.offset * 360} 50 50)`} />
          ))}
        </svg>
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
          <div>
            <div className="num text-2xl font-semibold leading-none">{centre}</div>
            <div className="mt-1 text-[10px] uppercase tracking-[0.12em] text-fg-muted">{centreLabel}</div>
          </div>
        </div>
      </div>
      <ul className="min-w-0 flex-1 space-y-2">
        {slices.map((s) => (
          <li key={s.label} className="flex items-center gap-2.5 text-xs">
            <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: SEM[s.sem].color }} />
            <span className="min-w-0 flex-1">
              <span className="block font-medium">{s.label}</span>
              {s.hint && <span className="block truncate text-fg-faint">{s.hint}</span>}
            </span>
            <span className="num shrink-0 text-fg-muted"><b className="text-fg">{fmt(s.value)}</b> · {Math.round((s.value / total) * 100)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
