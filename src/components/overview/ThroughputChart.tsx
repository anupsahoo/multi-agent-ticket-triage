/**
 * Stacked bars per day: resolved (ok) under escalated (warn), with a legend of window totals.
 * Reads `Stats["series"]` (one entry per day, oldest first, today last). Renders an SVG that
 * scales to its container via viewBox.
 */
"use client";
import { motion } from "framer-motion";
import { SEM } from "@/lib/semantics";
import type { Stats } from "@/lib/types";

/** Drawing box in SVG units; PAD leaves room for the y-axis labels (l) and day labels (b). */
const W = 640, H = 220, PAD = { t: 18, r: 12, b: 28, l: 34 };
/** Bars never grow past this width, so a short series does not turn into slabs. */
const MAX_BAR_W = 44;

export function ThroughputChart({ series }: { series: Stats["series"] }) {
  const max = Math.max(1, ...series.map((d) => d.total));
  // Tick step grows with the scale so there are never more than about ten grid lines.
  const step = max <= 10 ? 2 : max <= 25 ? 5 : 10;
  const top = Math.ceil(max / step) * step;
  const iw = W - PAD.l - PAD.r, ih = H - PAD.t - PAD.b;
  const slot = iw / Math.max(1, series.length);
  const bw = Math.min(MAX_BAR_W, slot * 0.56);
  const y = (v: number) => PAD.t + ih - (v / top) * ih;
  const ticks = Array.from({ length: top / step + 1 }, (_, i) => i * step);
  const totals = series.reduce((a, d) => ({ r: a.r + d.resolved, e: a.e + d.escalated }), { r: 0, e: 0 });

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-fg-muted">
        <span className="inline-flex items-center gap-1.5"><i className="h-2 w-2 rounded-sm" style={{ background: SEM.ok.color }} /> Resolved by orchestrator <b className="num text-fg">{totals.r}</b></span>
        <span className="inline-flex items-center gap-1.5"><i className="h-2 w-2 rounded-sm" style={{ background: SEM.warn.color }} /> Escalated to a person <b className="num text-fg">{totals.e}</b></span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Tickets per day, resolved versus escalated" className="block">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} stroke="var(--line)" strokeDasharray={t === 0 ? undefined : "2 4"} />
            <text x={PAD.l - 8} y={y(t) + 3.5} textAnchor="end" fontSize="10" fill="var(--fg-faint)" className="num">{t}</text>
          </g>
        ))}
        {series.map((d, i) => {
          const x = PAD.l + slot * i + (slot - bw) / 2;
          const hr = (d.resolved / top) * ih, he = (d.escalated / top) * ih;
          // The escalated bar is drawn from the total down, so it sits on top of the resolved bar.
          const yr = y(d.resolved), ye = y(d.total);
          const isToday = i === series.length - 1;
          return (
            <g key={d.date}>
              <title>{`${d.day} ${d.date}: ${d.total} tickets — ${d.resolved} resolved, ${d.escalated} escalated`}</title>
              <motion.rect x={x} width={bw} rx={3} fill={SEM.ok.color}
                initial={{ y: y(0), height: 0 }} animate={{ y: yr, height: hr }} transition={{ duration: 0.6, delay: i * 0.05, ease: "easeOut" }} />
              <motion.rect x={x} width={bw} rx={3} fill={SEM.warn.color}
                initial={{ y: y(0), height: 0 }} animate={{ y: ye, height: he }} transition={{ duration: 0.6, delay: 0.15 + i * 0.05, ease: "easeOut" }} />
              {d.total > 0 && (
                <motion.text x={x + bw / 2} y={ye - 5} textAnchor="middle" fontSize="10.5" fontWeight={600} fill="var(--fg-muted)" className="num"
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 + i * 0.05 }}>{d.total}</motion.text>
              )}
              <text x={x + bw / 2} y={H - 9} textAnchor="middle" fontSize="11" fontWeight={isToday ? 650 : 500} fill={isToday ? "var(--fg)" : "var(--fg-muted)"}>{isToday ? "Today" : d.day}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
