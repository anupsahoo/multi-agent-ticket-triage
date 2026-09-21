/**
 * The Settings page body: three threshold sliders and the hop limit (saved to the engine),
 * the read-only provider panels, and display-only desk policy pickers.
 * Reads the current `Settings` and `Meta`; saves through `api.saveSettings` and keeps a
 * `saved` copy so the form can show what changed and reset to it.
 */
"use client";
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Loader2, Lock } from "lucide-react";
import { Panel } from "@/components/ui/Panel";
import { Badge } from "@/components/ui/Badge";
import { Select } from "@/components/ui/Select";
import { api } from "@/lib/api";
import { SEM, type Sem } from "@/lib/semantics";
import type { Meta, Settings } from "@/lib/types";

const TOAST_MS = 3500;

type GateKey = "intent_confidence_min" | "domain_min" | "resolution_min";
/** The three 0..1 gates, who applies each, and what falling below it does. */
const GATES: { key: GateKey; label: string; owner: string; sem: Sem; what: string }[] = [
  { key: "intent_confidence_min", label: "Routing confidence", owner: "router", sem: "accent", what: "Below this the router does not guess: the ticket goes straight to escalation as low confidence." },
  { key: "domain_min", label: "Domain fit", owner: "specialist", sem: "agent", what: "After the tool call a specialist scores whether the ticket is really its domain; below this it hands back to the router." },
  { key: "resolution_min", label: "Resolution check", owner: "specialist", sem: "ok", what: "The drafted reply is scored before it is sent; below this the specialist escalates with the draft attached." },
];
const HOPS = [1, 2, 3, 4].map((n) => ({ value: String(n), label: `${n} hop${n === 1 ? "" : "s"}`, detail: n === 1 ? "no handoffs — first specialist decides" : `up to ${n - 1} handoff${n === 2 ? "" : "s"} between specialists` }));

/** Provider options are informational: the engine picks them from the environment at start-up. */
const DECISIONS = [
  { value: "jev", label: "jev", note: "Jev fast classifier (TYPESAFE_API_KEY) — returns calibrated probabilities per option, so thresholds mean what they say." },
  { value: "llm", label: "llm", note: "The chat model classifies; its confidence is self-reported, a weaker signal than a calibrated one." },
  { value: "stub", label: "stub", note: "Deterministic keyword rules — the default and what every test runs against." },
];
const LANGUAGE = [
  { value: "model", label: "chat model", note: "Any LangChain model via LLM_MODEL (provider:model). It picks the tool call and drafts the reply — that is all the model does." },
  { value: "stub", label: "stub", note: "Template replies and rule-based tool choice; no network." },
];
/** Desk policy pickers are display only: this console never writes them. */
const SLA = [
  { value: "standard", label: "Standard · P1 4h, P2 8h, P3 24h, P4 72h" },
  { value: "enterprise", label: "Enterprise · P1 1h, P2 4h, P3 8h, P4 24h" },
  { value: "business-hours", label: "Business hours · P1 4h, P2 1d, P3 2d, P4 5d" },
];
const LANES = [
  { value: "l2-queue", label: "L2 · queue owners", detail: "Alex M., Priya S., Jordan K." },
  { value: "l3-eng", label: "L3 · engineering", detail: "Platform eng. on-call" },
];

/** Read-only look-alike of `Select`: shows the active provider and describes every option. */
function ProviderDisplay({ label, current, options, envHint }: { label: string; current: string; options: { value: string; label: string; note: string }[]; envHint: string }) {
  const known = options.some((o) => o.value === current);
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <label className="text-xs font-medium text-fg-muted">{label}</label>
        <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-fg-faint"><Lock size={10} /> read-only · {envHint}</span>
      </div>
      <div className="rounded-lg border border-line-strong bg-bg-elev">
        <div className="flex items-center justify-between border-b border-line px-3 py-2 text-sm">
          <span className="mono font-semibold text-fg">{current}</span>
          <Badge sem={known ? "accent" : "muted"} dot={false}>active</Badge>
        </div>
        <ul className="py-1">
          {options.map((o) => {
            const sel = o.value === current;
            return (
              <li key={o.value} className="flex items-start gap-2 px-3 py-2" style={{ background: sel ? "var(--accent-soft)" : "transparent" }}>
                <span className="mt-0.5 w-4 shrink-0">{sel && <Check size={14} style={{ color: "var(--accent)" }} />}</span>
                <span className="min-w-0">
                  <span className={`mono block text-sm ${sel ? "font-semibold" : ""}`}>{o.label}</span>
                  <span className="block text-xs text-fg-muted">{o.note}</span>
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

export function SettingsForm({ initial, meta }: { initial: Settings; meta: Meta }) {
  const [form, setForm] = useState<Settings>(initial);
  const [saved, setSaved] = useState<Settings>(initial);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ text: string; sem: Sem } | null>(null);
  const [sla, setSla] = useState("standard");
  const [lane, setLane] = useState("l2-queue");
  const dirty = JSON.stringify(form) !== JSON.stringify(saved);

  const save = async () => {
    if (!dirty || busy) return;
    setBusy(true);
    try {
      const s = await api.saveSettings(form);
      setSaved(s); setForm(s);
      setToast({ text: "Saved · applies to the next ticket", sem: "ok" });
    } catch (e) {
      setToast({ text: `Not saved: ${(e as Error).message}`, sem: "crit" });
    } finally {
      setBusy(false);
      setTimeout(() => setToast(null), TOAST_MS);
    }
  };

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_400px]">
      <div className="flex min-w-0 flex-col gap-4">
        <Panel eyebrow="Thresholds" title="Where the graph stops trusting itself"
          right={<div className="flex items-center gap-2">
            <AnimatePresence>{toast && (
              <motion.span initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="rounded-full px-3 py-1 text-[11px] font-semibold" style={{ background: SEM[toast.sem].soft, color: SEM[toast.sem].color }}>{toast.text}</motion.span>
            )}</AnimatePresence>
            {dirty && !busy && <button type="button" onClick={() => setForm(saved)} className="rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-fg-muted hover:border-line-strong">Reset</button>}
            <button type="button" onClick={save} disabled={!dirty || busy} className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white transition disabled:opacity-50" style={{ background: "var(--accent)" }}>
              {busy ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Save
            </button>
          </div>}>
          <div className="grid gap-5 md:grid-cols-2">
            {GATES.map((g) => {
              const v = form[g.key];
              return (
                <div key={g.key} className="rounded-xl border border-line bg-panel-2 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="text-[13px] font-semibold">{g.label}</div>
                      <div className="mono text-[11px] text-fg-faint">{g.key}</div>
                    </div>
                    <div className="text-right">
                      <span className="num text-xl font-semibold" style={{ color: SEM[g.sem].color }}>{v.toFixed(2)}</span>
                      {v !== saved[g.key] && <span className="num block text-[10px] text-fg-faint">was {saved[g.key].toFixed(2)}</span>}
                    </div>
                  </div>
                  <input type="range" min={0} max={1} step={0.05} value={v} aria-label={g.label} onChange={(e) => setForm({ ...form, [g.key]: Number(e.target.value) })}
                    className="mt-3 w-full" style={{ accentColor: SEM[g.sem].color }} />
                  <div className="num flex justify-between text-[10px] text-fg-faint"><span>0 · always</span><span>1 · never</span></div>
                  <p className="mt-2 text-xs leading-snug text-fg-muted"><Badge sem={g.sem} dot={false} className="mr-1 align-middle">{g.owner}</Badge>{g.what}</p>
                </div>
              );
            })}
            <div className="rounded-xl border border-line bg-panel-2 p-4">
              <div className="text-[13px] font-semibold">Max hops</div>
              <div className="mono text-[11px] text-fg-faint">max_hops</div>
              <Select className="mt-3" value={String(form.max_hops)} options={HOPS} onChange={(v) => setForm({ ...form, max_hops: Number(v) })} />
              <p className="mt-2 text-xs leading-snug text-fg-muted"><Badge sem="accent" dot={false} className="mr-1 align-middle">router</Badge>Hop limit for specialist handoffs. When the next hop would reach it, the specialist escalates as a possible routing loop instead of handing off.</p>
            </div>
          </div>
        </Panel>

        <Panel eyebrow="Models" title="Who decides and who writes">
          <div className="grid gap-4 md:grid-cols-2">
            <ProviderDisplay label="Decisions provider" current={meta.decisions} options={DECISIONS} envHint="TYPESAFE_API_KEY → jev" />
            {/* The engine reports the model name for `language`; anything but "stub" is the chat-model option. */}
            <ProviderDisplay label="Language provider" current={meta.language === "stub" ? "stub" : "model"} options={LANGUAGE} envHint="LLM_MODEL" />
          </div>
          <p className="mt-3 text-xs text-fg-faint">Providers are chosen by environment at start-up so a running desk cannot silently switch models. Restart the API to change them.</p>
        </Panel>
      </div>

      <Panel eyebrow="Desk" title="SLA policy and lanes" className="xl:self-start" right={<Badge sem="muted" dot={false}>display only</Badge>}>
        <div className="flex flex-col gap-4">
          <div>
            <Select label="SLA policy" value={sla} options={SLA} onChange={setSla} />
            <p className="mt-1.5 text-xs text-fg-muted">Due times on the queue are computed from priority with this policy. Managed by the desk lead, not by the orchestrator.</p>
          </div>
          <div>
            <Select label="Escalation lanes" value={lane} options={LANES} onChange={setLane} />
            <ul className="mt-2 flex flex-col gap-1.5 text-xs">
              <li className="flex items-center justify-between rounded-lg border border-line px-3 py-2"><span className="inline-flex items-center gap-2"><Badge sem="warn" dot={false}>L2</Badge> queue owners</span><span className="text-fg-muted">missing info · not found · low confidence</span></li>
              <li className="flex items-center justify-between rounded-lg border border-line px-3 py-2"><span className="inline-flex items-center gap-2"><Badge sem="crit" dot={false}>L3</Badge> engineering</span><span className="text-fg-muted">tool errors · known-issue regressions</span></li>
            </ul>
          </div>
          <div className="rounded-lg border border-dashed border-line-strong px-3 py-2 text-[11px] text-fg-faint">Desk settings live in the ticketing system of record. The orchestrator reads them; this console does not write them.</div>
        </div>
      </Panel>
    </div>
  );
}
