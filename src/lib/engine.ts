/**
 * Server-side access to the triage engine.
 * Browser code goes through the Next.js rewrite (`/api/*`, see next.config.ts), but server
 * components run before that rewrite exists, so they need the engine's real address.
 * This is the only place that address is resolved; every page fetches through `engineJson`.
 */

/** The engine's base URL: an explicit override, else this Vercel deployment's own `/api` function, else the local dev server. */
export function engineUrl(): string {
  if (process.env.NEXT_PUBLIC_ENGINE_URL) return process.env.NEXT_PUBLIC_ENGINE_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://127.0.0.1:8765";
}

/** Fetch JSON from the engine with caching disabled (the desk changes on every request). Throws on a non-2xx status. */
export async function engineJson<T>(path: string): Promise<T> {
  const r = await fetch(`${engineUrl()}${path}`, { cache: "no-store" });
  if (!r.ok) throw new Error(`engine ${r.status} on ${path}`);
  return r.json() as Promise<T>;
}
