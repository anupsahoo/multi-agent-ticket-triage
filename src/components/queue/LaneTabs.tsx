/**
 * Lane switcher above the queue table: All / Auto-resolved / L2 / L3, each with a count.
 * Reads the selected lane and counts from `QueueTable`; it is a second control for the same
 * `lane` filter the `FilterBar` dropdown edits.
 */
"use client";
import { SEM, type Sem } from "@/lib/semantics";

const TABS: { value: string; label: string; sem: Sem }[] = [
  { value: "all", label: "All", sem: "accent" },
  { value: "auto", label: "Auto-resolved", sem: "ok" },
  { value: "L2", label: "L2", sem: "warn" },
  { value: "L3", label: "L3", sem: "crit" },
];

export function LaneTabs({ value, counts, onChange }: { value: string; counts: Record<string, number>; onChange: (v: string) => void }) {
  return (
    <div role="tablist" aria-label="Lane" className="flex gap-1 overflow-x-auto border-b border-line">
      {TABS.map((t) => {
        const active = value === t.value;
        return (
          <button key={t.value} role="tab" type="button" aria-selected={active} onClick={() => onChange(t.value)}
            className={`-mb-px flex shrink-0 items-center gap-2 border-b-2 px-3 py-2 text-sm transition ${active ? "font-semibold text-fg" : "text-fg-muted hover:text-fg"}`}
            style={{ borderBottomColor: active ? SEM[t.sem].color : "transparent" }}>
            {t.label}
            <span className="num rounded-full px-1.5 py-0.5 text-[11px] font-semibold" style={{ background: active ? SEM[t.sem].soft : "var(--muted-soft)", color: active ? SEM[t.sem].color : "var(--fg-muted)" }}>
              {counts[t.value] ?? 0}
            </span>
          </button>
        );
      })}
    </div>
  );
}
