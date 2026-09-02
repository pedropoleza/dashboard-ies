import Link from "next/link";
import type { SourceRow, ChannelRow, CampaignRow } from "@/lib/metrics";
import { SectionHeader } from "./SectionHeader";
import { Donut } from "./Donut";
import { sourceColor } from "@/lib/stages";
import { fmtInt, fmtPct, pct } from "@/lib/format";
import { clientHref } from "@/lib/url";

type SP = Record<string, string | string[] | undefined>;

const CHANNEL_LABELS: Record<string, string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  google: "Google",
  tiktok: "TikTok",
};

function channelLabel(c: string): string {
  return CHANNEL_LABELS[c.toLowerCase()] ?? c;
}

export function LeadOrigin({
  sources,
  channels,
  campaigns,
  slug,
  sp,
}: {
  sources: SourceRow[];
  channels: ChannelRow[];
  campaigns: CampaignRow[];
  slug: string;
  sp: SP;
}) {
  const total = sources.reduce((acc, s) => acc + Number(s.count), 0);
  const segments = sources.map((s) => ({
    label: s.category,
    value: Number(s.count),
    color: sourceColor(s.category),
  }));
  const topChannels = channels.slice(0, 6);
  const channelMax = Math.max(1, ...topChannels.map((c) => Number(c.count)));
  const sourceHref = (value: string) =>
    clientHref(slug, sp, { drill: "source", value, sdr: undefined, mode: undefined });

  return (
    <section className="card reveal p-5 sm:p-6" style={{ animationDelay: "120ms" }}>
      <SectionHeader eyebrow="Origem dos leads" title="De onde eles vêm" />

      <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center">
        <div className="relative grid shrink-0 place-items-center">
          <Donut segments={segments} total={total} />
          <div className="absolute text-center">
            <div className="font-display tnum text-3xl leading-none text-ink">{fmtInt(total)}</div>
            <div className="mt-1 text-[0.65rem] uppercase tracking-wider text-ink-faint">leads</div>
          </div>
        </div>

        <ul className="w-full flex-1 space-y-1">
          {segments.map((s) => (
            <li key={s.label}>
              <Link
                href={sourceHref(s.label)}
                scroll={false}
                prefetch={false}
                className="-mx-2 flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-paper-2/70"
              >
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: s.color }} />
                <span className="flex-1 truncate text-ink-soft">{s.label}</span>
                <span className="tnum font-medium text-ink">{fmtInt(s.value)}</span>
                <span className="tnum w-11 text-right text-xs text-ink-faint">
                  {total ? fmtPct(pct(s.value, total), 0) : "—"}
                </span>
              </Link>
            </li>
          ))}
          {segments.length === 0 && <li className="text-sm text-ink-faint">Sem dados no período.</li>}
        </ul>
      </div>

      {topChannels.length > 0 && (
        <>
          <div className="hairline my-6" />
          <div className="eyebrow mb-3">Canais de aquisição</div>
          <div className="space-y-2.5">
            {topChannels.map((ch) => {
              const count = Number(ch.count);
              return (
                <Link
                  key={ch.channel}
                  href={sourceHref(ch.channel)}
                  scroll={false}
                  prefetch={false}
                  className="-mx-2 flex items-center gap-3 rounded-md px-2 py-1 transition-colors hover:bg-paper-2/70"
                >
                  <span className="w-28 shrink-0 truncate text-sm text-ink-soft" title={ch.channel}>
                    {channelLabel(ch.channel)}
                  </span>
                  <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-paper-2">
                    <div
                      className="bar-grow absolute inset-y-0 left-0 rounded-full"
                      style={{
                        width: `${(count / channelMax) * 100}%`,
                        background: "var(--color-ivy)",
                      }}
                    />
                  </div>
                  <span className="tnum w-10 text-right text-sm text-ink">{fmtInt(count)}</span>
                </Link>
              );
            })}
          </div>
        </>
      )}

      {campaigns.length > 0 && (
        <>
          <div className="hairline my-6" />
          <div className="eyebrow mb-3">Principais campanhas</div>
          <ul className="space-y-0.5">
            {campaigns.slice(0, 4).map((c) => (
              <li key={c.campaign}>
                <Link
                  href={clientHref(slug, sp, { drill: "campaign", value: c.campaign, sdr: undefined, mode: undefined })}
                  scroll={false}
                  prefetch={false}
                  className="-mx-2 flex items-center gap-3 rounded-md px-2 py-1 text-[0.8rem] transition-colors hover:bg-paper-2/70"
                >
                  <span className="flex-1 truncate text-ink-soft" title={c.campaign}>
                    {c.campaign}
                  </span>
                  <span className="tnum text-ink">{fmtInt(c.count)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
