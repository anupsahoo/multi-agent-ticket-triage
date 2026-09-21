/**
 * Next.js config: one rewrite that sends the browser's `/api/*` calls to the triage engine.
 * In development that is the local engine (`server.py`, the same address `src/lib/engine.ts`
 * resolves). On Vercel it is this deployment's Python function in `api/index.py`, which Vercel
 * serves at `/api/`: the rewrite selects the function and the original path is preserved,
 * so the same routing code handles both.
 */
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination:
          process.env.NODE_ENV === "development" ? "http://127.0.0.1:8765/api/:path*" : "/api/",
      },
    ];
  },
};

export default nextConfig;
