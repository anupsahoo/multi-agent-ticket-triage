/**
 * Orchestrator (`/orchestrator`): the routing topology with live edge counts, and a ticket replay.
 * Reads `/api/stats` and every ticket on the server; tallies per-specialist outcomes for the
 * graph's edge labels and hands the 20 most recent tickets to `OrchestratorConsole` for replay.
 */
import { TopBar } from "@/components/shell/TopBar";
import { engineJson } from "@/lib/engine";
import { routeOutcomes } from "@/lib/outcomes";
import { OrchestratorConsole } from "@/components/orchestrator/OrchestratorConsole";
import { SPECIALISTS } from "@/components/orchestrator/graph";
import type { Stats, Ticket } from "@/lib/types";

/** How many tickets the replay picker offers; the panel title promises this number. */
const REPLAY_LIMIT = 20;

export default async function OrchestratorPage() {
  const [stats, tickets] = await Promise.all([engineJson<Stats>("/api/stats"), engineJson<Ticket[]>("/api/tickets")]);
  const flow = routeOutcomes(tickets, SPECIALISTS);
  const recent = [...tickets].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, REPLAY_LIMIT);
  return (
    <>
      <TopBar title="Orchestrator" crumbs={["Desk", "Orchestrator"]} />
      <main className="px-4 py-6 md:px-6">
        <p className="mb-4 text-sm text-fg-muted">Watch a ticket move through the agents. The graph is the live routing topology; edge counts are cumulative across the desk.</p>
        <OrchestratorConsole stats={stats} recent={recent} flow={flow} misroutes={stats.misroutes} />
      </main>
    </>
  );
}
