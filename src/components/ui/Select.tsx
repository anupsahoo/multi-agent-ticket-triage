/**
 * Custom dropdown: a button that opens a listbox, with keyboard navigation and outside-click close.
 * Reads `value` and `options` from props and reports changes through `onChange`; the open state
 * and the highlighted row are local. Used for every picker in the console.
 */
"use client";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown } from "lucide-react";

export interface Option {
  value: string; label: string;
  /** Small right-aligned text, e.g. a count. */
  meta?: string;
  /** Second line under the label. */
  detail?: string;
}

export function Select({ label, value, options, onChange, disabled, size = "md", className = "" }:
  { label?: string; value: string; options: Option[]; onChange: (v: string) => void; disabled?: boolean; size?: "sm" | "md"; className?: string }) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  // Fall back to the first option so an unknown value never renders an empty button.
  const current = options.find((o) => o.value === value) ?? options[0];

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h); return () => document.removeEventListener("mousedown", h);
  }, [open]);

  const openList = () => { setActive(Math.max(0, options.findIndex((o) => o.value === value))); setOpen(true); };
  const commit = (v: string) => { onChange(v); setOpen(false); };
  const onKey = (e: React.KeyboardEvent) => {
    if (disabled) return;
    if (e.key === "Escape") return setOpen(false);
    if (!open && ["Enter", " ", "ArrowDown"].includes(e.key)) { e.preventDefault(); return openList(); }
    if (!open) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((i) => Math.min(options.length - 1, i + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((i) => Math.max(0, i - 1)); }
    else if (e.key === "Enter") { e.preventDefault(); commit(options[active].value); }
  };
  const pad = size === "sm" ? "px-2.5 py-1.5 text-[13px]" : "px-3 py-2 text-sm";

  return (
    <div className={`relative ${className}`} ref={ref}>
      {label && <label className="mb-1 block text-xs font-medium text-fg-muted">{label}</label>}
      <button type="button" disabled={disabled} aria-haspopup="listbox" aria-expanded={open}
        onClick={() => !disabled && (open ? setOpen(false) : openList())} onKeyDown={onKey}
        className={`flex w-full items-center justify-between gap-2 rounded-lg border bg-bg-elev text-left transition ${pad} ${disabled ? "opacity-60" : "hover:border-line-strong"}`}
        style={{ borderColor: open ? "var(--accent)" : "var(--line-strong)", boxShadow: open ? "0 0 0 3px var(--accent-soft)" : undefined }}>
        <span className="min-w-0 truncate text-fg">{current?.label}</span>
        <ChevronDown size={14} className="shrink-0 text-fg-faint" style={{ transform: open ? "rotate(180deg)" : undefined, transition: "transform .15s" }} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.ul role="listbox" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.12 }}
            className="absolute z-40 mt-1 max-h-72 w-full overflow-auto rounded-lg border border-line-strong bg-bg-elev py-1 shadow-xl">
            {options.map((o, i) => {
              const sel = o.value === value;
              return (
                <li key={o.value} role="option" aria-selected={sel}>
                  <button type="button" onMouseEnter={() => setActive(i)} onClick={() => commit(o.value)}
                    className="flex w-full items-start gap-2 px-3 py-2 text-left" style={{ background: i === active ? "var(--accent-soft)" : "transparent" }}>
                    <span className="mt-0.5 w-4 shrink-0">{sel && <Check size={14} style={{ color: "var(--accent)" }} />}</span>
                    <span className="min-w-0 flex-1">
                      <span className={`block truncate text-sm ${sel ? "font-semibold" : ""}`}>{o.label}</span>
                      {o.detail && <span className="block truncate text-xs text-fg-faint">{o.detail}</span>}
                    </span>
                    {o.meta && <span className="num shrink-0 text-xs text-fg-muted">{o.meta}</span>}
                  </button>
                </li>
              );
            })}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}
