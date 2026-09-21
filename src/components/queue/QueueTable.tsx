/**
 * The queue itself: filters, lane tabs, a summary strip and the sortable ticket table.
 * Reads the full ticket list once from the page and filters it in the browser. Dropdown
 * filters live in the URL query string (so a filtered view is shareable and the command
 * centre can deep-link to `?status=escalated`); sort order and the text filter are local.
 */
"use client";
import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowDown, ArrowUp, ArrowUpDown, Inbox } from "lucide-react";
import type { Ticket } from "@/lib/types";
import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";
import { channelIcon, fmt, laneSem, prioritySem, slaCountdown, statusLabel, statusSem, timeAgo } from "@/lib/semantics";
import { FilterBar, EMPTY_FILTERS, type Filters } from "./FilterBar";
import { LaneTabs } from "./LaneTabs";
import { RouteChips } from "./RouteChips";

type SortKey = "id" | "priority" | "age";
const FILTER_KEYS = Object.keys(EMPTY_FILTERS) as (keyof Filters)[];

const TH = "sticky top-0 z-10 whitespace-nowrap border-b border-line bg-panel px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-fg-muted";
const TD = "border-b border-line px-3 py-2.5 align-middle";

/** "due 4h" / "overdue 2h" for an SLA deadline. */
function dueIn(iso: string) {
  const { overdue, span } = slaCountdown(iso);
  return overdue ? `overdue ${span}` : `due ${span}`;
}

/** Occurrences of each value `pick` returns across `rows`. */
function count<T extends string>(rows: Ticket[], pick: (t: Ticket) => T) {
  const out: Record<string, number> = {};
  for (const t of rows) out[pick(t)] = (out[pick(t)] ?? 0) + 1;
  return out;
}

/** Does the ticket pass every filter? `skip` ignores one filter, for computing that dropdown's own counts. */
function matches(t: Ticket, f: Filters, skip?: keyof Filters) {
  if (skip !== "status" && f.status !== "all" && t.status !== f.status) return false;
  if (skip !== "lane" && f.lane !== "all" && t.lane !== f.lane) return false;
  if (skip !== "intent" && f.intent !== "all" && t.intent !== f.intent) return false;
  if (skip !== "priority" && f.priority !== "all" && t.priority !== f.priority) return false;
  if (skip !== "channel" && f.channel !== "all" && t.channel !== f.channel) return false;
  if (skip !== "q" && f.q) {
    const q = f.q.toLowerCase();
    if (![t.ticket_id, t.customer, t.company].some((s) => s.toLowerCase().includes(q))) return false;
  }
  return true;
}

export function QueueTable({ tickets }: { tickets: Ticket[] }) {
  const router = useRouter();
  const sp = useSearchParams();
  // The text filter keeps a local mirror so typing never lags the query string.
  const [q, setQ] = useState(() => sp.get("q") ?? "");
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "age", dir: -1 });

  const filters: Filters = useMemo(() => ({
    status: sp.get("status") ?? "all", lane: sp.get("lane") ?? "all", intent: sp.get("intent") ?? "all",
    priority: sp.get("priority") ?? "all", channel: sp.get("channel") ?? "all", q,
  }), [sp, q]);

  const setFilters = (patch: Partial<Filters>) => {
    if (patch.q !== undefined) setQ(patch.q);
    const next = { ...filters, ...patch };
    const usp = new URLSearchParams();
    for (const k of FILTER_KEYS) { const v = next[k]; if (k === "q" ? v !== "" : v !== "all") usp.set(k, v); }
    const qs = usp.toString();
    // Native replaceState is integrated with the App Router: useSearchParams updates without a server round-trip.
    window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
  };
  const reset = () => { setQ(""); window.history.replaceState(null, "", window.location.pathname); };

  const intents = useMemo(() => [...new Set(tickets.map((t) => t.intent))].sort(), [tickets]);
  const channels = useMemo(() => [...new Set(tickets.map((t) => t.channel))].sort(), [tickets]);

  // Each dropdown's counts ignore its own filter, so they show what choosing a value would yield.
  const counts = useMemo(() => ({
    status: count(tickets.filter((t) => matches(t, filters, "status")), (t) => t.status),
    intent: count(tickets.filter((t) => matches(t, filters, "intent")), (t) => t.intent),
    priority: count(tickets.filter((t) => matches(t, filters, "priority")), (t) => t.priority),
    channel: count(tickets.filter((t) => matches(t, filters, "channel")), (t) => t.channel),
    lane: (() => { const rows = tickets.filter((t) => matches(t, filters, "lane")); return { all: rows.length, ...count(rows, (t) => t.lane) }; })(),
  }), [tickets, filters]);

  const rows = useMemo(() => {
    const list = tickets.filter((t) => matches(t, filters));
    const cmp: Record<SortKey, (a: Ticket, b: Ticket) => number> = {
      id: (a, b) => a.ticket_id.localeCompare(b.ticket_id),
      priority: (a, b) => a.priority.localeCompare(b.priority),
      age: (a, b) => a.created_at.localeCompare(b.created_at),
    };
    return list.sort((a, b) => cmp[sort.key](a, b) * sort.dir);
  }, [tickets, filters, sort]);

  const summary = { resolved: rows.filter((t) => t.status === "resolved").length, l2: rows.filter((t) => t.lane === "L2").length, l3: rows.filter((t) => t.lane === "L3").length };
  // Clicking a column toggles direction; switching columns starts ascending, except age which starts newest first.
  const toggleSort = (key: SortKey) => setSort((s) => (s.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: key === "age" ? -1 : 1 }));
  const sortIcon = (k: SortKey) => sort.key !== k ? <ArrowUpDown size={11} className="text-fg-faint" /> : sort.dir === 1 ? <ArrowUp size={11} style={{ color: "var(--accent)" }} /> : <ArrowDown size={11} style={{ color: "var(--accent)" }} />;
  const open = (id: string) => router.push(`/queue/${id}`);

  return (
    <div className="flex flex-col gap-3">
      <FilterBar filters={filters} intents={intents} channels={channels} counts={counts} onChange={setFilters} onReset={reset} />
      <div className="panel overflow-hidden" style={{ padding: 0 }}>
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-3">
          <LaneTabs value={filters.lane} counts={counts.lane} onChange={(lane) => setFilters({ lane })} />
        </div>
        <div className="num flex flex-wrap items-center gap-x-1.5 border-b border-line bg-panel-2 px-4 py-2 text-xs text-fg-muted">
          <b className="text-fg">{fmt(rows.length)}</b> {rows.length === 1 ? "ticket" : "tickets"}
          {rows.length !== tickets.length && <span className="text-fg-faint">of {fmt(tickets.length)}</span>}
          <span className="text-fg-faint">·</span> <b style={{ color: "var(--ok)" }}>{fmt(summary.resolved)}</b> resolved
          <span className="text-fg-faint">·</span> <b style={{ color: "var(--warn)" }}>{fmt(summary.l2)}</b> L2
          <span className="text-fg-faint">·</span> <b style={{ color: "var(--crit)" }}>{fmt(summary.l3)}</b> L3
        </div>
        {/* Height leaves room for the top bar, intro, filters and composer, so the table scrolls rather than the page. */}
        <div className="max-h-[calc(100vh-330px)] min-h-[240px] overflow-auto">
          <table className="w-full min-w-[1180px] border-collapse text-[13px]">
            <thead>
              <tr>
                <th className={TH}><button type="button" onClick={() => toggleSort("id")} className="inline-flex items-center gap-1 hover:text-fg">Ticket {sortIcon("id")}</button></th>
                <th className={TH}>Customer</th>
                <th className={`${TH} w-[28%]`}>Message</th>
                <th className={TH}>Intent</th>
                <th className={TH}><button type="button" onClick={() => toggleSort("priority")} className="inline-flex items-center gap-1 hover:text-fg">Priority {sortIcon("priority")}</button></th>
                <th className={TH}>Route</th>
                <th className={TH}>Status</th>
                <th className={TH}>Assignee</th>
                <th className={TH}><button type="button" onClick={() => toggleSort("age")} className="inline-flex items-center gap-1 hover:text-fg">Age {sortIcon("age")}</button></th>
                <th className={TH}>SLA</th>
                <th className={`${TH} text-right`}>Latency</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((t) => (
                <tr key={t.ticket_id} tabIndex={0} onClick={() => open(t.ticket_id)} onKeyDown={(e) => { if (e.key === "Enter") open(t.ticket_id); }}
                  className="cursor-pointer outline-none transition-colors hover:bg-panel-2 focus-visible:bg-accent/5">
                  <td className={`${TD} mono whitespace-nowrap text-xs font-medium`} style={{ color: "var(--accent)" }}>{t.ticket_id}</td>
                  <td className={`${TD} whitespace-nowrap`}>
                    <div className="font-medium leading-tight">{t.customer}</div>
                    <div className="flex items-center gap-1 text-xs text-fg-muted"><Icon name={channelIcon[t.channel] ?? "Circle"} size={11} className="text-fg-faint" />{t.company}</div>
                  </td>
                  {/* max-w-0 lets the message cell truncate instead of forcing the table wider. */}
                  <td className={`${TD} max-w-0`}><div className="truncate text-fg-muted" title={t.message}>{t.message}</div></td>
                  <td className={TD}><Badge sem={t.intent === "unknown" ? "muted" : "agent"} dot={false}>{t.intent}</Badge></td>
                  <td className={TD}><Badge sem={prioritySem(t.priority)} dot={false} className="mono">{t.priority}</Badge></td>
                  <td className={TD}><RouteChips history={t.route_history} status={t.status} /></td>
                  <td className={`${TD} whitespace-nowrap`}><Badge sem={statusSem(t.status)}>{statusLabel(t)}</Badge></td>
                  <td className={`${TD} whitespace-nowrap text-xs`}>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full" style={{ background: `var(--${laneSem(t.lane)})` }} />
                      {t.assignee}
                    </span>
                  </td>
                  {/* Age and SLA depend on the wall clock, so server and client text can differ by a minute: suppress the mismatch warning. */}
                  <td className={`${TD} num whitespace-nowrap text-xs text-fg-muted`} title={new Date(t.created_at).toLocaleString()} suppressHydrationWarning>{timeAgo(t.created_at)}</td>
                  <td className={`${TD} whitespace-nowrap`}>
                    {t.status === "resolved" ? <span className="text-xs" style={{ color: "var(--ok)" }}>met</span> : t.sla_breached ? <Badge sem="crit">breached</Badge> : <span className="num text-xs text-fg-muted" suppressHydrationWarning>{dueIn(t.sla_due)}</span>}
                  </td>
                  <td className={`${TD} num whitespace-nowrap text-right text-xs text-fg-muted`}>{fmt(t.latency_ms)} ms</td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-2 px-6 py-16 text-center">
              <span className="grid h-10 w-10 place-items-center rounded-full" style={{ background: "var(--muted-soft)" }}><Inbox size={18} className="text-fg-muted" /></span>
              <div className="text-sm font-semibold">No tickets match these filters</div>
              <div className="max-w-sm text-xs text-fg-muted">{tickets.length === 0 ? "The API returned nothing — is the triage engine running?" : "Loosen a filter or clear them all to see the full queue."}</div>
              {tickets.length > 0 && <button type="button" onClick={reset} className="mt-1 rounded-lg px-3 py-1.5 text-xs font-semibold text-white" style={{ background: "var(--accent)" }}>Clear filters</button>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
