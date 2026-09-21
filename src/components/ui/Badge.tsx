/**
 * Pill label in one of the semantic tones: soft background, solid text, optional status dot.
 * Reads nothing; renders `children` inside the tone from `SEM`.
 */
import { SEM, type Sem } from "@/lib/semantics";

export function Badge({ sem, children, dot = true, className = "" }: {
  sem: Sem; children: React.ReactNode;
  /** Leading dot reads as "status"; pass false for plain tags like a priority or a count. */
  dot?: boolean;
  className?: string;
}) {
  const s = SEM[sem];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold tracking-wide ${className}`}
      style={{ background: s.soft, color: s.color }}>
      {dot && <span className="h-1.5 w-1.5 rounded-full" style={{ background: s.color }} />}
      {children}
    </span>
  );
}
