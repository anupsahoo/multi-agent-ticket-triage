/**
 * The Connectors page body: the bindings table with a live rebind dropdown per capability,
 * the agents → capabilities → connectors map, and the "add a connector" walkthrough.
 * Reads the initial bindings and the agent registry; after a rebind through `api.bind` the
 * table and map re-render from the list the engine returns.
 */
"use client";
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2, AlertTriangle } from "lucide-react";
import { Panel } from "@/components/ui/Panel";
import { Badge } from "@/components/ui/Badge";
import { Select } from "@/components/ui/Select";
import { api } from "@/lib/api";
import { SEM, agentSem } from "@/lib/semantics";
import type { Agent, ConnectorBinding } from "@/lib/types";
import { ConnectorMap } from "./ConnectorMap";

const TOAST_MS = 4000;

/** Plain-language meaning of each capability id the engine registers. */
const DESCRIPTION: Record<string, { text: string; note?: string }> = {
  "account.lookup": { text: "Plan, status and balance for an account id" },
  "invoice.lookup": { text: "Invoice amount, status and line items by invoice id" },
  "issues.search": { text: "Known issues and workarounds", note: "stands in for Jira / GitHub" },
  "kb.search": { text: "Knowledge-base articles for how-to answers" },
  "handoff.create": { text: "Where escalations go", note: "creates the L2 / L3 work item" },
};
/** What each connector needs in the environment, shown under its name in the dropdown. */
const CONNECTOR_NOTE: Record<string, string> = {
  mock: "in-process fixtures", jira: "JIRA_BASE_URL, JIRA_EMAIL, JIRA_API_TOKEN", github: "GITHUB_REPO (+ GITHUB_TOKEN if private)",
};

const TEMPLATE_STEPS: { title: string; code?: string; note: string }[] = [
  { title: "Copy the template", code: "cp triage/connectors/_template.py triage/connectors/acme.py", note: "one class per system; the registry finds it by its name" },
  { title: "Name it and declare capabilities", code: "name = \"acme\"\ncapabilities = {Cap.ISSUES_SEARCH}", note: "declare only what you implement, from the Cap enum" },
  { title: "Implement one function per capability", code: "def search(query: str) -> dict: ...", note: "args and results follow the schemas in base.py; raise NotFound, let real errors raise" },
  { title: "Return a ToolSpec per capability", code: "ToolSpec(Cap.ISSUES_SEARCH, \"acme_search\", \"Search Acme…\", SearchArgs, IssueSearchResult, search)", note: "this is what LLM-mode specialists see as a callable tool" },
  { title: "Bind it in connectors.toml", code: "[capabilities]\n\"issues.search\" = \"acme\"", note: "or switch it live from the table; agents never name a connector" },
  { title: "Run the connector test", code: "pytest tests/test_connectors.py", note: "it plugs in a throwaway connector and proves an agent picks it up" },
];

/** Static walkthrough for adding a connector to the engine. */
function AddConnector() {
  return (
    <Panel eyebrow="Add a connector" title="Six steps from template to bound" className="xl:sticky xl:top-20 xl:self-start">
      <ol className="flex flex-col gap-3">
        {TEMPLATE_STEPS.map((s, i) => (
          <li key={s.title} className="grid grid-cols-[28px_1fr] gap-2">
            <span className="num grid h-6 w-6 place-items-center rounded-full text-[11px] font-bold text-white" style={{ background: SEM.info.color }}>{i + 1}</span>
            <div className="min-w-0">
              <div className="text-[13px] font-semibold">{s.title}</div>
              {s.code && <pre className="mono mt-1 overflow-x-auto rounded-md border border-line bg-panel-2 px-2 py-1.5 text-[11px] leading-snug text-fg">{s.code}</pre>}
              <div className="mt-1 text-[11px] text-fg-muted">{s.note}</div>
            </div>
          </li>
        ))}
      </ol>
    </Panel>
  );
}

export function ConnectorTable({ initial, agents }: { initial: ConnectorBinding[]; agents: Agent[] }) {
  const [rows, setRows] = useState(initial);
  /** Capability whose rebind is in flight, so only that row's dropdown is disabled. */
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<{ text: string; sem: "ok" | "crit" } | null>(null);

  const bind = async (capability: string, connector: string) => {
    setBusy(capability);
    try {
      const next = await api.bind(capability, connector);
      setRows(next);
      const row = next.find((r) => r.capability === capability);
      setToast({ text: `${capability} → ${connector}${row && !row.healthy ? " · not configured, calls will raise ConnectorNotConfigured" : ""}`, sem: row && !row.healthy ? "crit" : "ok" });
    } catch (e) {
      setToast({ text: `Could not bind ${capability}: ${(e as Error).message}`, sem: "crit" });
    } finally {
      setBusy(null);
      setTimeout(() => setToast(null), TOAST_MS);
    }
  };

  const unhealthy = rows.filter((r) => !r.healthy).length;
  const usedBy = (cap: string) => agents.filter((a) => a.capabilities.includes(cap)).map((a) => a.id);

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="flex min-w-0 flex-col gap-4">
        <Panel padded={false} eyebrow="Bindings" title="Which system serves which capability"
          right={<div className="flex items-center gap-2">
            <AnimatePresence>{toast && (
              <motion.span initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="max-w-[320px] truncate rounded-full px-3 py-1 text-[11px] font-semibold" style={{ background: SEM[toast.sem].soft, color: SEM[toast.sem].color }}>{toast.text}</motion.span>
            )}</AnimatePresence>
            <Badge sem={unhealthy ? "crit" : "ok"}>{unhealthy ? `${unhealthy} not configured` : "all healthy"}</Badge>
          </div>}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-sm">
              <thead className="sticky top-0 z-10 bg-panel-2 text-[11px] uppercase tracking-[.08em] text-fg-muted">
                <tr>
                  <th className="px-5 py-2.5 text-left font-semibold">Capability</th>
                  <th className="px-3 py-2.5 text-left font-semibold">What it answers</th>
                  <th className="px-3 py-2.5 text-left font-semibold">Used by</th>
                  <th className="px-3 py-2.5 text-left font-semibold">Connector</th>
                  <th className="px-5 py-2.5 text-right font-semibold">Health</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && <tr><td colSpan={5} className="px-5 py-10 text-center text-fg-faint">No capabilities registered.</td></tr>}
                {rows.map((r) => {
                  const d = DESCRIPTION[r.capability];
                  return (
                    <tr key={r.capability} className="border-t border-line transition hover:bg-panel-2">
                      <td className="px-5 py-3 align-top"><span className="mono text-[12.5px] font-semibold text-fg">{r.capability}</span></td>
                      <td className="px-3 py-3 align-top text-fg">
                        {d?.text ?? "—"}{d?.note && <span className="block text-xs text-fg-faint">{d.note}</span>}
                      </td>
                      <td className="px-3 py-3 align-top">
                        <div className="flex flex-wrap gap-1">
                          {usedBy(r.capability).map((a) => <Badge key={a} sem={agentSem(a)} dot={false}>{a}</Badge>)}
                        </div>
                      </td>
                      <td className="px-3 py-2 align-top">
                        <div className="flex items-center gap-2">
                          <Select size="sm" value={r.connector ?? ""} disabled={busy === r.capability} onChange={(v) => bind(r.capability, v)} className="w-40"
                            options={r.options.map((o) => ({ value: o, label: o, detail: CONNECTOR_NOTE[o] }))} />
                          {busy === r.capability && <Loader2 size={14} className="animate-spin text-fg-faint" />}
                        </div>
                      </td>
                      <td className="px-5 py-3 text-right align-top">
                        <Badge sem={r.healthy ? "ok" : "crit"}>{r.healthy ? "healthy" : "not configured"}</Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex items-start gap-2 border-t border-line px-5 py-3 text-xs text-fg-muted">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" style={{ color: SEM.warn.color }} />
            <span><b className="text-fg">jira</b> and <b className="text-fg">github</b> are connector shapes: bind one and every call raises <span className="mono">ConnectorNotConfigured</span> until credentials exist. The specialist treats that as a tool error and escalates rather than guessing.</span>
          </div>
        </Panel>

        <Panel eyebrow="Mapping" title="Agents → capabilities → connectors">
          <ConnectorMap agents={agents} bindings={rows} />
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-fg-muted">
            <span className="inline-flex items-center gap-1.5"><span className="h-0.5 w-5 rounded" style={{ background: SEM.info.color }} /> bound connector</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-0.5 w-5 rounded border-t border-dashed border-line-strong" /> available option</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-0.5 w-5 rounded" style={{ background: SEM.crit.color }} /> bound but not configured</span>
          </div>
        </Panel>
      </div>

      <AddConnector />
    </div>
  );
}
