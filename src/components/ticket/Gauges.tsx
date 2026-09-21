/**
 * The three decision checks the orchestrator must clear before it may answer, as ring gauges.
 * Reads `Gauge[]` built by the ticket page (value from the ticket or its trail, threshold from
 * settings). A null value means the run ended before that check and renders as a dash.
 */
"use client";
import { motion } from "framer-motion";
import { SEM, type Sem } from "@/lib/semantics";

export interface Gauge {
  label: string;
  /** 0..1 score, or null when the run never reached this check. */
  value: number | null;
  /** The gate from settings; at or above passes. */
  threshold: number;
  /** Which agent makes the check. */
  hint: string;
}

/** Ring geometry: 68px box, radius 26 leaves room for the 6px stroke. */
const BOX = 68, R = 26, C = 2 * Math.PI * R;

function Ring({ g, i }: { g: Gauge; i: number }) {
  const v = g.value === null ? 0 : Math.max(0, Math.min(1, g.value));
  const sem: Sem = g.value === null ? "muted" : g.value >= g.threshold ? "ok" : "crit";
  return (
    <div className="flex min-w-0 flex-col items-center gap-1.5 text-center">
      <div className="relative h-[68px] w-[68px]">
        <svg viewBox={`0 0 ${BOX} ${BOX}`} width="100%" height="100%" aria-hidden>
          <circle cx={BOX / 2} cy={BOX / 2} r={R} fill="none" stroke="var(--line)" strokeWidth="6" />
          {/* Arc starts at 12 o'clock (rotate -90) and reveals by shrinking the dash offset. */}
          <motion.circle cx={BOX / 2} cy={BOX / 2} r={R} fill="none" stroke={SEM[sem].color} strokeWidth="6" strokeLinecap="round"
            strokeDasharray={C} initial={{ strokeDashoffset: C }} animate={{ strokeDashoffset: C * (1 - v) }}
            transition={{ duration: 0.8, delay: 0.1 * i, ease: "easeOut" }} transform={`rotate(-90 ${BOX / 2} ${BOX / 2})`} />
          {/* Threshold tick, rotated to the same angle the arc reaches at the gate. */}
          <line x1={BOX / 2} y1="4" x2={BOX / 2} y2="10" stroke="var(--fg-faint)" strokeWidth="2" strokeLinecap="round"
            transform={`rotate(${g.threshold * 360} ${BOX / 2} ${BOX / 2})`} />
        </svg>
        <div className="num absolute inset-0 grid place-items-center text-[13px] font-semibold" style={{ color: SEM[sem].color }}>
          {g.value === null ? "—" : g.value.toFixed(2)}
        </div>
      </div>
      <div className="text-xs font-medium leading-tight">{g.label}</div>
      <div className="text-[11px] leading-tight text-fg-faint">
        {g.value === null ? "not reached" : g.value >= g.threshold ? `pass · min ${g.threshold.toFixed(2)}` : `below ${g.threshold.toFixed(2)}`}
      </div>
    </div>
  );
}

export function Gauges({ gauges }: { gauges: Gauge[] }) {
  return (
    <div>
      <div className="grid grid-cols-3 gap-2">
        {gauges.map((g, i) => <Ring key={g.label} g={g} i={i} />)}
      </div>
      <p className="mt-3 text-[11px] leading-snug text-fg-faint">
        Each check must clear its threshold (tick mark) or the ticket goes to a person. A dash means the run ended before that check.
      </p>
    </div>
  );
}
