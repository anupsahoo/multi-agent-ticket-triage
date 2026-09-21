/**
 * Agents (`/agents`): one card per agent in the graph, with load and resolution rate.
 * Reads `/api/meta` (the agent registry), `/api/stats` (load) and every ticket (to tally
 * how each specialist's visits ended). Renders `AgentCards`.
 */
import { TopBar } from "@/components/shell/TopBar";
import { engineJson } from "@/lib/engine";
import { routeOutcomes } from "@/lib/outcomes";
import { AgentCards } from "@/components/agents/AgentCards";
import type { Meta, Stats, Ticket } from "@/lib/types";

export default async function AgentsPage() {
  const [meta, stats, tickets] = await Promise.all([
    engineJson<Meta>("/api/meta"), engineJson<Stats>("/api/stats"), engineJson<Ticket[]>("/api/tickets"),
  ]);
  const outcomes = routeOutcomes(tickets, meta.agents.map((a) => a.id));
  return (
    <>
      <TopBar title="Agents" crumbs={["Desk", "Agents"]} />
      <main className="px-4 py-6 md:px-6">
        <p className="mb-4 text-sm text-fg-muted">Who does what, and how well. One card per agent in the graph; load and resolution rate come from the tickets this desk has seen.</p>
        <AgentCards meta={meta} stats={stats} outcomes={outcomes} />
      </main>
    </>
  );
}
