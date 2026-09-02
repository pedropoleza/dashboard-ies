import Link from "next/link";
import type { FunnelStage, Kpis } from "@/lib/metrics";
import { SectionHeader } from "./SectionHeader";
import { stageColor } from "@/lib/stages";
import { fmtInt, fmtPct, pct } from "@/lib/format";
import { clientHref } from "@/lib/url";

type SP = Record<string, string | string[] | undefined>;

export function Funnel({
  funnel,
  kpis,
  slug,
  sp,
}: {
  funnel: FunnelStage[];
  kpis: Kpis;
  slug: string;
  sp: SP;
}) {
  const stages = [...funnel].sort((a, b) => a.stage_position - b.stage_position);
  const total = stages.reduce((acc, s) => acc + Number(s.count), 0);
  const max = Math.max(1, ...stages.map((s) => Number(s.count)));
  const conv = pct(kpis.deals_closed, kpis.total_leads);
  const stageHref = (id: string) =>
    clientHref(slug, sp, { drill: "stage", value: id, sdr: undefined, mode: undefined });

  return (
    <section className="card reveal p-5 sm:p-6">
      <SectionHeader
        eyebrow="Funil de vendas"
        title="Distribuição por etapa"
        hint={
          <span>
            Conversão geral <span className="font-display ml-0.5 text-ink">{fmtPct(conv)}</span>
          </span>
        }
      />
      <div className="space-y-1">
        {stages.map((s, i) => {
          const count = Number(s.count);
          const width = Math.max(count > 0 ? 3 : 0, (count / max) * 100);
          const color = stageColor(s.stage_position);
          return (
            <Link
              key={s.stage_id}
              href={stageHref(s.stage_id)}
              scroll={false}
              prefetch={false}
              className="-mx-2 grid grid-cols-[136px_1fr_auto] items-center gap-3 rounded-md px-2 py-1.5 transition-colors hover:bg-paper-2/70 sm:grid-cols-[168px_1fr_auto]"
            >
              <div className="flex items-center gap-2 overflow-hidden">
                <span className="h-2 w-2 shrink-0 rounded-[2px]" style={{ background: color }} />
                <span className="truncate text-[0.82rem] text-ink-soft" title={s.name}>
                  {s.name}
                </span>
              </div>
              <div className="funnel-track relative h-7 overflow-hidden rounded-md">
                <div
                  className="bar-grow absolute inset-y-0 left-0 rounded-md"
                  style={{ width: `${width}%`, background: color, animationDelay: `${i * 55 + 150}ms` }}
                />
              </div>
              <div className="flex w-[92px] items-baseline justify-end gap-2">
                <span className="font-display tnum text-[0.95rem] text-ink">{fmtInt(count)}</span>
                <span className="tnum w-9 text-right text-xs text-ink-faint">
                  {total ? fmtPct(pct(count, total), 0) : "—"}
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
