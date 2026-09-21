/**
 * The most recent tickets through the orchestrator, whatever happened to them.
 * Reads a ticket list (the page passes the newest eight); renders one linked row per ticket
 * with its route, latency, age and a short status badge.
 */
"use client";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { statusSem, timeAgo } from "@/lib/semantics";
import type { Ticket } from "@/lib/types";

/** Shorter than `statusLabel`: the lane alone is enough in a dense feed. */
const shortStatus = (t: Ticket) => (t.status === "resolved" ? "Resolved" : t.status === "escalated" ? t.lane : "Open");

export function LiveFeed({ tickets }: { tickets: Ticket[] }) {
  if (tickets.length === 0) return <div className="py-6 text-center text-xs text-fg-faint">No tickets yet.</div>;
  return (
    // Negative margins let rows run to the panel edge and share its bottom padding.
    <ul className="-mx-5 -mb-5">
      {tickets.map((t) => {
        // A ticket the router escalated directly has no route; show the intent it was classified as instead.
        const route = t.route_history.length ? t.route_history : [t.intent];
        return (
          <li key={t.ticket_id} className="border-t border-line first:border-t-0">
            <Link href={`/queue/${t.ticket_id}`} className="grid grid-cols-[64px_1fr_auto] items-center gap-x-3 px-5 py-2 text-xs transition hover:bg-panel-2">
              <span className="mono font-semibold" style={{ color: "var(--accent)" }}>{t.ticket_id}</span>
              <span className="flex min-w-0 items-center gap-1 truncate text-fg-muted">
                {route.map((r, i) => (
                  <span key={i} className="inline-flex items-center gap-1">
                    {i > 0 && <ArrowRight size={11} className="text-fg-faint" />}
                    <span className={i === route.length - 1 ? "font-medium text-fg" : ""}>{r}</span>
                  </span>
                ))}
              </span>
              <span className="flex items-center gap-2">
                <span className="num hidden text-fg-faint sm:inline">{t.latency_ms} ms</span>
                <span className="num text-fg-faint" suppressHydrationWarning>{timeAgo(t.created_at)}</span>
                <Badge sem={t.status === "escalated" && t.lane === "L3" ? "crit" : statusSem(t.status)}>{shortStatus(t)}</Badge>
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
