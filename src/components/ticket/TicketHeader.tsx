/**
 * Ticket page header: id, status / lane / priority badges, customer line, timing line, and actions.
 * Reads the ticket. "Reprocess" re-runs it through `api.reprocess` and refreshes the page;
 * "Assign" and "Close" are demo-only and record their state locally, never on the engine.
 */
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Loader2, RefreshCw, UserRound, XCircle } from "lucide-react";
import type { Ticket } from "@/lib/types";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";
import { channelIcon, laneSem, prioritySem, SEM, slaCountdown, statusLabel, statusSem, timeAgo } from "@/lib/semantics";

/** Demo actions kept in component state only. */
type LocalAction = "L2" | "L3" | "closed" | null;
type ToastSem = "ok" | "warn" | "crit";

const TOAST_MS = 3000;
const BTN = "inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-semibold transition disabled:opacity-50";

/** "SLA due in 4h" / "SLA overdue by 2h". */
function dueIn(iso: string) {
  const { overdue, span } = slaCountdown(iso);
  return overdue ? `SLA overdue by ${span}` : `SLA due in ${span}`;
}

/** Toggle-button styling: tinted when the action is on, plain otherwise. */
const ghost = (on: boolean, sem: "warn" | "crit" | "muted") => on
  ? { background: SEM[sem].soft, color: SEM[sem].color, borderColor: "transparent" }
  : { background: "var(--bg-elev)", color: "var(--fg)", borderColor: "var(--line-strong)" };

export function TicketHeader({ ticket: t }: { ticket: Ticket }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [local, setLocal] = useState<LocalAction>(null);
  const [toast, setToast] = useState<{ text: string; sem: ToastSem } | null>(null);

  const say = (text: string, sem: ToastSem = "ok") => { setToast({ text, sem }); setTimeout(() => setToast(null), TOAST_MS); };
  const reprocess = async () => {
    if (busy) return;
    setBusy(true);
    try { const r = await api.reprocess(t.ticket_id); say(`Reprocessed · ${r.status === "resolved" ? "resolved by " + r.route_history.join(" → ") : "escalated to " + r.lane}`); router.refresh(); }
    catch (e) { say(`Reprocess failed: ${(e as Error).message}`, "crit"); }
    finally { setBusy(false); }
  };
  const demo = (a: LocalAction) => { setLocal((cur) => (cur === a ? null : a)); say("recorded locally — demo", "warn"); };

  return (
    <div className="panel p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="mono text-lg font-semibold tracking-tight">{t.ticket_id}</span>
            <Badge sem={statusSem(t.status)}>{statusLabel(t)}</Badge>
            <Badge sem={laneSem(t.lane)} dot={false}>lane {t.lane}</Badge>
            <Badge sem={prioritySem(t.priority)} dot={false} className="mono">{t.priority}</Badge>
            {local && <Badge sem={local === "closed" ? "muted" : local === "L3" ? "crit" : "warn"} dot={false}>{local === "closed" ? "closed · local" : `assigned ${local} · local`}</Badge>}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-fg-muted">
            <span className="font-medium text-fg">{t.customer}</span>
            <span className="text-fg-faint">·</span><span>{t.company}</span>
            <span className="text-fg-faint">·</span>
            <span className="inline-flex items-center gap-1"><Icon name={channelIcon[t.channel] ?? "Circle"} size={13} className="text-fg-faint" />{t.channel}</span>
          </div>
          {/* Age and SLA depend on the wall clock, so server and client text can differ by a minute: suppress the mismatch warning. */}
          <div className="num mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-fg-muted">
            <span title={new Date(t.created_at).toLocaleString()} suppressHydrationWarning>created {timeAgo(t.created_at)}</span>
            <span className="text-fg-faint">·</span>
            <span className="inline-flex items-center gap-1"><UserRound size={12} className="text-fg-faint" />{t.assignee}</span>
            <span className="text-fg-faint">·</span>
            {t.status === "resolved" ? <Badge sem="ok" dot={false}>SLA met</Badge> : t.sla_breached ? <Badge sem="crit">SLA breached</Badge> : <span title={new Date(t.sla_due).toLocaleString()} suppressHydrationWarning>{dueIn(t.sla_due)}</span>}
            <span className="text-fg-faint">·</span>
            <span>{t.hops} {t.hops === 1 ? "hop" : "hops"}</span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={reprocess} disabled={busy} className={`${BTN} text-white`} style={{ background: "var(--accent)", borderColor: "transparent" }}>
            {busy ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />} Reprocess
          </button>
          <button type="button" onClick={() => demo("L2")} className={BTN} style={ghost(local === "L2", "warn")}>{local === "L2" && <Check size={13} />} Assign to L2</button>
          <button type="button" onClick={() => demo("L3")} className={BTN} style={ghost(local === "L3", "crit")}>{local === "L3" && <Check size={13} />} Assign to L3</button>
          <button type="button" onClick={() => demo("closed")} className={BTN} style={ghost(local === "closed", "muted")}><XCircle size={13} /> {local === "closed" ? "Reopen" : "Close"}</button>
        </div>
      </div>
      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} role="status"
            className="mt-3 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold" style={{ background: SEM[toast.sem].soft, color: SEM[toast.sem].color }}>
            {toast.text}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
