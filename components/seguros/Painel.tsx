"use client";

// As três abas que a cliente pediu, com os mesmos nomes dos pipelines dela,
// para não criar vocabulário paralelo: Prospects, Recruiting e Agency.
//
// TUDO É CALCULADO NO NAVEGADOR. A conta inteira são 245 oportunidades e 48
// agendamentos, que chegam uma vez e cabem de sobra. Antes cada clique era uma
// navegação: ida ao servidor, consulta ao banco e re-renderização, o que dentro
// do iframe do GHL dava a sensação de travamento mesmo com o servidor
// respondendo em 230ms. Agora trocar de aba ou de período é só re-cálculo local,
// e não sai pacote nenhum.
//
// A URL continua acompanhando (history.replaceState), então mandar o link de
// uma aba específica segue funcionando, sem custar navegação.

import { useEffect, useMemo, useState } from "react";
import type { LinhasSeguros } from "@/lib/seguros/dados";
import { configSeguros } from "@/lib/seguros/config";
import {
  painelProspects, painelRecruiting, painelAgency, janelaAnterior, variacao,
} from "@/lib/seguros/metricas";
import { fmtInt, fmtMoney } from "@/lib/format";
import { Secao, Kpi, Grade, Barras, Vazio, Comparecimento } from "./Pecas";
import { ABAS, PERIODOS, type Aba, type Periodo, type DataIso } from "@/lib/seguros/navegacao";
import { hojeNoFuso, janelaCustomValida, janelaDoPeriodo } from "@/lib/seguros/janela";

const CAMPO_DATA =
  "min-h-11 rounded-lg border border-line bg-card px-3 text-[13.5px] text-ink " +
  "outline-none transition-colors focus:border-ink-faint";

/** Datas escolhidas a mao. Convive com os botoes: escolher as duas liga o
 *  periodo "custom", clicar num botao limpa as datas. */
function SeletorDeData({
  de, ate, fuso, aoTrocar, ativo, aoLimpar,
}: {
  de: DataIso;
  fuso: string;
  ate: DataIso;
  aoTrocar: (de: DataIso, ate: DataIso) => void;
  ativo: boolean;
  aoLimpar: () => void;
}) {
  const max = hojeNoFuso(fuso);
  const invalido = !!de && !!ate && !janelaCustomValida(de, ate, fuso);
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <label className="flex items-center gap-1.5">
        <span className="text-[12.5px] text-ink-faint">de</span>
        <input
          type="date"
          value={de}
          max={ate || max}
          onChange={(e) => aoTrocar(e.target.value, ate)}
          aria-label="Data inicial"
          aria-invalid={invalido || undefined}
          className={CAMPO_DATA}
          style={ativo ? { borderColor: "var(--color-ivy)" } : undefined}
        />
      </label>
      <label className="flex items-center gap-1.5">
        <span className="text-[12.5px] text-ink-faint">até</span>
        <input
          type="date"
          value={ate}
          min={de || undefined}
          max={max}
          onChange={(e) => aoTrocar(de, e.target.value)}
          aria-label="Data final"
          aria-invalid={invalido || undefined}
          className={CAMPO_DATA}
          style={ativo ? { borderColor: "var(--color-ivy)" } : undefined}
        />
      </label>
      {(de || ate) && (
        <button
          type="button"
          onClick={aoLimpar}
          className="inline-flex min-h-11 items-center rounded-lg px-3 text-[13px] text-ink-soft underline-offset-2 hover:text-ink hover:underline"
        >
          limpar
        </button>
      )}
      {invalido && (
        <span role="status" className="text-[12.5px] text-ink-faint">
          a data final precisa ser igual ou depois da inicial
        </span>
      )}
    </div>
  );
}

function Botoes<T extends string>({
  itens, ativo, aoTrocar, rotuloGrupo,
}: {
  itens: { id: T; rotulo: string }[];
  ativo: T;
  aoTrocar: (v: T) => void;
  rotuloGrupo: string;
}) {
  return (
    <nav aria-label={rotuloGrupo} className="flex flex-wrap gap-1.5">
      {itens.map((i) => {
        const on = i.id === ativo;
        return (
          <button
            key={i.id}
            type="button"
            onClick={() => aoTrocar(i.id)}
            aria-current={on ? "page" : undefined}
            className={`inline-flex min-h-11 items-center rounded-lg px-4 text-[13.5px] font-medium transition-colors ${
              on ? "text-white" : "border border-line bg-card text-ink-soft hover:bg-paper-2/70 hover:text-ink"
            }`}
            style={on ? { background: "var(--color-ivy)" } : undefined}
          >
            {i.rotulo}
          </button>
        );
      })}
    </nav>
  );
}

export function Painel({
  slug,
  fuso,
  linhas,
  abaInicial,
  periodoInicial,
  deInicial = "",
  ateInicial = "",
}: {
  slug: string;
  /** fuso da conta: o dia do painel é o dela, não o de quem está olhando */
  fuso: string;
  linhas: LinhasSeguros;
  abaInicial: Aba;
  periodoInicial: Periodo;
  deInicial?: DataIso;
  ateInicial?: DataIso;
}) {
  const [aba, setAba] = useState<Aba>(abaInicial);
  const [periodo, setPeriodo] = useState<Periodo>(periodoInicial);
  const [de, setDe] = useState<DataIso>(deInicial);
  const [ate, setAte] = useState<DataIso>(ateInicial);
  const cfg = configSeguros(slug);

  // Botao de periodo e datas a mao sao o MESMO controle, visto de dois jeitos.
  // Clicar num botao limpa as datas, senao a tela mostraria "30 dias" aceso com
  // um intervalo escolhido a mao valendo por baixo.
  function trocarPeriodo(p: Periodo) {
    setPeriodo(p);
    setDe("");
    setAte("");
  }

  // So vira "custom" quando as duas datas formam um intervalo valido. Enquanto
  // ela digita a primeira, o painel segue mostrando o periodo anterior.
  function trocarDatas(novoDe: DataIso, novoAte: DataIso) {
    setDe(novoDe);
    setAte(novoAte);
    if (janelaCustomValida(novoDe, novoAte, fuso)) setPeriodo("custom");
    else if (periodo === "custom") setPeriodo("30d");
  }

  function limparDatas() {
    setDe("");
    setAte("");
    if (periodo === "custom") setPeriodo("30d");
  }

  // A URL segue o estado sem navegar: link de aba continua funcionando.
  useEffect(() => {
    const u = new URL(window.location.href);
    u.searchParams.set("aba", aba);
    u.searchParams.set("periodo", periodo);
    if (periodo === "custom") {
      u.searchParams.set("de", de);
      u.searchParams.set("ate", ate);
    } else {
      u.searchParams.delete("de");
      u.searchParams.delete("ate");
    }
    window.history.replaceState(null, "", u.toString());
  }, [aba, periodo, de, ate]);

  const d = useMemo(() => {
    if (!cfg) return null;
    const j = janelaDoPeriodo(periodo, de, ate, fuso);
    const ant = janelaAnterior(j);
    const agora = new Date();
    const { ops, appts, estagios } = linhas;
    return {
      prospects: painelProspects(ops, appts, estagios, cfg, j, agora),
      prospectsAnterior: painelProspects(ops, appts, estagios, cfg, ant, agora),
      recruiting: painelRecruiting(ops, appts, estagios, cfg, j, agora),
      recruitingAnterior: painelRecruiting(ops, appts, estagios, cfg, ant, agora),
      agency: painelAgency(ops, cfg, j),
      variacao,
      // "Tudo" e "Este ano" não têm janela anterior comparável
      // Intervalo escolhido a mao TEM janela anterior comparavel: e um periodo
      // fechado, ao contrario de "tudo" e "este ano".
      comparavel: periodo !== "tudo" && periodo !== "ano",
    };
  }, [cfg, linhas, periodo, de, ate, fuso]);

  if (!d) return null;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Botoes itens={ABAS} ativo={aba} aoTrocar={setAba} rotuloGrupo="Áreas" />
        <div className="flex flex-col gap-2 sm:items-end">
          <Botoes itens={PERIODOS} ativo={periodo} aoTrocar={trocarPeriodo} rotuloGrupo="Período" />
          <SeletorDeData
            de={de}
            ate={ate}
            aoTrocar={trocarDatas}
            ativo={periodo === "custom"}
            aoLimpar={limparDatas}
            fuso={fuso}
          />
          <p className="text-[12px] text-ink-faint">Dias no horário de {fuso === "America/New_York" ? "Nova York" : fuso}</p>
        </div>
      </div>

      {aba === "prospects" && <AbaProspects d={d} />}
      {aba === "recruiting" && <AbaRecruiting d={d} />}
      {aba === "agency" && <AbaAgency d={d} />}
    </div>
  );
}

type Dados = NonNullable<ReturnType<typeof usarDados>>;
function usarDados() {
  return null as unknown as {
    prospects: ReturnType<typeof painelProspects>;
    prospectsAnterior: ReturnType<typeof painelProspects>;
    recruiting: ReturnType<typeof painelRecruiting>;
    recruitingAnterior: ReturnType<typeof painelRecruiting>;
    agency: ReturnType<typeof painelAgency>;
    variacao: typeof variacao;
    comparavel: boolean;
  } | null;
}

// ── Prospects ──────────────────────────────────────────────────────────────

function AbaProspects({ d }: { d: Dados }) {
  const p = d.prospects;
  const a = d.prospectsAnterior;
  return (
    <div className="space-y-4">
      <Grade>
        <Kpi rotulo="Novos leads" valor={p.novosLeads} delta={d.comparavel ? d.variacao(p.novosLeads, a.novosLeads) : undefined} sub="pela data de criação" />
        <Kpi rotulo="Reuniões marcadas" valor={p.reunioes.agendadas} delta={d.comparavel ? d.variacao(p.reunioes.agendadas, a.reunioes.agendadas) : undefined} sub="pela data da reunião, sem as canceladas" />
        <Kpi rotulo="Clientes" valor={p.clientesEmitidos} delta={d.comparavel ? d.variacao(p.clientesEmitidos, a.clientesEmitidos) : undefined} sub="pessoas distintas, por data de emissão" />
        <Kpi rotulo="Valor emitido" valor={p.valorEmitido} moeda delta={d.comparavel ? d.variacao(p.valorEmitido, a.valorEmitido) : undefined} sub={`${fmtInt(p.policiesEmitidas)} apólice(s), por data de emissão`} />
      </Grade>

      <div className="grid gap-4 lg:grid-cols-[1.15fr_1fr]">
        <Secao titulo="Funil de prospecção" ajuda="Onde cada lead está agora, no pipeline inteiro. Não depende do período escolhido.">
          <Barras itens={p.funil.map((f) => ({ nome: f.nome, total: f.total }))} vazio="Nenhum lead no funil." />
        </Secao>
        <Secao titulo="Reuniões" ajuda="Contadas pela data da reunião, não pela data em que foram marcadas.">
          <Comparecimento dados={p.reunioes} rotuloEvento="Reuniões" />
        </Secao>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Secao titulo="Origem dos leads" ajuda="Vem das tags do contato. A conta quase não usa o campo de origem do GHL, então o que não tem tag conhecida aparece como sem origem, em vez de ser adivinhado.">
          <Barras itens={p.origens.map((o) => ({ nome: o.origem, total: o.total }))} vazio="Nenhum lead novo neste período." />
        </Secao>
        <Secao titulo="Origem dos fechamentos" ajuda="Clientes do período, pela mesma regra de tags.">
          <Barras itens={p.origensFechamentos.map((o) => ({ nome: o.origem, total: o.total }))} vazio="Nenhuma apólice emitida neste período." />
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

      <p className="text-xs leading-relaxed text-ink-faint">
        Apólices contadas pela Policy Issue Date, a data de emissão que vem do Five Rings. Declined,
        Not Taken e Incomplete não entram, porque não foram emitidas. Lapsed entra na data em que foi
        emitida.
        {p.apolicesSemData > 0 && ` ${fmtInt(p.apolicesSemData)} apólice(s) sem data de emissão ficam de fora de todos os períodos.`}
      </p>
    </div>
  );
}

// ── Recruiting ─────────────────────────────────────────────────────────────

function AbaRecruiting({ d }: { d: Dados }) {
  const r = d.recruiting;
  const a = d.recruitingAnterior;
  return (
    <div className="space-y-4">
      <Grade>
        <Kpi rotulo="Novos candidatos" valor={r.novosCandidatos} delta={d.comparavel ? d.variacao(r.novosCandidatos, a.novosCandidatos) : undefined} sub="pela data de criação" />
        <Kpi rotulo="Entrevistas marcadas" valor={r.entrevistas.agendadas} delta={d.comparavel ? d.variacao(r.entrevistas.agendadas, a.entrevistas.agendadas) : undefined} sub="pela data da entrevista" />
        <Kpi rotulo="Entrevistas realizadas" valor={r.entrevistas.realizadas} delta={d.comparavel ? d.variacao(r.entrevistas.realizadas, a.entrevistas.realizadas) : undefined} sub="marcadas como compareceu" />
        <Kpi rotulo="Agentes registrados" valor={r.registrados} delta={d.comparavel ? d.variacao(r.registrados, a.registrados) : undefined} sub="pela data real de início (Start Date)" />
      </Grade>

      <div className="grid gap-4 lg:grid-cols-[1.15fr_1fr]">
        <Secao titulo="Funil de recrutamento" ajuda="Onde cada candidato está agora.">
          <Barras itens={r.funil.map((f) => ({ nome: f.nome, total: f.total }))} vazio="Nenhum candidato no funil." />
        </Secao>
        <Secao titulo="Entrevistas" ajuda="Contadas pela data da entrevista.">
          <Comparecimento dados={r.entrevistas} rotuloEvento="Entrevistas" />
        </Secao>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Secao titulo="Origem dos candidatos" ajuda="Também pelas tags do contato.">
          <Barras itens={r.origens.map((o) => ({ nome: o.origem, total: o.total }))} vazio="Nenhum candidato novo neste período." />
        </Secao>
        <Secao titulo="Origem dos registros" ajuda="Agentes registrados no período, pela mesma regra de tags.">
          <Barras itens={r.origensRegistros.map((o) => ({ nome: o.origem, total: o.total }))} vazio="Nenhum agente registrado neste período." />
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
                Registro é a data real de início do agente (Start Date, no pipeline Agency). Quem
                ainda está no estágio Registrado, esperando ir para Agency, conta pela entrada no
                estágio. Quem registrou neste mês pode ter sido candidato antes.
              </p>
            </div>
          )}
        </Secao>
      </div>
    </div>
  );
}

// ── Agency ─────────────────────────────────────────────────────────────────

function AbaAgency({ d }: { d: Dados }) {
  const g = d.agency;
  const comAgentes = g.porNivel.filter((n) => n.total > 0);
  return (
    <div className="space-y-4">
      <Grade>
        <Kpi rotulo="Total de agentes" valor={g.total} sub="no pipeline Agency" />
        <Kpi rotulo="Ativos" valor={g.ativos} sub="sem marcação de inativo" />
        <Kpi rotulo="Inativos" valor={g.inativos} destaque={false} sub="Agent Status inativo ou oportunidade abandonada" />
        <Kpi rotulo="Novos no período" valor={g.novosNoPeriodo} sub="pela data real de início (Start Date)" />
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
            <b className="font-medium text-ink">Novos no período</b> usa a data real de início do
            agente (Start Date), que vem do Five Rings. É a mesma conta de Agentes registrados, na
            aba Recruiting.
            {g.semDataDeInicio > 0 && ` ${fmtInt(g.semDataDeInicio)} agente(s) sem essa data ficam de fora dos períodos, mas entram no total.`}
          </li>
          <li>
            <b className="font-medium text-ink">Inativos</b> são os que o Five Rings marca como
            Inactive, os do estágio Agente inativo e os de oportunidade abandonada.
          </li>
        </ul>
      </Secao>
    </div>
  );
}
