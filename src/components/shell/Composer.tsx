/**
 * Ticket composer pinned to the bottom of every screen.
 * Reads nothing on mount; on submit it POSTs the message through `api.submit`, which runs
 * the orchestrator synchronously, then navigates to the new ticket and shows a short toast.
 */
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Send, Loader2, Sparkles } from "lucide-react";
import { api } from "@/lib/api";
import { capitalize } from "@/lib/semantics";
import { Select } from "@/components/ui/Select";

const CHANNELS = ["portal", "email", "chat", "phone"].map((c) => ({ value: c, label: capitalize(c) }));
/** Empty value means "let the engine pick a priority". */
const PRIORITIES = [{ value: "", label: "Auto priority" }, ...["P1", "P2", "P3", "P4"].map((p) => ({ value: p, label: p }))];
const TOAST_MS = 3500;

export function Composer() {
  const [text, setText] = useState("");
  const [channel, setChannel] = useState("portal");
  const [priority, setPriority] = useState("");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const router = useRouter();

  const submit = async () => {
    const message = text.trim();
    if (!message || busy) return;
    setBusy(true);
    try {
      const t = await api.submit({ message, channel, priority: priority || undefined });
      setText("");
      setToast(`${t.ticket_id} · ${t.status === "resolved" ? "resolved by " + t.route_history.join(" → ") : "escalated to " + t.lane}`);
      setTimeout(() => setToast(null), TOAST_MS);
      router.push(`/queue/${t.ticket_id}`);
      // The layout and every list are server-rendered; refresh so they include the new ticket.
      router.refresh();
    } finally { setBusy(false); }
  };

  return (
    <div className="sticky bottom-0 z-30 border-t border-line bg-bg-elev/95 px-4 py-3 backdrop-blur md:px-6">
      <AnimatePresence>{toast && (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mb-2 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold" style={{ background: "var(--ok-soft)", color: "var(--ok)" }}>
          <Sparkles size={12} /> {toast}
        </motion.div>)}</AnimatePresence>
      <div className="mx-auto flex min-w-0 max-w-6xl items-end gap-2">
        <div className="min-w-0 flex-1 rounded-xl border border-line-strong bg-bg-elev focus-within:border-accent" style={{ boxShadow: "0 1px 2px rgba(15,23,42,.04)" }}>
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={1}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } }}
            placeholder="Paste a customer message and the orchestrator will triage it…  (Enter to run, Shift+Enter for a new line)"
            className="block w-full resize-none bg-transparent px-4 py-3 text-sm outline-none placeholder:text-fg-faint" />
          <div className="flex min-w-0 flex-wrap items-center gap-2 border-t border-line px-3 py-2">
            <Select size="sm" value={channel} options={CHANNELS} onChange={setChannel} className="w-28 shrink" />
            <Select size="sm" value={priority} options={PRIORITIES} onChange={setPriority} className="w-32 shrink" />
            <span className="ml-auto hidden text-[11px] text-fg-faint md:inline">Router → specialist → tool → checks → resolve or hand to L2/L3</span>
          </div>
        </div>
        <button type="button" onClick={submit} disabled={busy || !text.trim()}
          className="flex h-11 items-center gap-2 rounded-xl px-4 text-sm font-semibold text-white transition disabled:opacity-50" style={{ background: "var(--accent)" }}>
          {busy ? <Loader2 size={16} className="animate-spin" /> : <Send size={15} />} Triage
        </button>
      </div>
    </div>
  );
}
