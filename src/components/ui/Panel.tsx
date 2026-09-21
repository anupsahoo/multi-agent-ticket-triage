/**
 * The card every screen is built from: `.panel` surface with an optional eyebrow / title / right slot header.
 * Reads nothing; renders `children` below the header.
 */
export function Panel({ title, eyebrow, right, children, className = "", padded = true }: {
  title?: string; eyebrow?: string;
  /** Header's right-hand slot: a count, a link, a badge. */
  right?: React.ReactNode;
  children: React.ReactNode; className?: string;
  /** false lets tables and lists run edge to edge; the header then pads itself. */
  padded?: boolean;
}) {
  return (
    <section className={`panel min-w-0 ${padded ? "p-5" : ""} ${className}`}>
      {(title || eyebrow || right) && (
        <header className={`flex items-start justify-between gap-3 ${padded ? "mb-4" : "px-5 pt-5 pb-3"}`}>
          <div>
            {eyebrow && <div className="eyebrow">{eyebrow}</div>}
            {title && <h2 className="mt-0.5 text-[15px] font-semibold tracking-tight">{title}</h2>}
          </div>
          {right}
        </header>
      )}
      {children}
    </section>
  );
}
