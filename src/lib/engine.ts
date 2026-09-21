/**
 * Server-side access to the triage engine.
 * Browser code goes through the Next.js rewrite (`/api/*`, see next.config.ts), but server
 * components run before that rewrite exists, so they need the engine's real address.
 * This is the only place that address is resolved; every page fetches through `engineJson`.
 */

/**
 * The engine's base URL, in order of preference:
 *   1. an explicit override (`NEXT_PUBLIC_ENGINE_URL`);
 *   2. on Vercel, this deployment's own `/api` function — through the stable production
 *      domain when there is one, because the per-deployment URL (`VERCEL_URL`) sits behind
 *      Deployment Protection and would answer a server-side fetch with a login page;
 *   3. the local dev server started by `dev.sh`.
 */
export function engineUrl(): string {
  if (process.env.NEXT_PUBLIC_ENGINE_URL) return process.env.NEXT_PUBLIC_ENGINE_URL;
  const host = process.env.VERCEL_ENV === "production" && process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? process.env.VERCEL_PROJECT_PRODUCTION_URL
    : process.env.VERCEL_URL;
  return host ? `https://${host}` : "http://127.0.0.1:8765";
}

/** Headers for a server-side engine call; carries the Deployment Protection bypass when one is set (preview deployments). */
function engineHeaders(): HeadersInit {
  const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
  return bypass ? { "x-vercel-protection-bypass": bypass } : {};
}

/** A raw engine request with caching disabled (the desk changes on every request). Callers that care about specific statuses use this. */
export function engineFetch(path: string): Promise<Response> {
  return fetch(`${engineUrl()}${path}`, { cache: "no-store", headers: engineHeaders() });
}

/** Fetch JSON from the engine. Throws on a non-2xx status. */
export async function engineJson<T>(path: string): Promise<T> {
  const r = await engineFetch(path);
  if (!r.ok) throw new Error(`engine ${r.status} on ${path}`);
  return r.json() as Promise<T>;
}
