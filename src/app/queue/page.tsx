/**
 * Queue (`/queue`): every ticket, every lane, filterable and sortable.
 * Reads the full ticket list on the server (an unreachable engine yields an empty queue,
 * and the banner in the layout explains why). Filtering happens client-side in `QueueTable`.
 */
import { Suspense } from "react";
import { engineJson } from "@/lib/engine";
import { TopBar } from "@/components/shell/TopBar";
import { QueueTable } from "@/components/queue/QueueTable";
import type { Ticket } from "@/lib/types";

export default async function QueuePage() {
  const tickets = await engineJson<Ticket[]>("/api/tickets").catch(() => []);
  return (
    <>
      <TopBar title="Queue" crumbs={["Desk", "Queue"]} />
      <main className="px-4 py-6 md:px-6">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="eyebrow">Every ticket, every lane</div>
            <p className="mt-1 max-w-2xl text-sm text-fg-muted">
              Everything the orchestrator has touched. Filter by lane, status or intent, then open a row to see what happened and what a person should do next.
            </p>
          </div>
        </div>
        {/* QueueTable reads the URL with useSearchParams, which Next requires to sit under a Suspense boundary. */}
        <Suspense fallback={<div className="panel p-6 text-sm text-fg-muted">Loading queue…</div>}>
          <QueueTable tickets={tickets} />
        </Suspense>
      </main>
    </>
  );
}
