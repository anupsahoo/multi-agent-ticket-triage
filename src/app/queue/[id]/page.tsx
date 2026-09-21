/**
 * Ticket detail (`/queue/[id]`): what happened to one ticket, and what a person should do.
 * Reads `/api/tickets/{id}` (404 → Next's not-found page) and `/api/settings` (the thresholds
 * the gauges are judged against; falls back to the engine's defaults if the call fails).
 * Renders the header, message, journey, timeline, decision gauges, outcome, tool calls and raw state.
 */
import { notFound } from "next/navigation";
import Link from "next/link";
import { Quote } from "lucide-react";
import { engineJson, engineUrl } from "@/lib/engine";
import { TopBar } from "@/components/shell/TopBar";
import { Panel } from "@/components/ui/Panel";
import { TicketHeader } from "@/components/ticket/TicketHeader";
import { Gauges, type Gauge } from "@/components/ticket/Gauges";
import { Journey } from "@/components/ticket/Journey";
import { Timeline } from "@/components/ticket/Timeline";
import { ToolCalls } from "@/components/ticket/ToolCalls";
import { Outcome } from "@/components/ticket/Outcome";
import { RawState } from "@/components/ticket/RawState";
import { parseCheck } from "@/components/ticket/parse";
import type { Settings, Ticket } from "@/lib/types";

/** The engine's own defaults, so the gauges still have a bar to clear if `/api/settings` is unavailable. */
const DEFAULTS: Settings = { intent_confidence_min: 0.6, domain_min: 0.5, resolution_min: 0.7, max_hops: 2 };

/** Null on 404 so the page can call `notFound()`; any other failure is a real error. */
async function loadTicket(id: string): Promise<Ticket | null> {
  const r = await fetch(`${engineUrl()}/api/tickets/${encodeURIComponent(id)}`, { cache: "no-store" });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`API ${r.status}`);
  return (await r.json()) as Ticket;
}

const loadSettings = (): Promise<Settings> =>
  engineJson<Partial<Settings>>("/api/settings").then((s) => ({ ...DEFAULTS, ...s })).catch(() => DEFAULTS);

export default async function TicketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [ticket, settings] = await Promise.all([loadTicket(id), loadSettings()]);
  if (!ticket) notFound();

  // The router's confidence is on the ticket; the specialist's two checks only exist as trail lines.
  const gauges: Gauge[] = [
    { label: "Routing confidence", value: ticket.confidence, threshold: settings.intent_confidence_min, hint: "router" },
    { label: "Domain fit", value: parseCheck(ticket.trail, "domain fit"), threshold: settings.domain_min, hint: "specialist" },
    { label: "Resolution check", value: parseCheck(ticket.trail, "resolution check"), threshold: settings.resolution_min, hint: "specialist" },
  ];
  const misroute = ticket.route_history.length > 1;

  return (
    <>
      <TopBar title={ticket.ticket_id} crumbs={["Desk", "Queue", ticket.ticket_id]} />
      <main className="px-4 py-6 md:px-6">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="eyebrow">What happened, and what a person should do</div>
          <Link href="/queue" className="text-xs font-medium text-fg-muted hover:text-fg">← Back to queue</Link>
        </div>
        <div className="flex flex-col gap-4">
          <TicketHeader ticket={ticket} />
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
            <div className="flex min-w-0 flex-col gap-4">
              <Panel eyebrow="Customer message" title={`${ticket.customer} · ${ticket.company}`}>
                <blockquote className="relative rounded-xl border-l-4 bg-panel-2 py-3 pl-4 pr-4 text-[14px] leading-relaxed" style={{ borderLeftColor: "var(--accent)" }}>
                  <Quote size={14} className="absolute right-3 top-3 text-fg-faint" />
                  {ticket.message}
                </blockquote>
              </Panel>
              <Panel eyebrow="Journey" title={misroute ? "Routed, then handed on" : ticket.route_history.length === 0 ? "Router handed straight to a person" : "Routed once, no handoffs"}
                right={<span className="num text-xs text-fg-muted">{ticket.hops} of {settings.max_hops} hops</span>}>
                <Journey ticket={ticket} />
              </Panel>
              <Panel eyebrow="Timeline" title="Every step the agents took" right={<span className="num text-xs text-fg-muted">{ticket.trail.length} lines</span>}>
                <Timeline trail={ticket.trail} />
              </Panel>
            </div>
            <div className="flex min-w-0 flex-col gap-4">
              <Panel eyebrow="Decision checks" title="Did it clear the bar?">
                <Gauges gauges={gauges} />
              </Panel>
              <Panel eyebrow="Outcome" title={ticket.status === "resolved" ? "Answered by the orchestrator" : "Needs a person"}>
                <Outcome ticket={ticket} />
              </Panel>
              <Panel eyebrow="Tool calls" title="Results are validated, not trusted" right={<span className="num text-xs text-fg-muted">{ticket.tool_calls.length}</span>}>
                <ToolCalls calls={ticket.tool_calls} />
              </Panel>
            </div>
          </div>
          <RawState data={ticket} />
        </div>
      </main>
    </>
  );
}
