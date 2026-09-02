import Link from "next/link";
import type { AgentConvRow, SdrCallRow } from "@/lib/metrics";
import { SectionHeader } from "./SectionHeader";
import { Avatar } from "./Avatar";
import { Ring } from "./Ring";
import { fmtInt, fmtPct, fmtRelative, fmtDuration, pct } from "@/lib/format";
import { clientHref } from "@/lib/url";

type SP = Record<string, string | string[] | undefined>;

type Merged = {
  user_id: string;
  name: string;
  calls: number;
  successCalls: number;
  callLeads: number;
  avgSeconds: number | null;
  lastCall: string | null;
  leads: number;
  appts: number;
  won: number;
};

function rankStyle(rank: number): { bg: string; color: string } {
  if (rank === 1) return { bg: "rgba(180,131,9,0.12)", color: "#9a6a08" };
  if (rank === 2) return { bg: "rgba(100,110,125,0.12)", color: "#5b6675" };
  if (rank === 3) return { bg: "rgba(180,83,9,0.10)", color: "#9c5a2a" };
  return { bg: "var(--color-paper-2)", color: "var(--color-ink-faint)" };
}

function ringColor(eff: number | null): string {
  if (eff === null) return "var(--color-line)";
  if (eff >= 50) return "var(--color-sage)";
  if (eff >= 35) return "var(--color-ivy)";
  return "var(--color-gold)";
}

function FooterStat({
  href,
  label,
  value,
  border,
}: {
  href?: string;
  label: string;
  value: string;
  border?: boolean;
}) {
  const inner = (
    <>
      <div className="text-[0.6rem] font-semibold uppercase tracking-wide text-ink-faint">{label}</div>
      <div className="font-display tnum mt-1.5 text-[1.05rem] text-ink">{value}</div>
    </>
  );
  const cls = `block px-2 text-center ${border ? "border-l border-line" : ""}`;
  if (href) {
    return (
      <Link href={href} scroll={false} prefetch={false} className={`${cls} rounded-md transition-colors hover:bg-paper-2/70`}>
        {inner}
      </Link>
    );
  }
  return <div className={cls}>{inner}</div>;
}

function ScoreCard({
  a,
  rank,
  delay,
  wonLabel,
  slug,
  sp,
}: {
  a: Merged;
  rank: number;
  delay: number;
  wonLabel: string;
  slug: string;
  sp: SP;
}) {
  const eff = a.calls > 0 ? pct(a.successCalls, a.calls) : null;
  const conv = pct(a.won, a.leads);
  const rs = rankStyle(rank);
  const callsHref = (mode: string) =>
    clientHref(slug, sp, { drill: "calls", sdr: a.user_id, mode, value: undefined });

  return (
    <div
      className="card reveal flex flex-col p-5 transition-shadow duration-300 hover:shadow-[var(--shadow-lift)]"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-center gap-3">
        <Avatar name={a.name} size={40} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[0.95rem] font-semibold text-ink" title={a.name}>{a.name}</div>
          <div className="text-xs text-ink-faint">Atendente · SDR</div>
        </div>
        <span
          className="tnum grid h-6 w-6 place-items-center rounded-full text-[0.72rem] font-bold"
          style={{ background: rs.bg, color: rs.color }}
        >
          {rank}
        </span>
      </div>

      <div className="mt-5 flex items-center gap-5">
        <div className="flex flex-col items-center gap-1.5">
          <div className="relative grid place-items-center">
            <Ring percent={eff} size={62} stroke={6} color={ringColor(eff)} />
            <span className="tnum absolute text-[0.82rem] font-semibold text-ink">
              {eff !== null ? `${eff.toFixed(0)}%` : "—"}
            </span>
          </div>
          <span className="text-[0.58rem] font-semibold uppercase tracking-wide text-ink-faint">Efetividade</span>
        </div>
        <div className="min-w-0">
          <Link
            href={callsHref("all")}
            scroll={false}
            prefetch={false}
            className="-mx-1 inline-block rounded-md px-1 transition-colors hover:bg-paper-2/70"
          >
            <div className="flex items-baseline gap-1.5">
              <span className="font-display tnum text-[1.9rem] leading-none text-ink">{fmtInt(a.calls)}</span>
              <span className="text-xs text-ink-faint">chamadas</span>
            </div>
          </Link>
          <div className="tnum mt-2.5 text-[0.8rem] text-ink-soft">
            <Link
              href={callsHref("connected")}
              scroll={false}
              prefetch={false}
              className="-mx-0.5 rounded px-0.5 text-ink transition-colors hover:bg-paper-2/70"
            >
              {fmtInt(a.successCalls)}
            </Link>{" "}
            conectadas · média {fmtDuration(a.avgSeconds)}
          </div>
          <div className="tnum text-[0.8rem] text-ink-faint">
            <Link
              href={callsHref("leads")}
              scroll={false}
              prefetch={false}
              className="-mx-0.5 rounded px-0.5 transition-colors hover:bg-paper-2/70 hover:text-ink-soft"
            >
              {fmtInt(a.callLeads)} leads únicos
            </Link>
          </div>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-3 border-t border-line pt-4">
        <FooterStat label="Agendam." value={fmtInt(a.appts)} />
        <FooterStat label={wonLabel} value={fmtInt(a.won)} border />
        <FooterStat label="Conversão" value={fmtPct(conv, 0)} border />
      </div>

      <div className="mt-4 flex items-center gap-1.5 text-[0.72rem] text-ink-faint">
        <span className="h-1 w-1 rounded-full bg-current opacity-60" />
        última chamada {fmtRelative(a.lastCall)}
      </div>
    </div>
  );
}

export function SdrPerformance({
  agentConv,
  sdrCalls,
  agentNames,
  sdrUserIds,
  wonLabel = "Fechados",
  slug,
  sp,
}: {
  agentConv: AgentConvRow[];
  sdrCalls: SdrCallRow[];
  agentNames: Record<string, string>;
  sdrUserIds: string[];
  wonLabel?: string;
  slug: string;
  sp: SP;
}) {
  const convById = new Map(agentConv.map((a) => [a.user_id, a]));
  const callsById = new Map(sdrCalls.map((c) => [c.user_id, c]));

  const agents: Merged[] = sdrUserIds.map((id) => {
    const c = callsById.get(id);
    const o = convById.get(id);
    return {
      user_id: id,
      name: c?.name || o?.name || agentNames[id] || "Atendente",
      calls: Number(c?.total_calls ?? 0),
      successCalls: Number(c?.successful_calls ?? 0),
      callLeads: Number(c?.total_leads ?? 0),
      avgSeconds: c?.avg_seconds != null ? Number(c.avg_seconds) : null,
      lastCall: c?.last_call ?? null,
      leads: Number(o?.leads ?? 0),
      appts: Number(o?.appts ?? 0),
      won: Number(o?.won ?? 0),
    };
  }).sort((x, y) => y.calls - x.calls || y.won - x.won);

  return (
    <section>
      <SectionHeader
        eyebrow="Performance dos atendentes"
        title="Equipe de SDR"
        hint="Atividade de chamadas + conversão no período"
      />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {agents.map((a, i) => (
          <ScoreCard key={a.user_id} a={a} rank={i + 1} delay={i * 60 + 120} wonLabel={wonLabel} slug={slug} sp={sp} />
        ))}
      </div>
    </section>
  );
}
