// ─── Perfil "seguros": a matemática, isolada e testável ─────────────────────
//
// Funções puras sobre linhas já carregadas. Nada de banco aqui, para que cada
// definição possa ser testada e conferida contra o GHL. Quando o Pedro pediu
// "todos os números corretos e batendo", isto é o que torna a frase verificável.
//
// Cada métrica declara SUA data de referência, porque elas são diferentes de
// propósito:
//   · lead novo        -> created_at da oportunidade
//   · reunião          -> start_time do agendamento (a data da reunião)
//   · apólice emitida  -> Policy Issue Date da oportunidade em Policies. A criação da
//                         oportunidade é o dia em que o sync do Five Rings importou
//                         (28 apólices em 11/09/2025, 22 em 18/05/2026), não a emissão.
//   · agente registrado -> Start Date da oportunidade em Agency, a data real. O estágio
//                         Registrado do Recruiting fica vazio: quem registra vai para
//                         Agency e sai de lá.

// `import type` some na compilação e no type-stripping do node, então o teste
// roda sem resolver este caminho. SEM_ORIGEM mora aqui porque é a matemática
// que decide o que é "sem origem", não a configuração.
import type { ConfigSeguros } from "./config";

export const SEM_ORIGEM = "Sem origem";

export type Oportunidade = {
  id: string;
  contact_id: string | null;
  pipeline_id: string | null;
  stage_id: string | null;
  status: string | null;
  monetary_value: number | null;
  contact_tags: string[] | null;
  created_at: string | null;
  last_stage_change_at: string | null;
  /** data de calendário (YYYY-MM-DD), do campo Policy Issue Date */
  policy_issue_date: string | null;
  policy_status: string | null;
  agent_status: string | null;
  /** data de calendário (YYYY-MM-DD), do campo Start Date */
  agent_start_date: string | null;
};

export type Agendamento = {
  id: string;
  calendar_id: string | null;
  status: string | null;
  start_time: string | null;
};

export type Estagio = { stage_id: string; pipeline_id: string; name: string; position: number };
export type Janela = { inicio: Date; fim: Date };

const dentro = (iso: string | null | undefined, j: Janela) => {
  if (!iso) return false;
  const t = Date.parse(iso);
  return Number.isFinite(t) && t >= j.inicio.getTime() && t < j.fim.getTime();
};

/** Para data de calendário, sem hora. Meio-dia UTC cai no mesmo dia em Nova York e no
 *  Brasil, então a apólice emitida no dia 10 fica no dia 10 para as duas. */
const dentroDoDia = (dia: string | null | undefined, j: Janela) =>
  dia ? dentro(`${dia.slice(0, 10)}T12:00:00Z`, j) : false;

export const doPipeline = (ops: Oportunidade[], pid: string) =>
  ops.filter((o) => o.pipeline_id === pid);

/** Uma linha por pessoa: quem tem duas apólices é um cliente só. */
function umaPorPessoa(ops: Oportunidade[]): Oportunidade[] {
  const vistos = new Set<string>();
  return ops.filter((o) => {
    const k = o.contact_id ?? o.id;
    if (vistos.has(k)) return false;
    vistos.add(k);
    return true;
  });
}

// ── Reuniões e entrevistas ─────────────────────────────────────────────────

export type Comparecimento = {
  /** sem as canceladas: reunião cancelada não é reunião marcada */
  agendadas: number;
  realizadas: number;
  noShows: number;
  canceladas: number;
  /** já passaram da hora e ninguém marcou: nem compareceu, nem faltou */
  semMarcacao: number;
  /** ainda vão acontecer */
  futuras: number;
  /** realizadas / (realizadas + faltas). null quando nada foi marcado ainda */
  taxa: number | null;
};

export function comparecimento(
  appts: Agendamento[],
  calendarios: string[],
  j: Janela,
  agora: Date,
): Comparecimento {
  const nossos = appts.filter(
    (a) => a.calendar_id && calendarios.includes(a.calendar_id) && dentro(a.start_time, j),
  );
  const conta = (s: string) => nossos.filter((a) => (a.status ?? "").toLowerCase() === s).length;
  const realizadas = conta("showed");
  const noShows = conta("noshow");
  const canceladas = conta("cancelled") + conta("invalid");
  const futuras = nossos.filter(
    (a) => a.start_time != null && Date.parse(a.start_time) >= agora.getTime(),
  ).length;
  // "confirmed" numa reunião que já passou significa "ninguém marcou", não
  // "compareceu". Contar como presença inflaria a taxa.
  const semMarcacao = nossos.filter(
    (a) =>
      !["showed", "noshow", "cancelled", "invalid"].includes((a.status ?? "").toLowerCase()) &&
      a.start_time != null &&
      Date.parse(a.start_time) < agora.getTime(),
  ).length;
  const base = realizadas + noShows;
  return {
    agendadas: nossos.length - canceladas,
    realizadas,
    noShows,
    canceladas,
    semMarcacao,
    futuras,
    taxa: base > 0 ? realizadas / base : null,
  };
}

// ── Funil por estágio ──────────────────────────────────────────────────────

export type FatiaDeFunil = { stage_id: string; nome: string; posicao: number; total: number };

export function porEstagio(ops: Oportunidade[], estagios: Estagio[], pid: string): FatiaDeFunil[] {
  const doPipe = estagios.filter((e) => e.pipeline_id === pid).sort((a, b) => a.position - b.position);
  const contagem = new Map<string, number>();
  for (const o of doPipeline(ops, pid)) {
    if (!o.stage_id) continue;
    contagem.set(o.stage_id, (contagem.get(o.stage_id) ?? 0) + 1);
  }
  return doPipe.map((e) => ({
    stage_id: e.stage_id,
    nome: e.name,
    posicao: e.position,
    total: contagem.get(e.stage_id) ?? 0,
  }));
}

// ── Origem por tag ─────────────────────────────────────────────────────────

export type FatiaDeOrigem = { origem: string; total: number };

export function porOrigem(ops: Oportunidade[], cfg: ConfigSeguros): FatiaDeOrigem[] {
  const contagem = new Map<string, number>();
  for (const o of ops) {
    const tags = (o.contact_tags ?? []).map((t) => t.toLowerCase().trim());
    // Uma pessoa pode ter mais de uma tag de origem. Contamos a PRIMEIRA que
    // bate no mapa, na ordem do mapa, para que o total das fatias seja igual ao
    // total de leads e a soma não passe de 100%.
    let origem = SEM_ORIGEM;
    for (const [tag, nome] of Object.entries(cfg.origemPorTag)) {
      if (tags.includes(tag)) {
        origem = nome;
        break;
      }
    }
    contagem.set(origem, (contagem.get(origem) ?? 0) + 1);
  }
  return [...contagem.entries()]
    .map(([origem, total]) => ({ origem, total }))
    .sort((a, b) => (a.origem === SEM_ORIGEM ? 1 : b.origem === SEM_ORIGEM ? -1 : b.total - a.total));
}

// ── Prospects ──────────────────────────────────────────────────────────────

export type PainelProspects = {
  novosLeads: number;
  reunioes: Comparecimento;
  clientesEmitidos: number;
  policiesEmitidas: number;
  valorEmitido: number;
  /** emitidas sem Policy Issue Date: não entram em período nenhum, então a tela avisa */
  apolicesSemData: number;
  conversao: number | null;
  funil: FatiaDeFunil[];
  origens: FatiaDeOrigem[];
  origensFechamentos: FatiaDeOrigem[];
};

export function painelProspects(
  ops: Oportunidade[],
  appts: Agendamento[],
  estagios: Estagio[],
  cfg: ConfigSeguros,
  j: Janela,
  agora: Date,
): PainelProspects {
  const leads = doPipeline(ops, cfg.pipelines.prospects);
  const novos = leads.filter((o) => dentro(o.created_at, j));
  // Declined, Not Taken e Incomplete nunca foram emitidas, mesmo com data preenchida.
  const emitidas = doPipeline(ops, cfg.pipelines.policies).filter(
    (o) => !cfg.apoliceNaoEmitida.includes((o.policy_status ?? "").toLowerCase().trim()),
  );
  const apolices = emitidas.filter((o) => dentroDoDia(o.policy_issue_date, j));
  // "clientes únicos": a mesma pessoa pode ter mais de uma apólice no período.
  const clientes = umaPorPessoa(apolices);
  return {
    novosLeads: novos.length,
    reunioes: comparecimento(appts, cfg.calendarios.prospect, j, agora),
    clientesEmitidos: clientes.length,
    policiesEmitidas: apolices.length,
    valorEmitido: apolices.reduce((t, o) => t + (Number(o.monetary_value) || 0), 0),
    apolicesSemData: emitidas.filter((o) => !o.policy_issue_date).length,
    conversao: novos.length > 0 ? clientes.length / novos.length : null,
    funil: porEstagio(ops, estagios, cfg.pipelines.prospects),
    origens: porOrigem(novos, cfg),
    origensFechamentos: porOrigem(clientes, cfg),
  };
}

// ── Recruiting ─────────────────────────────────────────────────────────────

export type PainelRecruiting = {
  novosCandidatos: number;
  entrevistas: Comparecimento;
  registrados: number;
  conversao: number | null;
  funil: FatiaDeFunil[];
  origens: FatiaDeOrigem[];
  origensRegistros: FatiaDeOrigem[];
};

export function painelRecruiting(
  ops: Oportunidade[],
  appts: Agendamento[],
  estagios: Estagio[],
  cfg: ConfigSeguros,
  j: Janela,
  agora: Date,
): PainelRecruiting {
  const cands = doPipeline(ops, cfg.pipelines.recruiting);
  const novos = cands.filter((o) => dentro(o.created_at, j));
  // Registrado de verdade = começou como agente na janela (Start Date, no pipeline
  // Agency). Quem ainda está no estágio Registrado do Recruiting, esperando ir para
  // Agency, conta pela entrada no estágio. A mesma pessoa nos dois conta uma vez.
  const registrados = umaPorPessoa([
    ...doPipeline(ops, cfg.pipelines.agency).filter((o) => dentroDoDia(o.agent_start_date, j)),
    ...cands.filter((o) => o.stage_id === cfg.estagios.registrado && dentro(o.last_stage_change_at, j)),
  ]);
  return {
    novosCandidatos: novos.length,
    entrevistas: comparecimento(appts, cfg.calendarios.recruiting, j, agora),
    registrados: registrados.length,
    conversao: novos.length > 0 ? registrados.length / novos.length : null,
    funil: porEstagio(ops, estagios, cfg.pipelines.recruiting),
    origens: porOrigem(novos, cfg),
    origensRegistros: porOrigem(registrados, cfg),
  };
}

// ── Agency ─────────────────────────────────────────────────────────────────

export type PainelAgency = {
  total: number;
  ativos: number;
  inativos: number;
  novosNoPeriodo: number;
  /** sem Start Date: não entram em período nenhum, então a tela avisa */
  semDataDeInicio: number;
  porNivel: { nome: string; curto: string; total: number }[];
};

export function painelAgency(ops: Oportunidade[], cfg: ConfigSeguros, j: Janela): PainelAgency {
  const agentes = doPipeline(ops, cfg.pipelines.agency);
  // Inativo = o Five Rings diz Inactive, está no estágio "Agente inativo" ou a
  // oportunidade foi abandonada. O campo vem primeiro: há agente Inactive em estágio
  // de carreira e com a oportunidade marcada como ganha.
  const ehInativo = (o: Oportunidade) =>
    (o.agent_status ?? "").toLowerCase().trim() === "inactive" ||
    o.stage_id === cfg.estagios.agenteInativo ||
    o.status === "abandoned";
  const inativos = agentes.filter(ehInativo);
  return {
    total: agentes.length,
    ativos: agentes.length - inativos.length,
    inativos: inativos.length,
    novosNoPeriodo: agentes.filter((o) => dentroDoDia(o.agent_start_date, j)).length,
    semDataDeInicio: agentes.filter((o) => !o.agent_start_date).length,
    porNivel: cfg.carreira.map((n) => ({
      nome: n.nome,
      curto: n.curto,
      total: agentes.filter((o) => o.stage_id === n.id && !ehInativo(o)).length,
    })),
  };
}

// ── Janela anterior, para a variação ───────────────────────────────────────

export function janelaAnterior(j: Janela): Janela {
  const dur = j.fim.getTime() - j.inicio.getTime();
  return { inicio: new Date(j.inicio.getTime() - dur), fim: new Date(j.inicio.getTime()) };
}

export function variacao(atual: number, anterior: number): number | null {
  if (anterior === 0) return atual === 0 ? 0 : null; // sem base de comparação
  return (atual - anterior) / anterior;
}
