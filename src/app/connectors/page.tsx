/**
 * Connectors (`/connectors`): which system serves which capability, and rebinding them live.
 * Reads `/api/connectors` (bindings) and `/api/meta` (which agents use each capability).
 * Renders `ConnectorTable`, which owns the bindings after the first render.
 */
import { TopBar } from "@/components/shell/TopBar";
import { engineJson } from "@/lib/engine";
import { ConnectorTable } from "@/components/connectors/ConnectorTable";
import type { ConnectorBinding, Meta } from "@/lib/types";

export default async function ConnectorsPage() {
  const [bindings, meta] = await Promise.all([engineJson<ConnectorBinding[]>("/api/connectors"), engineJson<Meta>("/api/meta")]);
  return (
    <>
      <TopBar title="Connectors" crumbs={["Desk", "Connectors"]} />
      <main className="px-4 py-6 md:px-6">
        <p className="mb-4 text-sm text-fg-muted">Which system serves which capability. Agents ask for a capability, never a system; rebinding takes effect on the next ticket.</p>
        <ConnectorTable initial={bindings} agents={meta.agents} />
      </main>
    </>
  );
}
