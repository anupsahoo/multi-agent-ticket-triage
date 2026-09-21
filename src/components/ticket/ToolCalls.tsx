/**
 * One card per connector call the specialists made: connector, tool, arguments, and either
 * the validated result as key/value rows or the error that stopped it.
 * Reads the ticket's `tool_calls`.
 */
import { ShieldCheck } from "lucide-react";
import type { ToolCall } from "@/lib/types";
import { Badge } from "@/components/ui/Badge";
import { SEM } from "@/lib/semantics";

/** One-line rendering of a result value; nested objects show their first two fields. */
const short = (v: unknown): string => {
  if (v === null || v === undefined) return "—";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (Array.isArray(v)) return v.length === 0 ? "[]" : v.map((x) => (typeof x === "object" && x !== null ? Object.values(x as Record<string, unknown>).slice(0, 2).map(short).join(" · ") : short(x))).join("; ");
  const o = v as Record<string, unknown>;
  return Object.entries(o).map(([k, x]) => `${k}: ${short(x)}`).join(", ");
};

export function ToolCalls({ calls }: { calls: ToolCall[] }) {
  if (calls.length === 0) return <div className="text-sm text-fg-muted">No tools were called — the router handed this over before a specialist picked it up.</div>;
  return (
    <div className="flex flex-col gap-3">
      {calls.map((c, i) => {
        // The handoff payload is the whole ticket state; it would swamp the card, and RawState already shows it.
        const args = c.name === "create_handoff" && c.args && typeof c.args === "object"
          ? Object.fromEntries(Object.entries(c.args).filter(([k]) => k !== "payload"))
          : c.args;
        return (
          <div key={i} className="rounded-xl border border-line bg-panel-2 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                <span className="rounded-md px-1.5 py-0.5 text-[11px] font-semibold" style={{ background: SEM.info.soft, color: SEM.info.color }}>{c.connector}</span>
                <span className="mono truncate text-[12.5px] font-semibold">{c.name}</span>
                <span className="text-[11px] text-fg-faint">{c.capability}</span>
              </div>
              <Badge sem={c.ok ? "ok" : "crit"} dot={false}>{c.ok ? "ok" : "error"}</Badge>
            </div>
            <pre className="mono mt-2 overflow-x-auto whitespace-pre-wrap break-all rounded-md border border-line bg-bg-elev px-2 py-1.5 text-[11px] leading-snug text-fg-muted">{JSON.stringify(args)}</pre>
            {c.ok && c.result ? (
              <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[12px]">
                {Object.entries(c.result).map(([k, v]) => (
                  <div key={k} className="contents">
                    <dt className="mono text-fg-faint">{k}</dt>
                    <dd className="min-w-0 break-words text-fg">{short(v)}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <div className="mt-2 rounded-md px-2 py-1.5 text-[12px] font-medium" style={{ background: SEM.crit.soft, color: SEM.crit.color }}>{c.error ?? "no result"}</div>
            )}
            <div className="mt-2 flex items-center gap-1 text-[10.5px] text-fg-faint">
              <ShieldCheck size={11} /> {c.ok ? "result validated against the connector schema before the agent used it" : "failed result discarded — the agent did not guess"}
            </div>
          </div>
        );
      })}
    </div>
  );
}
