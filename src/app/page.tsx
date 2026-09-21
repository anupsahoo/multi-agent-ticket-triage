/**
 * Command centre (`/`): what needs a person right now and how the orchestrator is doing.
 * Reads `/api/stats`, `/api/meta`, the escalated tickets and the full ticket list on the server.
 * Renders the KPI row, throughput chart, escalation list, health panel, reasons and live feed;
 * if the engine is unreachable it renders one error panel instead.
 */
import Link from "next/link";
import { engineJson } from "@/lib/engine";
import { TopBar } from "@/components/shell/TopBar";
import { Panel } from "@/components/ui/Panel";
import { Badge } from "@/components/ui/Badge";
import { KpiRow } from "@/components/overview/KpiRow";
import { ThroughputChart } from "@/components/overview/ThroughputChart";
import { NeedsPerson } from "@/components/overview/NeedsPerson";
import { OrchestratorHealth } from "@/components/overview/OrchestratorHealth";
import { LiveFeed } from "@/components/overview/LiveFeed";
import { RankedBars } from "@/components/analytics/RankedBars";
import type { Meta, Stats, Ticket } from "@/lib/types";

// Never prerender: the desk changes with every submitted ticket.
export const dynamic = "force-dynamic";

/** Feed length: enough to show movement without pushing the panel below the fold. */
const FEED_LIMIT = 8;

/** Everything the page needs, or the error to show. Meta is optional (it only adds badges), the rest is not. */
async function load() {
  try {
    const [stats, meta, escalated, recent] = await Promise.all([
      engineJson<Stats>("/api/stats"),
      engineJson<Meta>("/api/meta").catch(() => null),
      engineJson<Ticket[]>("/api/tickets?status=escalated"),
      engineJson<Ticket[]>("/api/tickets"),
    ]);
    return { stats, meta, escalated, recent: recent.slice(0, FEED_LIMIT) };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

export default async function Home() {
  const d = await load();
  return (
    <>
      <TopBar title="Command centre" crumbs={["Desk", "Command centre"]} />
      <main className="px-4 py-6 md:px-6">
        {"error" in d ? (
          <Panel eyebrow="Orchestrator API" title="The triage API is not answering">
            <p className="text-sm text-fg-muted">Start the engine and reload. <span className="mono text-fg-faint">{d.error}</span></p>
          </Panel>
        ) : (
          <>
            <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
              <p className="text-sm text-fg-muted">What needs a person right now, and how the orchestrator is doing. Last 7 days.</p>
              <div className="flex items-center gap-1.5">
                <Badge sem="ok">Orchestrator online</Badge>
                {d.meta && <Badge sem="muted" dot={false}>{d.meta.seeded} seeded</Badge>}
              </div>
            </div>
            <KpiRow stats={d.stats} />
            <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
              <div className="flex min-w-0 flex-col gap-4 lg:col-span-2">
                <Panel eyebrow="Throughput" title="Tickets per day"
                  right={<Link href="/analytics" className="text-xs font-semibold" style={{ color: "var(--accent)" }}>Analytics</Link>}>
                  <ThroughputChart series={d.stats.series} />
                </Panel>
                <Panel eyebrow="Needs a person" title="Escalated and waiting"
                  right={<div className="flex gap-1.5">{d.stats.open_l3 > 0 && <Badge sem="crit">{d.stats.open_l3} L3</Badge>}<Badge sem="warn">{d.stats.open_l2} L2</Badge></div>}>
                  <NeedsPerson tickets={d.escalated} />
                </Panel>
              </div>
              <div className="flex min-w-0 flex-col gap-4">
                <Panel eyebrow="Orchestrator health" title="Routing and load">
                  <OrchestratorHealth stats={d.stats} meta={d.meta} />
                </Panel>
                <Panel eyebrow="Escalation reasons" title="Why tickets left the orchestrator"
                  right={<span className="num text-xs text-fg-muted">{d.stats.escalated} total</span>}>
                  <RankedBars sem="warn" items={Object.entries(d.stats.escalation_reasons).map(([label, value]) => ({ label, value }))} empty="No escalations in the window" />
                </Panel>
                <Panel eyebrow="Live feed" title="Latest through the router"
                  right={<Link href="/queue" className="text-xs font-semibold" style={{ color: "var(--accent)" }}>Queue</Link>}>
                  <LiveFeed tickets={d.recent} />
                </Panel>
              </div>
            </div>
          </>
        )}
      </main>
    </>
  );
}
