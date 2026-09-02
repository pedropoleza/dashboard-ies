import { initials } from "@/lib/format";

export function Avatar({
  name,
  size = 36,
  rank,
}: {
  name: string | null | undefined;
  size?: number;
  rank?: number;
}) {
  const ring =
    rank === 1
      ? "var(--color-gold)"
      : rank === 2
        ? "#b9b09a"
        : rank === 3
          ? "#c98a5e"
          : "transparent";
  return (
    <span
      className="relative inline-grid shrink-0 select-none place-items-center rounded-full border border-line font-semibold text-ink-soft"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.36,
        background: "var(--color-paper-2)",
        boxShadow: rank && rank <= 3 ? `0 0 0 2px var(--color-card), 0 0 0 3.5px ${ring}` : "none",
      }}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}
