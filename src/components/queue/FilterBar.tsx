/**
 * The queue's filter row: free-text search plus five dropdowns, and a reset once anything is set.
 * Reads the current `Filters` and per-option counts from `QueueTable`; reports edits back as
 * partial patches. Owns no state.
 */
"use client";
import { Search, X } from "lucide-react";
import { Select, type Option } from "@/components/ui/Select";
import { capitalize } from "@/lib/semantics";

/** Dropdowns hold "all" or one value; `q` is the free-text filter. Mirrors the queue's URL query string. */
export interface Filters { status: string; lane: string; intent: string; priority: string; channel: string; q: string }
export const EMPTY_FILTERS: Filters = { status: "all", lane: "all", intent: "all", priority: "all", channel: "all", q: "" };

/** Options for one dropdown: an "all" row, then each value with how many rows it would match. */
const withAll = (label: string, values: string[], counts?: Record<string, number>): Option[] => [
  { value: "all", label: `${label}: all` },
  ...values.map((v) => ({ value: v, label: capitalize(v), meta: counts ? String(counts[v] ?? 0) : undefined })),
];

export function FilterBar({ filters, intents, channels, counts, onChange, onReset }: {
  filters: Filters;
  /** Distinct values present in the data, so the dropdowns never offer an empty choice. */
  intents: string[]; channels: string[];
  /** Match counts per value, computed with that dropdown's own filter ignored. */
  counts: { status: Record<string, number>; intent: Record<string, number>; priority: Record<string, number>; channel: Record<string, number> };
  onChange: (patch: Partial<Filters>) => void; onReset: () => void;
}) {
  const active = Object.entries(filters).some(([k, v]) => (k === "q" ? v !== "" : v !== "all"));
  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="relative flex items-center">
        <Search size={13} className="pointer-events-none absolute left-2.5 text-fg-faint" />
        <input value={filters.q} onChange={(e) => onChange({ q: e.target.value })} placeholder="Filter id, customer, company"
          aria-label="Filter by ticket id, customer or company"
          className="w-56 rounded-lg border border-line-strong bg-bg-elev py-1.5 pl-8 pr-7 text-[13px] outline-none placeholder:text-fg-faint focus:border-accent" />
        {filters.q && (
          <button type="button" aria-label="Clear text filter" onClick={() => onChange({ q: "" })} className="absolute right-2 text-fg-faint hover:text-fg"><X size={12} /></button>
        )}
      </label>
      <Select size="sm" value={filters.status} onChange={(v) => onChange({ status: v })} className="w-40"
        options={withAll("Status", ["resolved", "escalated"], counts.status)} />
      <Select size="sm" value={filters.lane} onChange={(v) => onChange({ lane: v })} className="w-32"
        options={[{ value: "all", label: "Lane: all" }, { value: "auto", label: "Auto-resolved" }, { value: "L2", label: "L2" }, { value: "L3", label: "L3" }]} />
      <Select size="sm" value={filters.intent} onChange={(v) => onChange({ intent: v })} className="w-36"
        options={withAll("Intent", intents, counts.intent)} />
      <Select size="sm" value={filters.priority} onChange={(v) => onChange({ priority: v })} className="w-32"
        options={withAll("Priority", ["P1", "P2", "P3", "P4"], counts.priority)} />
      <Select size="sm" value={filters.channel} onChange={(v) => onChange({ channel: v })} className="w-36"
        options={withAll("Channel", channels, counts.channel)} />
      {active && (
        <button type="button" onClick={onReset} className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-fg-muted hover:bg-panel-2 hover:text-fg">
          <X size={12} /> Clear filters
        </button>
      )}
    </div>
  );
}
