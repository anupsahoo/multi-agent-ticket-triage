/**
 * Left navigation: brand, the seven screens, and which backends the engine is running with.
 * Reads `decisions` / `language` from the layout and the current path for the active state.
 * Hidden below the md breakpoint.
 */
"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Inbox, Workflow, Bot, Plug, BarChart3, Settings, Radar } from "lucide-react";

const NAV = [
  { href: "/", label: "Command centre", icon: LayoutDashboard, hint: "What needs a person right now" },
  { href: "/queue", label: "Queue", icon: Inbox, hint: "Every ticket, every lane" },
  { href: "/orchestrator", label: "Orchestrator", icon: Workflow, hint: "Watch a ticket move through the agents" },
  { href: "/agents", label: "Agents", icon: Bot, hint: "Specialists and what they can call" },
  { href: "/connectors", label: "Connectors", icon: Plug, hint: "Jira, GitHub, knowledge base" },
  { href: "/analytics", label: "Analytics", icon: BarChart3, hint: "Resolution, escalations, tools" },
  { href: "/settings", label: "Settings", icon: Settings, hint: "Thresholds and models" },
];

export function Sidebar({ decisions, language }: { decisions: string; language: string }) {
  const path = usePathname();
  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-nav-line bg-nav md:sticky md:top-0 md:flex md:h-screen">
      <Link href="/" className="flex items-center gap-2.5 px-5 py-5">
        <span className="grid h-8 w-8 place-items-center rounded-lg" style={{ background: "var(--accent)" }}><Radar size={16} className="text-white" /></span>
        <div>
          <div className="text-[15px] font-bold tracking-tight text-nav-fg">Triage</div>
          <div className="text-[10px] uppercase tracking-[0.16em] text-nav-fg-muted">L2 / L3 support desk</div>
        </div>
      </Link>
      <nav className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-3">
        {NAV.map(({ href, label, icon: I, hint }) => {
          // Prefix match so /queue/T-1 keeps Queue lit; "/" would match everything, so it is exact.
          const active = href === "/" ? path === "/" : path.startsWith(href);
          return (
            <Link key={href} href={href} className={`group flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${active ? "bg-white/10 text-nav-fg" : "text-nav-fg-muted hover:bg-white/5 hover:text-nav-fg"}`}>
              <I size={16} className={active ? "text-accent" : "text-nav-fg-muted/70 group-hover:text-nav-fg-muted"} />
              <span className="min-w-0"><span className="block leading-tight">{label}</span><span className="block truncate text-[10px] text-nav-fg-muted/70">{hint}</span></span>
            </Link>
          );
        })}
      </nav>
      <div className="m-3 rounded-lg border border-nav-line bg-nav-2 px-3 py-2.5 text-[11px] leading-snug text-nav-fg-muted">
        <div className="flex items-center gap-1.5"><span className="pulse-dot h-1.5 w-1.5 rounded-full bg-ok" /> Orchestrator online</div>
        <div className="mt-1">decisions <b className="text-nav-fg">{decisions}</b> · language <b className="text-nav-fg">{language}</b></div>
      </div>
    </aside>
  );
}
