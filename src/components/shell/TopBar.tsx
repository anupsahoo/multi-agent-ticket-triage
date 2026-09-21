/**
 * Sticky page header: breadcrumbs and title on the left, search / notifications / user on the right.
 * Reads `title` and `crumbs` from the page. The right-hand controls are static desk chrome.
 */
"use client";
import { Bell, Search, ChevronDown } from "lucide-react";

export function TopBar({ title, crumbs }: { title: string; crumbs?: string[] }) {
  return (
    <header className="sticky top-0 z-20 flex items-center justify-between gap-4 border-b border-line bg-bg/85 px-4 py-3 backdrop-blur md:px-6">
      <div className="min-w-0">
        {crumbs && crumbs.length > 0 && <div className="text-[11px] text-fg-faint">{crumbs.join(" / ")}</div>}
        <h1 className="truncate text-lg font-semibold tracking-tight">{title}</h1>
      </div>
      <div className="flex items-center gap-2">
        <div className="hidden items-center gap-2 rounded-lg border border-line bg-bg-elev px-3 py-1.5 text-xs text-fg-faint lg:flex"><Search size={13} /> Find a ticket, customer or company <kbd className="ml-2 rounded border border-line px-1 text-[10px]">⌘K</kbd></div>
        <button className="relative rounded-lg border border-line bg-bg-elev p-2 text-fg-muted" aria-label="Notifications"><Bell size={15} /><span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-crit" /></button>
        <button className="flex items-center gap-2 rounded-lg border border-line bg-bg-elev px-2.5 py-1.5 text-xs">
          <span className="grid h-6 w-6 place-items-center rounded-full text-[10px] font-bold text-white" style={{ background: "var(--agent)" }}>AS</span>
          <span className="hidden sm:inline">Anup · Desk lead</span><ChevronDown size={13} className="text-fg-faint" />
        </button>
      </div>
    </header>
  );
}
