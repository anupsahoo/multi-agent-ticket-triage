/**
 * Browser-side client for the triage engine: the four mutations the console makes.
 * Every call goes to `/api/*`, which next.config.ts rewrites to the engine, so the
 * browser never needs the engine's address. Reads happen on the server via `engineJson`.
 */
import type { ConnectorBinding, Settings, Ticket } from "./types";

/** JSON request with caching disabled. Throws on a non-2xx status. */
async function j<T>(input: string, init?: RequestInit): Promise<T> {
  const r = await fetch(input, { ...init, headers: { "content-type": "application/json", ...(init?.headers ?? {}) }, cache: "no-store" });
  if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
  return r.json();
}

export const api = {
  /** Runs the message through the orchestrator synchronously and returns the finished ticket. */
  submit: (body: { message: string; customer?: string; company?: string; channel?: string; priority?: string }) =>
    j<Ticket>("/api/tickets", { method: "POST", body: JSON.stringify(body) }),
  /** Re-runs an existing ticket through the current graph and settings. */
  reprocess: (id: string) => j<Ticket>(`/api/tickets/${id}/reprocess`, { method: "POST" }),
  /** Rebinds a capability to a connector; returns the full binding list. */
  bind: (capability: string, connector: string) =>
    j<ConnectorBinding[]>(`/api/connectors/${capability}`, { method: "PUT", body: JSON.stringify({ connector }) }),
  saveSettings: (s: Partial<Settings>) => j<Settings>("/api/settings", { method: "PUT", body: JSON.stringify(s) }),
};
