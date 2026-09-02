import type { FunnelSummaryRow } from "@/lib/metrics";
import { SectionHeader } from "./SectionHeader";
import { fmtInt, fmtPct, pct } from "@/lib/format";

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[0.6rem] font-semibold uppercase tracking-wide text-ink-faint">{label}</div>
      <div className="font-display tnum mt-0.5 text-lg text-ink">{value}</div>
    </div>
  );
}

export function FunnelsSummary({ funnels }: { funnels: FunnelSummaryRow[] }) {
  return (
    <section className="card reveal p-5 sm:p-6" style={{ animationDelay: "120ms" }}>
      <SectionHeader eyebrow="Visão geral" title="Desempenho por funil" />
      <div className="space-y-3">
        {funnels.map((fn, i) => {
          const conv = pct(fn.won, fn.leads);
          const max = Math.max(1, ...funnels.map((x) => x.leads));
          return (
            <div key={fn.id} className="rounded-lg border border-line p-4" style={{ animationDelay: `${i * 60}ms` }}>
              <div className="flex items-center justify-between">
                <span className="text-[0.95rem] font-semibold text-ink">{fn.label}</span>
                <span className="text-xs text-ink-soft">
                  conversão <span className="font-display tnum text-ink">{fmtPct(conv, 1)}</span>
                </span>
              </div>
              <div className="mt-2 h-1 overflow-hidden rounded-full bg-paper-2">
                <div
                  className="bar-grow h-full rounded-full"
                  style={{ width: `${(fn.leads / max) * 100}%`, background: "var(--color-ivy)" }}
                />
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2">
                <Stat label="Leads" value={fmtInt(fn.leads)} />
                <Stat label="Agendam." value={fmtInt(fn.appts)} />
                <Stat label={fn.won_label} value={fmtInt(fn.won)} />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
