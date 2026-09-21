/**
 * Daily auto-resolution rate as a line with an area fill, against the window mean.
 * Reads `Stats["series"]` and the mean rate; computes each day's rate as resolved / total
 * (0 for an empty day) and reports the change from the first day to today.
 */
"use client";
import { motion } from "framer-motion";
import { SEM } from "@/lib/semantics";
import type { Stats } from "@/lib/types";

/** Drawing box in SVG units; PAD leaves room for the percentage axis (l) and day labels (b). */
const W = 640, H = 200, PAD = { t: 22, r: 16, b: 28, l: 38 };
const Y_TICKS = [0, 25, 50, 75, 100];

export function TrendLine({ series, mean }: { series: Stats["series"]; mean: number }) {
  const pts = series.map((d) => ({ ...d, rate: d.total ? (d.resolved / d.total) * 100 : 0 }));
  const iw = W - PAD.l - PAD.r, ih = H - PAD.t - PAD.b;
  // A single point sits in the middle rather than dividing by zero.
  const x = (i: number) => PAD.l + (pts.length > 1 ? (i / (pts.length - 1)) * iw : iw / 2);
  const y = (v: number) => PAD.t + ih - (v / 100) * ih;
  const path = pts.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.rate).toFixed(1)}`).join(" ");
  const area = `${path} L${x(pts.length - 1).toFixed(1)},${y(0)} L${x(0).toFixed(1)},${y(0)} Z`;
  const first = pts[0]?.rate ?? 0, last = pts[pts.length - 1]?.rate ?? 0;
  const delta = Math.round(last - first);
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-fg-muted">
        <span className="inline-flex items-center gap-1.5"><i className="h-0.5 w-3 rounded" style={{ background: SEM.ok.color }} /> Daily auto-resolution rate</span>
        <span className="inline-flex items-center gap-1.5"><i className="h-0 w-3 border-t border-dashed border-fg-faint" /> 7-day mean <b className="num text-fg">{mean}%</b></span>
        <span className="num ml-auto">{delta === 0 ? "flat" : `${delta > 0 ? "+" : ""}${delta} pts`} vs {pts[0]?.day ?? "start"}</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Auto-resolution rate over the last 7 days" className="block">
        <defs>
          <linearGradient id="trend-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor={SEM.ok.color} stopOpacity={0.18} />
            <stop offset="1" stopColor={SEM.ok.color} stopOpacity={0} />
          </linearGradient>
        </defs>
        {Y_TICKS.map((t) => (
          <g key={t}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} stroke="var(--line)" strokeDasharray={t === 0 ? undefined : "2 4"} />
            <text x={PAD.l - 8} y={y(t) + 3.5} textAnchor="end" fontSize="10" fill="var(--fg-faint)" className="num">{t}%</text>
          </g>
        ))}
        <line x1={PAD.l} x2={W - PAD.r} y1={y(mean)} y2={y(mean)} stroke="var(--fg-faint)" strokeDasharray="4 4" />
        <motion.path d={area} fill="url(#trend-fill)" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5, duration: 0.5 }} />
        <motion.path d={path} fill="none" stroke={SEM.ok.color} strokeWidth={2.25} strokeLinejoin="round" strokeLinecap="round"
          initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.9, ease: "easeOut" }} />
        {pts.map((p, i) => (
          <g key={p.date}>
            <title>{`${p.day} ${p.date}: ${Math.round(p.rate)}% (${p.resolved}/${p.total})`}</title>
            {/* transformOrigin at the point itself so the scale-in grows from the dot, not the SVG origin. */}
            <motion.circle cx={x(i)} cy={y(p.rate)} r={3.5} fill="var(--panel)" stroke={SEM.ok.color} strokeWidth={2}
              initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.15 + i * 0.1 }} style={{ transformOrigin: `${x(i)}px ${y(p.rate)}px` }} />
            <motion.text x={x(i)} y={y(p.rate) - 9} textAnchor="middle" fontSize="10.5" fontWeight={600} fill="var(--fg-muted)" className="num"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 + i * 0.08 }}>{Math.round(p.rate)}%</motion.text>
            <text x={x(i)} y={H - 9} textAnchor="middle" fontSize="11" fontWeight={i === pts.length - 1 ? 650 : 500} fill={i === pts.length - 1 ? "var(--fg)" : "var(--fg-muted)"}>{i === pts.length - 1 ? "Today" : p.day}</text>
          </g>
        ))}
      </svg>
    </div>
  );
}
