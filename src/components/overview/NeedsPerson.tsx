/**
 * Escalated tickets grouped by lane, L3 above L2, worst first inside each lane.
 * Reads the escalated ticket list; renders up to `LIMIT` rows across both groups, with each
 * group's full count in its header and a link to the filtered queue at the bottom.
 */
"use client";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { SEM, prioritySem, timeAgo } from "@/lib/semantics";
import type { Lane, Ticket } from "@/lib/types";

const PRIO = { P1: 0, P2: 1, P3: 2, P4: 3 } as const;
/** Rows shown across both lanes; the rest are one click away in the queue. */
const LIMIT = 8;

/** Sort key, worst first: L3 before L2, breached before not, P1 before P4, then newest. */
const rank = (t: Ticket) => [t.lane === "L3" ? 0 : 1, t.sla_breached ? 0 : 1, PRIO[t.priority], -new Date(t.created_at).getTime()];

export function NeedsPerson({ tickets }: { tickets: Ticket[] }) {
  const sorted = [...tickets].sort((a, b) => { const ra = rank(a), rb = rank(b); for (let i = 0; i < ra.length; i++) if (ra[i] !== rb[i]) return ra[i] - rb[i]; return 0; });
  const shown = sorted.slice(0, LIMIT);
  const groups: { lane: Lane; label: string; count: number; rows: Ticket[] }[] = (["L3", "L2"] as Lane[])
    .map((lane) => ({ lane, label: lane === "L3" ? "L3 · Engineering" : "L2 · Desk", count: tickets.filter((t) => t.lane === lane).length, rows: shown.filter((t) => t.lane === lane) }))
    .filter((g) => g.count > 0);

  if (tickets.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-line px-4 py-10 text-center">
        <div className="text-sm font-medium">Nothing is waiting on a person</div>
        <div className="mt-1 text-xs text-fg-muted">Every ticket in the last 7 days was closed by the orchestrator.</div>
      </div>
    );
  }

  return (
    // Negative margins let the group headers and rows run to the panel edge.
    <div className="-mx-5 -mb-5">
      {groups.map((g) => {
        const sem = g.lane === "L3" ? "crit" : "warn";
        return (
          <div key={g.lane}>
            <div className="flex items-center gap-2 border-y border-line bg-panel-2 px-5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-fg-muted">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: SEM[sem].color }} />
              {g.label}
              <span className="num font-medium normal-case tracking-normal text-fg-faint">{g.count} open</span>
            </div>
            <ul>
              {g.rows.map((t) => (
                <li key={t.ticket_id} className="border-b border-line last:border-b-0">
                  <Link href={`/queue/${t.ticket_id}`} className="grid grid-cols-[auto_1fr_auto] items-center gap-x-3 px-5 py-2.5 transition hover:bg-panel-2">
                    <span className="mono w-[62px] text-[12px] font-semibold" style={{ color: "var(--accent)" }}>{t.ticket_id}</span>
                    <span className="min-w-0">
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="truncate text-[13px] font-medium">{t.customer} <span className="font-normal text-fg-muted">· {t.company}</span></span>
                        <Badge sem={prioritySem(t.priority)} dot={false}>{t.priority}</Badge>
                        {t.sla_breached && <Badge sem="crit">SLA breached</Badge>}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-fg-muted" title={t.escalation_reason ?? undefined}>{t.escalation_reason ?? "No reason recorded"}</span>
                    </span>
                    <span className="hidden text-right text-xs sm:block">
                      <span className="block font-medium text-fg">{t.assignee}</span>
                      <span className="num block text-fg-faint" suppressHydrationWarning>{timeAgo(t.created_at)}</span>
                    </span>
                  </Link>
                </li>
              ))}
              {/* The L3 group can use up the whole LIMIT, leaving L2 with a count but no rows. */}
              {g.rows.length === 0 && <li className="px-5 py-2 text-xs text-fg-faint">Older {g.lane} tickets are in the queue.</li>}
            </ul>
          </div>
        );
      })}
      <div className="flex items-center justify-between border-t border-line px-5 py-3 text-xs">
        <span className="text-fg-faint">Showing {shown.length} of {tickets.length} escalated</span>
        <Link href="/queue?status=escalated" className="inline-flex items-center gap-1 font-semibold" style={{ color: "var(--accent)" }}>View all in queue <ArrowRight size={13} /></Link>
      </div>
    </div>
  );
}
