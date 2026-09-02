import Link from "next/link";
import { getDrill, type DrillResult } from "@/lib/drills";
import { clientHref } from "@/lib/url";
import { fmtInt, fmtDateTime, fmtDuration } from "@/lib/format";
import type { ClientConfig, PipelineScope } from "@/lib/clients";
import type { Range } from "@/lib/dates";

type SP = Record<string, string | string[] | undefined>;

export async function DrillPanel({
  client,
  range,
  scope,
  sp,
}: {
  client: ClientConfig;
  range: Range;
  scope: PipelineScope;
  sp: SP;
}) {
  const result = await getDrill(client, range, scope, sp);
  if (!result) return null;
  const closeHref = clientHref(client.slug, sp, {
    drill: undefined,
    value: undefined,
    sdr: undefined,
    mode: undefined,
  });

  return (
    <div className="fixed inset-0 z-50">
      <Link
        href={closeHref}
        scroll={false}
        prefetch={false}
        aria-label="Fechar"
        className="absolute inset-0 bg-ink/30 backdrop-blur-sm"
      />
      <aside className="reveal absolute right-0 top-0 flex h-full w-full max-w-2xl flex-col bg-card shadow-2xl">
        <header className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-line bg-card px-5 py-4">
          <div className="min-w-0">
            <div className="eyebrow">Detalhes</div>
            <h2 className="truncate text-base font-semibold text-ink" title={result.title}>{result.title}</h2>
            <div className="mt-0.5 text-xs text-ink-faint">
              {fmtInt(result.total)} {result.total === 1 ? "registro" : "registros"}
              {result.total === 300 && <span className="ml-1 text-ink-faint">(top 300)</span>}
            </div>
          </div>
          <Link
            href={closeHref}
            scroll={false}
            prefetch={false}
            className="shrink-0 rounded-md border border-line bg-card px-2.5 py-1 text-xs font-medium text-ink-soft transition-colors hover:text-ink"
          >
            Fechar
          </Link>
        </header>
        <div className="scroll-thin flex-1 overflow-y-auto">
          <DrillBody result={result} />
        </div>
      </aside>
    </div>
  );
}

function DrillBody({ result }: { result: DrillResult }) {
  if (result.kind === "opps") {
    if (!result.rows.length) return <Empty>Nenhum registro encontrado.</Empty>;
    return (
      <table className="w-full text-sm">
        <thead className="sticky top-0 z-10 bg-card">
          <tr className="text-left text-[0.62rem] uppercase tracking-wide text-ink-faint">
            <th className="border-b border-line px-4 py-2.5 font-semibold">Contato</th>
            <th className="border-b border-line px-3 py-2.5 font-semibold">Etapa</th>
            <th className="hidden border-b border-line px-3 py-2.5 font-semibold sm:table-cell">Origem</th>
            <th className="hidden border-b border-line px-3 py-2.5 font-semibold md:table-cell">Atendente</th>
            <th className="border-b border-line px-4 py-2.5 text-right font-semibold">Atualização</th>
          </tr>
        </thead>
        <tbody>
          {result.rows.map((r) => (
            <tr key={r.id} className="border-t border-line">
              <td className="px-4 py-2 font-medium text-ink">{r.contact_name || r.name || "—"}</td>
              <td className="px-3 py-2 text-ink-soft">{r.stage_id ? result.stageNames[r.stage_id] ?? "—" : "—"}</td>
              <td className="hidden px-3 py-2 text-ink-soft sm:table-cell">{r.source_category || "—"}</td>
              <td className="hidden px-3 py-2 text-ink-soft md:table-cell">
                {r.assigned_to ? result.agentNames[r.assigned_to] ?? "—" : "—"}
              </td>
              <td className="tnum px-4 py-2 text-right text-ink-faint">{fmtDateTime(r.last_stage_change_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  if (result.kind === "calls") {
    if (!result.rows.length) return <Empty>Sem ligações no período.</Empty>;
    return (
      <table className="w-full text-sm">
        <thead className="sticky top-0 z-10 bg-card">
          <tr className="text-left text-[0.62rem] uppercase tracking-wide text-ink-faint">
            <th className="border-b border-line px-4 py-2.5 font-semibold">Contato</th>
            <th className="border-b border-line px-3 py-2.5 font-semibold">Telefone</th>
            <th className="hidden border-b border-line px-3 py-2.5 font-semibold sm:table-cell">Direção</th>
            <th className="border-b border-line px-3 py-2.5 text-right font-semibold">Duração</th>
            <th className="hidden border-b border-line px-3 py-2.5 font-semibold sm:table-cell">Status</th>
            <th className="border-b border-line px-4 py-2.5 text-right font-semibold">Hora</th>
          </tr>
        </thead>
        <tbody>
          {result.rows.map((r, i) => (
            <tr key={i} className="border-t border-line">
              <td className="px-4 py-2 font-medium text-ink">{r.contact_name || "—"}</td>
              <td className="tnum px-3 py-2 text-ink-soft">{r.contact_phone || "—"}</td>
              <td className="hidden px-3 py-2 text-ink-soft sm:table-cell">{r.direction || "—"}</td>
              <td className="tnum px-3 py-2 text-right text-ink-soft">{fmtDuration(r.duration)}</td>
              <td className="hidden px-3 py-2 text-ink-soft sm:table-cell">{r.call_status || "—"}</td>
              <td className="tnum px-4 py-2 text-right text-ink-faint">{fmtDateTime(r.event_time)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  // leads
  if (!result.rows.length) return <Empty>Sem leads.</Empty>;
  return (
    <table className="w-full text-sm">
      <thead className="sticky top-0 z-10 bg-card">
        <tr className="text-left text-[0.62rem] uppercase tracking-wide text-ink-faint">
          <th className="border-b border-line px-4 py-2.5 font-semibold">Contato</th>
          <th className="border-b border-line px-3 py-2.5 font-semibold">Telefone</th>
          <th className="border-b border-line px-3 py-2.5 text-right font-semibold">Chamadas</th>
          <th className="border-b border-line px-3 py-2.5 text-right font-semibold">Conectadas</th>
          <th className="border-b border-line px-4 py-2.5 text-right font-semibold">Última</th>
        </tr>
      </thead>
      <tbody>
        {result.rows.map((r, i) => (
          <tr key={i} className="border-t border-line">
            <td className="px-4 py-2 font-medium text-ink">{r.name || "—"}</td>
            <td className="tnum px-3 py-2 text-ink-soft">{r.phone}</td>
            <td className="tnum px-3 py-2 text-right text-ink">{fmtInt(r.calls)}</td>
            <td className="tnum px-3 py-2 text-right text-ink-soft">{fmtInt(r.connected)}</td>
            <td className="tnum px-4 py-2 text-right text-ink-faint">{fmtDateTime(r.last)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="px-5 py-12 text-center text-sm text-ink-soft">{children}</div>;
}
