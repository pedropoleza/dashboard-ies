export function SectionHeader({
  eyebrow,
  title,
  hint,
}: {
  eyebrow: string;
  title: string;
  hint?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4">
      <div>
        <div className="eyebrow mb-1">{eyebrow}</div>
        <h2 className="text-[1.05rem] font-semibold leading-none text-ink">{title}</h2>
      </div>
      {hint ? <div className="text-right text-xs text-ink-soft">{hint}</div> : null}
    </div>
  );
}
