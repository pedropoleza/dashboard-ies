import type { ActiveOpp } from "@/lib/metrics";
import { Avatar } from "./Avatar";
import { stageColor, sourceColor } from "@/lib/stages";
import { fmtInt, fmtRelative } from "@/lib/format";

export function PeopleInService({
  active,
  stageNames,
  stagePos,
  agentNames,
  totalActive,
}: {
  active: ActiveOpp[];
  stageNames: Record<string, string>;
  stagePos: Record<string, number>;
  agentNames: Record<string, string>;
  totalActive: number;
}) {
  return (
    <section className="card reveal overflow-hidden">
      <div className="flex items-end justify-between gap-4 p-5 pb-3 sm:p-6 sm:pb-3">
        <div>
          <div className="eyebrow mb-1">Pessoas em atendimento</div>
          <h2 className="text-[1.05rem] font-semibold leading-none text-ink">Quem está no funil agora</h2>
        </div>
        <div className="text-right text-xs text-ink-soft">
          <span className="font-display tnum text-base text-ink">{fmtInt(totalActive)}</span> em aberto
        </div>
      </div>

      <div className="scroll-thin max-h-[26rem] overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-card">
            <tr className="text-left text-[0.62rem] uppercase tracking-wide text-ink-faint">
              <th className="border-b border-line px-5 py-2.5 font-semibold">Contato</th>
              <th className="border-b border-line px-3 py-2.5 font-semibold">Etapa</th>
              <th className="hidden border-b border-line px-3 py-2.5 font-semibold sm:table-cell">Atendente</th>
              <th className="hidden border-b border-line px-3 py-2.5 font-semibold md:table-cell">Origem</th>
              <th className="border-b border-line px-5 py-2.5 text-right font-semibold">Nesta etapa</th>
            </tr>
          </thead>
          <tbody>
            {active.map((o) => {
              const stage = o.stage_id ? stageNames[o.stage_id] : null;
              const pos = o.stage_id ? stagePos[o.stage_id] ?? 0 : 0;
              const owner = o.assigned_to ? agentNames[o.assigned_to] : null;
              return (
                <tr key={o.id} className="border-t border-line transition-colors hover:bg-paper-2/50">
                  <td className="px-5 py-2.5 font-medium text-ink">{o.contact_name || o.name || "—"}</td>
                  <td className="px-3 py-2.5">
                    {stage ? (
                      <span className="inline-flex items-center gap-2 text-ink-soft">
                        <span className="h-1.5 w-1.5 rounded-full" style={{ background: stageColor(pos) }} />
                        {stage}
                      </span>
                    ) : (
                      <span className="text-ink-faint">—</span>
                    )}
                  </td>
                  <td className="hidden px-3 py-2.5 sm:table-cell">
                    {owner ? (
                      <span className="flex items-center gap-2">
                        <Avatar name={owner} size={22} />
                        <span className="truncate text-ink-soft">{owner}</span>
                      </span>
                    ) : (
                      <span className="text-ink-faint">Sem dono</span>
                    )}
                  </td>
                  <td className="hidden px-3 py-2.5 md:table-cell">
                    {o.source_category ? (
                      <span className="inline-flex items-center gap-1.5 text-ink-soft">
                        <span className="h-1.5 w-1.5 rounded-full" style={{ background: sourceColor(o.source_category) }} />
                        {o.source_category}
                      </span>
                    ) : (
                      <span className="text-ink-faint">—</span>
                    )}
                  </td>
                  <td className="tnum px-5 py-2.5 text-right text-ink-soft">{fmtRelative(o.last_stage_change_at)}</td>
                </tr>
              );
            })}
            {active.length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-10 text-center text-sm text-ink-soft">
                  Ninguém em atendimento no momento.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
