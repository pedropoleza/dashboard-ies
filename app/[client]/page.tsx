import type { Metadata } from "next";
import { getClientByKey, resolvePipeline } from "@/lib/clients";
import { resolveRange } from "@/lib/dates";
import { getDashboardData, getFunnelsSummary } from "@/lib/metrics";
import { fmtInt } from "@/lib/format";
import { Header } from "@/components/Header";
import { PipelineTabs } from "@/components/PipelineTabs";
import { KpiRow } from "@/components/KpiRow";
import { Funnel } from "@/components/Funnel";
import { FunnelsSummary } from "@/components/FunnelsSummary";
import { LeadOrigin } from "@/components/LeadOrigin";
import { SdrPerformance } from "@/components/SdrPerformance";
import { PeopleInService } from "@/components/PeopleInService";
import { DrillPanel } from "@/components/DrillPanel";
import { configSeguros } from "@/lib/seguros/config";
import { carregarSeguros } from "@/lib/seguros/dados";
import { Painel } from "@/components/seguros/Painel";
import { abaDaUrl, periodoDaUrl, dataDaUrl } from "@/lib/seguros/navegacao";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ client: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { client: key } = await params;
  const client = await getClientByKey(key);
  return {
    title: client ? `${client.name} · Painel de Performance` : "Painel",
    robots: { index: false, follow: false },
  };
}

function Notice({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card reveal mx-auto mt-10 max-w-xl p-8 text-center">
      <div className="mx-auto mb-4 grid h-11 w-11 place-items-center rounded-xl" style={{ background: "var(--color-paper-2)" }}>
        <span className="live-dot" />
      </div>
      <h2 className="text-xl font-semibold text-ink">{title}</h2>
      <div className="mt-3 text-sm leading-relaxed text-ink-soft">{children}</div>
    </div>
  );
}

export default async function ClientDashboard({ params, searchParams }: PageProps) {
  const { client: key } = await params;
  const client = await getClientByKey(key);
  if (!client) {
    return (
      <main className="mx-auto max-w-xl px-4 py-20">
        <Notice title="Painel não disponível">
          Não há um dashboard configurado para esta conta.
          <span className="mt-2 block text-xs text-ink-faint">ref: {key}</span>
        </Notice>
      </main>
    );
  }

  const sp = await searchParams;
  const range = resolveRange(sp, client.timezone);
  const f = client.features;

  // ── Perfil "seguros" ──────────────────────────────────────────────────────
  // Contas de seguro e recrutamento (hoje: Eliane) precisam de três domínios
  // que o painel padrão não cobre. Elas desviam aqui, com o mesmo cabeçalho,
  // mesmo seletor de período e mesmos tokens visuais.
  if (configSeguros(client.slug)) {
    let seg: Awaited<ReturnType<typeof carregarSeguros>> = null;
    let erroSeg: string | null = null;
    try {
      seg = await carregarSeguros(client);
    } catch (e) {
      erroSeg = e instanceof Error ? e.message : String(e);
    }
    const accent = {
      "--color-ivy": client.accent,
      "--color-ivy-bright": `color-mix(in srgb, ${client.accent} 80%, white)`,
      "--color-ivy-deep": `color-mix(in srgb, ${client.accent} 78%, black)`,
    } as React.CSSProperties;
    return (
      <main className="mx-auto max-w-[1760px] px-4 py-6 sm:px-6 lg:px-8" style={accent}>
        <Header
          client={client}
          preset={range.preset}
          fromValue={typeof sp.from === "string" ? sp.from : undefined}
          toValue={typeof sp.to === "string" ? sp.to : undefined}
          lastSyncAt={seg?.ultimaSync ?? null}
          sp={sp}
          showRange={false}
        />
        <div className="mt-6 space-y-5 sm:space-y-6">
          {erroSeg ? (
            <Notice title="Painel indisponível">
              Não consegui ler os dados agora.
              <span className="mt-2 block text-xs text-ink-faint">{erroSeg}</span>
            </Notice>
          ) : !seg ? null : !seg.ultimaSync ? (
            <Notice title="Aguardando a primeira sincronização">
              A conta está registrada. Rode{" "}
              <code className="rounded bg-paper-2 px-1.5 py-0.5 text-[0.8em]">
                /api/cron/sync?client={client.slug}
              </code>{" "}
              para carregar os dados do GoHighLevel.
            </Notice>
          ) : (
            <>
              <Painel
                slug={client.slug}
                linhas={seg}
                abaInicial={abaDaUrl(sp.aba)}
                periodoInicial={periodoDaUrl(sp.periodo)}
                deInicial={dataDaUrl(sp.de)}
                ateInicial={dataDaUrl(sp.ate)}
              />
              <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5 text-xs text-ink-faint">
                <span>Sincronizado do GoHighLevel a cada 3 horas</span>
                <span>
                  Painel por <span className="text-ink-soft">Sparkleads</span>
                </span>
              </footer>
            </>
          )}
        </div>
      </main>
    );
  }

  const scope = resolvePipeline(client, typeof sp.pipeline === "string" ? sp.pipeline : undefined);

  let data: Awaited<ReturnType<typeof getDashboardData>> | null = null;
  let funnelsSummary: Awaited<ReturnType<typeof getFunnelsSummary>> = [];
  let error: string | null = null;
  try {
    data = await getDashboardData(client, range, scope);
    if (scope.isGeral) funnelsSummary = await getFunnelsSummary(client, range);
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }

  const accentStyle = {
    "--color-ivy": client.accent,
    "--color-ivy-bright": `color-mix(in srgb, ${client.accent} 80%, white)`,
    "--color-ivy-deep": `color-mix(in srgb, ${client.accent} 78%, black)`,
  } as React.CSSProperties;

  return (
    <main className="mx-auto max-w-[1760px] px-4 py-6 sm:px-6 lg:px-8" style={accentStyle}>
      <Header
        client={client}
        preset={range.preset}
        fromValue={typeof sp.from === "string" ? sp.from : undefined}
        toValue={typeof sp.to === "string" ? sp.to : undefined}
        lastSyncAt={data?.syncState?.last_sync_at ?? null}
        sp={sp}
        activePipeline={scope.id}
      />

      {error ? (
        <Notice title="Painel não configurado">
          Faltam variáveis de ambiente do Supabase. <span className="mt-2 block text-xs text-ink-faint">{error}</span>
        </Notice>
      ) : !data ? null : !data.syncState ? (
        <Notice title="Aguardando a primeira sincronização">
          As tabelas estão prontas. Rode <code className="rounded bg-paper-2 px-1.5 py-0.5 text-[0.8em]">/api/cron/sync?client={client.slug}</code> para carregar os dados do GoHighLevel.
        </Notice>
      ) : (
        <div className="mt-6 space-y-5 sm:space-y-6">
          <PipelineTabs client={client} activeId={scope.id} sp={sp} />
          {f.kpis && (
            <KpiRow
              kpis={data.kpis}
              deltas={data.deltas}
              wonLabel={scope.won_label}
              slug={client.slug}
              sp={sp}
            />
          )}

          {(f.funnel || f.leadOrigin) && (
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
              {f.funnel && (
                <div className={f.leadOrigin ? "lg:col-span-7" : "lg:col-span-12"}>
                  {scope.isGeral ? (
                    <FunnelsSummary funnels={funnelsSummary} />
                  ) : (
                    <Funnel funnel={data.funnel} kpis={data.kpis} slug={client.slug} sp={sp} />
                  )}
                </div>
              )}
              {f.leadOrigin && (
                <div className={f.funnel ? "lg:col-span-5" : "lg:col-span-12"}>
                  <LeadOrigin
                    sources={data.sources}
                    channels={data.channels}
                    campaigns={data.campaigns}
                    slug={client.slug}
                    sp={sp}
                  />
                </div>
              )}
            </div>
          )}

          {f.sdr && (
            <SdrPerformance
              agentConv={data.agentConv}
              sdrCalls={data.sdrCalls}
              agentNames={data.agentNames}
              sdrUserIds={client.sdr_user_ids}
              wonLabel={scope.won_label}
              slug={client.slug}
              sp={sp}
            />
          )}

          {f.peopleInService && (
            <PeopleInService
              active={data.active}
              stageNames={data.stageNames}
              stagePos={data.stagePos}
              agentNames={data.agentNames}
              totalActive={data.kpis.total_active}
            />
          )}

          <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5 text-xs text-ink-faint">
            <span>
              Sincronizado do GoHighLevel
              {data.syncState?.total_count ? ` · ${fmtInt(data.syncState.total_count)} oportunidades` : ""}
            </span>
            <span>
              Painel por <span className="text-ink-soft">Sparkleads</span>
            </span>
          </footer>

          <DrillPanel client={client} range={range} scope={scope} sp={sp} />
        </div>
      )}
    </main>
  );
}
