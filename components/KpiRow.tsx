import Link from "next/link";
import type { Kpis, Deltas } from "@/lib/metrics";
import { fmtInt, fmtPct, pct } from "@/lib/format";
import { clientHref } from "@/lib/url";

type SP = Record<string, string | string[] | undefined>;

function Delta({ value, invert = false }: { value: number | null; invert?: boolean }) {
  if (value === null) return null;
  const flat = Math.abs(value) < 0.5;
  const positive = invert ? value < 0 : value > 0;
  const color = flat ? "var(--color-ink-faint)" : positive ? "var(--color-sage)" : "var(--color-terra)";
  const arrow = flat ? "→" : value > 0 ? "↑" : "↓";
  return (
    <span className="tnum inline-flex items-center gap-0.5 font-medium" style={{ color }}>
      {arrow}
      {Math.abs(value).toFixed(0)}%
    </span>
  );
}

function Cell({
  href,
  label,
  value,
  delta,
  invert,
  sub,
}: {
  href: string;
  label: string;
  value: string;
  delta?: number | null;
  invert?: boolean;
  sub: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      scroll={false}
      prefetch={false}
      className="group -mb-px -mr-px border-b border-r border-line p-4 transition-colors hover:bg-paper-2/60 sm:p-5"
    >
      <div className="eyebrow">{label}</div>
      <div className="font-display mt-2.5 text-[1.85rem] leading-none text-ink">{value}</div>
      <div className="mt-2 flex items-center gap-1.5 text-xs text-ink-soft">
        {delta !== undefined && <Delta value={delta ?? null} invert={invert} />}
        <span>{sub}</span>
      </div>
    </Link>
  );
}

export function KpiRow({
  kpis,
  deltas,
  wonLabel = "Fechados",
  slug,
  sp,
}: {
  kpis: Kpis;
  deltas: Deltas;
  wonLabel?: string;
  slug: string;
  sp: SP;
}) {
  const conv = pct(kpis.deals_closed, kpis.total_leads);
  const apptRate = pct(kpis.appts_set, kpis.total_leads);
  const hf = (value: string) => clientHref(slug, sp, { drill: "kpi", value, sdr: undefined, mode: undefined });

  return (
    <section className="card reveal overflow-hidden">
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5">
        <Cell href={hf("leads")} label="Leads" value={fmtInt(kpis.total_leads)} delta={deltas.leads} sub={`${fmtInt(kpis.open_count)} em aberto`} />
        <Cell href={hf("appts")} label="Agendamentos" value={fmtInt(kpis.appts_set)} delta={deltas.appts} sub={`${fmtPct(apptRate)} dos leads`} />
        <Cell href={hf("won")} label={wonLabel} value={fmtInt(kpis.deals_closed)} delta={deltas.deals} sub={`${fmtPct(conv)} de conversão`} />
        <Cell href={hf("open")} label="Em atendimento" value={fmtInt(kpis.total_active)} sub="no funil agora" />
        <Cell href={hf("lost")} label="Perdidos" value={fmtInt(kpis.lost_count)} delta={deltas.lost} invert sub="no período" />
      </div>
    </section>
  );
}
