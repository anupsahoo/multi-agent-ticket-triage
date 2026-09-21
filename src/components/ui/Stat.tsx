/**
 * Big number with an eyebrow label, optional suffix, tone and hint.
 * Reads props only. Numeric values count up from zero on mount; strings render as-is.
 */
"use client";
import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import { useEffect } from "react";
import { SEM, fmt, type Sem } from "@/lib/semantics";

export function Stat({ label, value, suffix = "", sem, hint, size = "lg" }: {
  label: string;
  /** A number animates; a string (e.g. "<1") is shown verbatim. */
  value: number | string;
  suffix?: string;
  /** Colour only when the number itself is a signal; default is the plain foreground. */
  sem?: Sem;
  hint?: string;
  size?: "md" | "lg";
}) {
  const isNum = typeof value === "number";
  const mv = useMotionValue(0);
  const rounded = useTransform(mv, (v) => fmt(Math.round(v)));
  useEffect(() => { if (isNum) { const c = animate(mv, value as number, { duration: 0.8, ease: "easeOut" }); return () => c.stop(); } }, [isNum, value, mv]);
  return (
    <div className="min-w-0">
      <div className="eyebrow">{label}</div>
      <div className={`num mt-1 whitespace-nowrap font-semibold leading-none ${size === "lg" ? "text-3xl" : "text-2xl"}`} style={{ color: sem ? SEM[sem].color : "var(--fg)" }}>
        {isNum ? <motion.span>{rounded}</motion.span> : value}{suffix && <span className="ml-0.5 text-[0.55em] font-medium text-fg-muted">{suffix}</span>}
      </div>
      {hint && <div className="mt-1 text-xs text-fg-muted">{hint}</div>}
    </div>
  );
}
