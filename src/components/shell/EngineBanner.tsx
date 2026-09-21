/**
 * Full-width warning under the top of every screen when the engine cannot be reached.
 * Reads `online` from the layout's `/api/meta` probe; renders nothing when the engine is up.
 * The console is useless without the engine, so the failure must be loud, not silent.
 */
export function EngineBanner({ online }: { online: boolean }) {
  if (online) return null;
  return (
    <div className="border-b px-4 py-2 text-sm md:px-6" style={{ background: "var(--crit-soft)", borderColor: "var(--crit)", color: "var(--crit)" }}>
      <b>Triage engine is offline.</b> Nothing on this console will work until it is running. Locally: <code className="mono rounded bg-bg-elev px-1.5 py-0.5 text-xs">./dev.sh</code> starts both the engine and this console.
    </div>
  );
}
