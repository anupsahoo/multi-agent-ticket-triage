/**
 * Compact "billing → technical → human" chips for a ticket's route.
 * Reads `route_history` and `status`; a second specialist chip is a misroute handoff, and an
 * escalated ticket ends in a "human" chip. An empty route means the router escalated directly.
 */
import { ArrowRight } from "lucide-react";
import { agentSem, SEM } from "@/lib/semantics";

export function RouteChips({ history, status }: { history: string[]; status: string }) {
  if (history.length === 0) {
    return <span className="inline-flex items-center gap-1 text-xs text-fg-faint">router <ArrowRight size={11} /> <span style={{ color: SEM.warn.color }}>human</span></span>;
  }
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      {history.map((a, i) => (
        <span key={`${a}-${i}`} className="inline-flex items-center gap-1">
          {i > 0 && <ArrowRight size={11} style={{ color: SEM.warn.color }} />}
          <span className="rounded-md px-1.5 py-0.5 text-[11px] font-semibold" style={{ background: SEM[agentSem(a)].soft, color: SEM[agentSem(a)].color }}>{a}</span>
        </span>
      ))}
      {status === "escalated" && (
        <span className="inline-flex items-center gap-1">
          <ArrowRight size={11} className="text-fg-faint" />
          <span className="rounded-md px-1.5 py-0.5 text-[11px] font-semibold" style={{ background: SEM.warn.soft, color: SEM.warn.color }}>human</span>
        </span>
      )}
    </span>
  );
}
