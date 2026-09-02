// As três abas que a cliente pediu, com os mesmos nomes dos pipelines dela,
// para não criar vocabulário paralelo: Prospects, Recruiting e Agency.
//
// Server component: os números já chegam calculados. As abas são links, não
// estado de cliente, então funcionam com o botão voltar e podem ser mandadas
// por mensagem apontando direto para a aba.

import Link from "next/link";
import type { DadosSeguros } from "@/lib/seguros/dados";
import { configSeguros } from "@/lib/seguros/config";
import { fmtInt, fmtMoney } from "@/lib/format";
import { clientHref } from "@/lib/url";
import { Secao, Kpi, Grade, Barras, Vazio, Comparecimento } from "./Pecas";

type SP = Record<string, string | string[] | undefined>;
export type Aba = "prospects" | "recruiting" | "agency";

const ABAS: { id: Aba; rotulo: string }[] = [
  { id: "prospects", rotulo: "Prospects" },
  { id: "recruiting", rotulo: "Recruiting" },
  { id: "agency", rotulo: "Agency" },
];

export function abaDaUrl(v: unknown): Aba {
  return v === "recruiting" || v === "agency" ? v : "prospects";
}

export function Painel({
  slug,
  sp,
  aba,
  d,
}: {
  slug: string;
  sp: SP;
  aba: Aba;
  d: DadosSeguros;
}) {
  const cfg = configSeguros(slug);
  return (
    <div className="space-y-4">
      <nav aria-label="Áreas" className="flex flex-wrap gap-1.5">
        {ABAS.map((a) => {
          const ativa = a.id === aba;
          return (
            <Link
              key={a.id}
              href={clientHref(slug, sp, { aba: a.id })}
              scroll={false}
              prefetch={false}
              aria-current={ativa ? "page" : undefined}
              className={`inline-flex min-h-11 items-center rounded-lg px-4 text-[13.5px] font-medium transition-colors ${
                ativa
                  ? "text-white"
                  : "border border-line bg-card text-ink-soft hover:bg-paper-2/70 hover:text-ink"
              }`}
              style={ativa ? { background: "var(--color-ivy)" } : undefined}
            >
              {a.rotulo}
            </Link>
          );
        })}
      </nav>

      {aba === "prospects" && <AbaProspects d={d} />}
      {aba === "recruiting" && <AbaRecruiting d={d} />}
      {aba === "agency" && <AbaAgency d={d} cfgTem={!!cfg} />}
    </div>
  );
}

// ── Prospects ──────────────────────────────────────────────────────────────

function AbaProspects({ d }: { d: DadosSeguros }) {
  const p = d.prospects;
  const a = d.prospectsAnterior;
  return (
    <div className="space-y-4">
      <Grade>
        <Kpi rotulo="Novos leads" valor={p.novosLeads} delta={d.variacao(p.novosLeads, a.novosLeads)} sub="pela data de criação" />
        <Kpi rotulo="Reuniões marcadas" valor={p.reunioes.agendadas} delta={d.variacao(p.reunioes.agendadas, a.reunioes.agendadas)} sub="pela data da reunião" />
        <Kpi rotulo="Clientes" valor={p.clientesEmitidos} delta={d.variacao(p.clientesEmitidos, a.clientesEmitidos)} sub="pessoas distintas com apólice" />
        <Kpi rotulo="Valor emitido" valor={p.valorEmitido} moeda delta={d.variacao(p.valorEmitido, a.valorEmitido)} sub={`${fmtInt(p.policiesEmitidas)} apólice(s)`} />
      </Grade>

      <div className="grid gap-4 lg:grid-cols-[1.15fr_1fr]">
        <Secao titulo="Funil de prospecção" ajuda="Onde cada lead está agora, no pipeline inteiro. Não depende do período escolhido.">
          <Barras itens={p.funil.map((f) => ({ nome: f.nome, total: f.total }))} vazio="Nenhum lead no funil." />
        </Secao>
        <Secao titulo="Reuniões" ajuda="Contadas pela data da reunião, não pela data em que foram marcadas.">
          <Comparecimento dados={p.reunioes} rotuloEvento="Reuniões" />
        </Secao>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <Secao titulo="Origem dos leads" ajuda="Vem das tags do contato. A conta quase não usa o campo de origem do GHL, então o que não tem tag conhecida aparece como sem origem, em vez de ser adivinhado.">
          <Barras itens={p.origens.map((o) => ({ nome: o.origem, total: o.total }))} vazio="Nenhum lead novo neste período." />
        </Secao>
        <Secao titulo="Conversão" ajuda="Clientes distintos no período divididos pelos leads criados no mesmo período.">
          {p.conversao === null ? (
            <Vazio>Nenhum lead novo neste período, então não há o que converter.</Vazio>
          ) : (
            <div>
              <div className="font-display text-[2.1rem] leading-none text-ink">
                {(p.conversao * 100).toFixed(1)}%
              </div>
              <p className="mt-2 text-[13px] text-ink-soft">
                {fmtInt(p.clientesEmitidos)} de {fmtInt(p.novosLeads)} leads viraram cliente
              </p>
              <p className="mt-3 text-xs leading-relaxed text-ink-faint">
                Leia com cuidado: quem fechou neste mês pode ter entrado no mês passado. Isto compara
                dois volumes do mesmo período, não persegue o mesmo lead no tempo.
              </p>
            </div>
          )}
        </Secao>
      </div>
    </div>
  );
}

// ── Recruiting ─────────────────────────────────────────────────────────────

function AbaRecruiting({ d }: { d: DadosSeguros }) {
  const r = d.recruiting;
  const a = d.recruitingAnterior;
  return (
    <div className="space-y-4">
      <Grade>
        <Kpi rotulo="Novos candidatos" valor={r.novosCandidatos} delta={d.variacao(r.novosCandidatos, a.novosCandidatos)} sub="pela data de criação" />
        <Kpi rotulo="Entrevistas marcadas" valor={r.entrevistas.agendadas} delta={d.variacao(r.entrevistas.agendadas, a.entrevistas.agendadas)} sub="pela data da entrevista" />
        <Kpi rotulo="Entrevistas realizadas" valor={r.entrevistas.realizadas} delta={d.variacao(r.entrevistas.realizadas, a.entrevistas.realizadas)} sub="marcadas como compareceu" />
        <Kpi rotulo="Agentes registrados" valor={r.registrados} delta={d.variacao(r.registrados, a.registrados)} sub="entraram em Registrado no período" />
      </Grade>

      <div className="grid gap-4 lg:grid-cols-[1.15fr_1fr]">
        <Secao titulo="Funil de recrutamento" ajuda="Onde cada candidato está agora.">
          <Barras itens={r.funil.map((f) => ({ nome: f.nome, total: f.total }))} vazio="Nenhum candidato no funil." />
        </Secao>
        <Secao titulo="Entrevistas" ajuda="Contadas pela data da entrevista.">
          <Comparecimento dados={r.entrevistas} rotuloEvento="Entrevistas" />
        </Secao>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <Secao titulo="Origem dos candidatos" ajuda="Também pelas tags do contato.">
          <Barras itens={r.origens.map((o) => ({ nome: o.origem, total: o.total }))} vazio="Nenhum candidato novo neste período." />
        </Secao>
        <Secao titulo="Conversão para agente" ajuda="Registros no período divididos pelos candidatos criados no período.">
          {r.conversao === null ? (
            <Vazio>Nenhum candidato novo neste período.</Vazio>
          ) : (
            <div>
              <div className="font-display text-[2.1rem] leading-none text-ink">
                {(r.conversao * 100).toFixed(1)}%
              </div>
              <p className="mt-2 text-[13px] text-ink-soft">
                {fmtInt(r.registrados)} registro(s) para {fmtInt(r.novosCandidatos)} candidato(s)
              </p>
              <p className="mt-3 text-xs leading-relaxed text-ink-faint">
                Conta quem está hoje no estágio Registrado e entrou nele dentro do período. Quem
                passou por lá e já seguiu adiante não aparece: o GHL guarda só a última mudança de
                estágio, e preencher o resto seria invenção.
              </p>
            </div>
          )}
        </Secao>
      </div>
    </div>
  );
}

// ── Agency ─────────────────────────────────────────────────────────────────

function AbaAgency({ d }: { d: DadosSeguros; cfgTem: boolean }) {
  const g = d.agency;
  const comAgentes = g.porNivel.filter((n) => n.total > 0);
  return (
    <div className="space-y-4">
      <Grade>
        <Kpi rotulo="Total de agentes" valor={g.total} sub="no pipeline Agency" />
        <Kpi rotulo="Ativos" valor={g.ativos} sub="fora de Agente inativo" />
        <Kpi rotulo="Inativos" valor={g.inativos} destaque={false} sub="inativos ou abandonados" />
        <Kpi rotulo="Novos no período" valor={g.novosNoPeriodo} sub="entraram no pipeline" />
      </Grade>

      <Secao
        titulo="Escada de carreira"
        ajuda="Cada nível é um estágio do pipeline Agency. Agentes inativos ficam de fora desta contagem."
      >
        {comAgentes.length === 0 ? (
          <Vazio>Nenhum agente ativo posicionado na escada.</Vazio>
        ) : (
          <Barras itens={g.porNivel.map((n) => ({ nome: n.nome, total: n.total }))} />
        )}
      </Secao>

      <Secao titulo="Como este número é montado">
        <ul className="space-y-2 text-[13px] leading-relaxed text-ink-soft">
          <li>
            <b className="font-medium text-ink">Total de agentes</b> sai do pipeline Agency, que é
            onde os níveis de carreira vivem e o que a conta movimenta na mão.
          </li>
          <li>
            <b className="font-medium text-ink">Novos no período</b> usa a entrada da pessoa no
            pipeline. A data em que o agente foi de fato registrado só existe de forma confiável
            para quem está hoje no estágio Registrado do funil de recrutamento, e é assim que a aba
            Recruiting a conta.
          </li>
        </ul>
      </Secao>
    </div>
  );
}
