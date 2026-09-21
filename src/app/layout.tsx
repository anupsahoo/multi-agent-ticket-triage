/**
 * Root layout: fonts, the sidebar, the offline banner and the ticket composer around every page.
 * Reads `/api/meta` once per request to show which backends are live; if the engine is down
 * it renders the shell anyway, with the banner, so the failure is visible rather than a crash.
 */
import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/shell/Sidebar";
import { Composer } from "@/components/shell/Composer";
import { EngineBanner } from "@/components/shell/EngineBanner";
import { engineJson } from "@/lib/engine";
import type { Meta } from "@/lib/types";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const mono = JetBrains_Mono({ variable: "--font-mono", subsets: ["latin"] });

export const metadata: Metadata = { title: "Triage · L2/L3 support desk", description: "Multi-agent support-ticket triage console" };

type Backends = Pick<Meta, "decisions" | "language"> & { online: boolean };

/** Which backends the engine is running with, or "offline" for both when it cannot be reached. */
async function backends(): Promise<Backends> {
  try {
    const m = await engineJson<Meta>("/api/meta");
    return { decisions: m.decisions, language: m.language, online: true };
  } catch {
    return { decisions: "offline", language: "offline", online: false };
  }
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const m = await backends();
  return (
    <html lang="en" className={`${inter.variable} ${mono.variable} h-full antialiased`}>
      <body className="min-h-full">
        <div className="flex min-h-screen">
          <Sidebar decisions={m.decisions} language={m.language} />
          <div className="flex min-w-0 flex-1 flex-col">
            <EngineBanner online={m.online} />
            <div className="min-w-0 flex-1">{children}</div>
            <Composer />
          </div>
        </div>
      </body>
    </html>
  );
}
