/**
 * Collapsed "Raw state" disclosure at the bottom of the ticket page.
 * Reads any JSON-serialisable value (the page passes the whole ticket) and pretty-prints it,
 * so what the UI shows can always be checked against what the engine persisted.
 */
import { ChevronRight } from "lucide-react";

export function RawState({ data }: { data: unknown }) {
  return (
    <details className="panel group px-5 py-3">
      <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-semibold [&::-webkit-details-marker]:hidden">
        <ChevronRight size={14} className="text-fg-faint transition-transform group-open:rotate-90" /> Raw state
        <span className="text-xs font-normal text-fg-faint">exactly what the orchestrator persisted</span>
      </summary>
      <pre className="mono mt-3 max-h-[480px] overflow-auto rounded-lg border border-line bg-panel-2 p-3 text-[11px] leading-relaxed text-fg-muted">{JSON.stringify(data, null, 2)}</pre>
    </details>
  );
}
