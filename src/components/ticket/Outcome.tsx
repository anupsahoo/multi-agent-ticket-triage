/**
 * How the ticket ended: the orchestrator's resolution text, or why it was escalated plus
 * what a person should do next (derived from the escalation reason by `nextStep`).
 * Reads status, resolution, escalation_reason, handoff_ref, lane and assignee.
 */
import { CheckCircle2, Hand, LifeBuoy } from "lucide-react";
import type { Ticket } from "@/lib/types";
import { SEM } from "@/lib/semantics";
import { nextStep } from "./parse";

export function Outcome({ ticket: t }: { ticket: Ticket }) {
  if (t.status === "resolved") {
    return (
      <div className="rounded-xl border p-3" style={{ borderColor: "transparent", background: SEM.ok.soft }}>
        <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider" style={{ color: SEM.ok.color }}><CheckCircle2 size={13} /> Resolved automatically</div>
        <p className="mt-1.5 text-[13px] leading-relaxed text-fg">{t.resolution ?? "—"}</p>
        <div className="mt-2 text-[11px] text-fg-muted">Nothing for a person to do. Reprocess if the customer replies that this did not help.</div>
      </div>
    );
  }
  const step = nextStep(t);
  const sem = t.lane === "L3" ? SEM.crit : SEM.warn;
  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-xl border p-3" style={{ borderColor: "transparent", background: sem.soft }}>
        <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider" style={{ color: sem.color }}><Hand size={13} /> Handed to {t.lane}</div>
        <p className="mt-1.5 text-[13px] leading-relaxed text-fg">{t.escalation_reason ?? "No reason recorded."}</p>
        {t.handoff_ref && <div className="mono mt-2 text-[11px] text-fg-muted">ref {t.handoff_ref}</div>}
      </div>
      <div className="rounded-xl border border-line bg-panel-2 p-3">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-fg-muted"><LifeBuoy size={13} /> What a person should do next</div>
        <div className="mt-1.5 text-[13px] font-semibold">{step.title}</div>
        <p className="mt-1 text-[12.5px] leading-relaxed text-fg-muted">{step.detail}</p>
        <div className="mt-2 text-[11px] text-fg-faint">Owner: <span className="font-medium text-fg-muted">{step.owner}</span> · currently {t.assignee}</div>
      </div>
    </div>
  );
}
