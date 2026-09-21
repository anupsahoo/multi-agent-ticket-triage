/**
 * Six desk-level numbers across the top of the command centre.
 * Reads `Stats`; renders one `Stat` tile each. Colour is applied only where the number itself
 * is a signal (open L2/L3, SLA), never as decoration.
 */
"use client";
import { Stat } from "@/components/ui/Stat";
import type { Stats } from "@/lib/types";
import type { Sem } from "@/lib/semantics";

export function KpiRow({ stats }: { stats: Stats }) {
  const tiles: { label: string; value: number | string; suffix?: string; sem?: Sem; hint: string }[] = [
    { label: "Tickets · 7d", value: stats.total, hint: `${stats.resolved} resolved · ${stats.escalated} escalated` },
    { label: "Auto-resolution", value: stats.auto_resolution_rate, suffix: "%", sem: "ok", hint: "closed without a person" },
    { label: "Open L2", value: stats.open_l2, sem: stats.open_l2 > 0 ? "warn" : undefined, hint: "waiting on a desk agent" },
    { label: "Open L3", value: stats.open_l3, sem: stats.open_l3 > 0 ? "crit" : undefined, hint: "with engineering" },
    { label: "SLA breached", value: stats.sla_breached, sem: stats.sla_breached > 0 ? "crit" : "ok", hint: stats.sla_breached > 0 ? "past due right now" : "all within SLA" },
    // Stub backends finish in well under a millisecond, which would otherwise animate to "0 ms".
    { label: "Mean handle time", value: stats.mean_latency_ms < 1 ? "<1" : stats.mean_latency_ms, suffix: "ms", hint: stats.mean_latency_ms < 1 ? "stub models; sub-millisecond" : "orchestrator, end to end" },
  ];
  return (
    <div className="panel grid grid-cols-2 gap-px overflow-hidden bg-line sm:grid-cols-3 xl:grid-cols-6">
      {tiles.map((t) => (
        <div key={t.label} className="bg-panel px-5 py-4">
          <Stat label={t.label} value={t.value} suffix={t.suffix} sem={t.sem} hint={t.hint} size="lg" />
        </div>
      ))}
    </div>
  );
}
