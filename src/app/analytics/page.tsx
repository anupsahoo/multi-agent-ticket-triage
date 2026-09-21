/**
 * Analytics (`/analytics`): is the orchestrator getting better, and where does it fail.
 * Reads `/api/stats` on the server. Renders the resolution donut, the daily trend, three
 * ranked breakdowns and the tool-reliability table; one error panel if the engine is down.
 */
import { TopBar } from "@/components/shell/TopBar";
import { engineJson } from "@/lib/engine";
import { Panel } from "@/components/ui/Panel";
import { Stat } from "@/components/ui/Stat";
import { Donut } from "@/components/analytics/Donut";
import { TrendLine } from "@/components/analytics/TrendLine";
import { RankedBars } from "@/components/analytics/RankedBars";
import { ToolReliability } from "@/components/analytics/ToolReliability";
import type { Stats } from "@/lib/types";

// Never prerender: the desk changes with every submitted ticket.
export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  const s = await engineJson<Stats>("/api/stats").catch(() => null);
  return (
    <>
      <TopBar title="Analytics" crumbs={["Desk", "Analytics"]} />
      <main className="px-4 py-6 md:px-6">
        {!s ? (
          <Panel eyebrow="Orchestrator API" title="The triage API is not answering">
            <p className="text-sm text-fg-muted">Start the engine and reload.</p>
          </Panel>
        ) : (
          <>
            <p className="mb-4 text-sm text-fg-muted">Is the orchestrator getting better, and where does it fail. Last 7 days, {s.total} tickets.</p>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <Panel eyebrow="Resolution split" title="Where tickets ended up">
                <Donut centre={`${s.auto_resolution_rate}%`} centreLabel="auto" slices={[
                  { label: "Resolved by orchestrator", value: s.resolved, sem: "ok", hint: "no person involved" },
                  { label: "Escalated to L2", value: s.by_lane.L2 ?? 0, sem: "warn", hint: "desk agent" },
                  { label: "Escalated to L3", value: s.by_lane.L3 ?? 0, sem: "crit", hint: "engineering" },
                ]} />
                <div className="mt-5 grid grid-cols-3 gap-3 border-t border-line pt-4">
                  <Stat label="Tickets" value={s.total} size="md" />
                  <Stat label="Misroutes" value={s.misroutes} size="md" sem={s.misroutes > 0 ? "warn" : "ok"} />
                  <Stat label="SLA breached" value={s.sla_breached} size="md" sem={s.sla_breached > 0 ? "crit" : "ok"} />
                </div>
              </Panel>
              <Panel eyebrow="Trend" title="Auto-resolution rate by day" className="lg:col-span-2">
                <TrendLine series={s.series} mean={s.auto_resolution_rate} />
              </Panel>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
              <Panel eyebrow="Intent" title="What customers ask about" right={<span className="num text-xs text-fg-muted">{s.total}</span>}>
                <RankedBars sem="agent" items={Object.entries(s.by_intent).map(([label, value]) => ({ label, value }))} />
              </Panel>
              <Panel eyebrow="Channel" title="Where tickets come from" right={<span className="num text-xs text-fg-muted">{s.total}</span>}>
                <RankedBars sem="accent" items={Object.entries(s.by_channel).map(([label, value]) => ({ label, value }))} />
              </Panel>
              <Panel eyebrow="Escalation reasons" title="Why the orchestrator handed off" right={<span className="num text-xs text-fg-muted">{s.escalated}</span>}>
                <RankedBars sem="warn" total={s.escalated} items={Object.entries(s.escalation_reasons).map(([label, value]) => ({ label, value }))} empty="No escalations in the window" />
              </Panel>
            </div>

            <Panel className="mt-4" eyebrow="Tool reliability" title="Specialist tool calls, ok versus failed"
              right={<span className="num text-xs text-fg-muted">{s.tools.reduce((a, t) => a + t.calls, 0)} calls · <span style={{ color: "var(--crit)" }}>{s.tools.reduce((a, t) => a + t.failed, 0)} failed</span></span>}>
              <ToolReliability tools={s.tools} />
            </Panel>

            <p className="mt-5 text-[11px] leading-relaxed text-fg-faint">
              Assumptions: tickets are seeded synthetic data; specialist decisions and tool calls run against deterministic stubs, so failures and latencies are scripted, not observed. Figures are illustrative of the console, not of a production desk.
            </p>
          </>
        )}
      </main>
    </>
  );
}
