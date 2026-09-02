export type DonutSegment = { label: string; value: number; color: string };

export function Donut({
  segments,
  total,
  size = 158,
  thickness = 15,
}: {
  segments: DonutSegment[];
  total: number;
  size?: number;
  thickness?: number;
}) {
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  let acc = 0;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
      <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--color-line-soft)"
          strokeWidth={thickness}
        />
        {total > 0 &&
          segments.map((s) => {
            const len = (s.value / total) * c;
            const dash = Math.max(0, len - 2.5); // small gap between arcs
            const node = (
              <circle
                key={s.label}
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                stroke={s.color}
                strokeWidth={thickness}
                strokeDasharray={`${dash} ${c - dash}`}
                strokeDashoffset={-acc}
                strokeLinecap="butt"
              />
            );
            acc += len;
            return node;
          })}
      </g>
    </svg>
  );
}
