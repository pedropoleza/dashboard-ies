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
//   · apólice emitida  -> created_at da oportunidade em Policies (decisão do
//                         Pedro; o campo do contato só cobre 28 de 75)
//   · registro/nível   -> last_stage_change_at (o GHL devolve em 100% das
//                         oportunidades, então serve inclusive pro histórico)

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

export const doPipeline = (ops: Oportunidade[], pid: string) =>
  ops.filter((o) => o.pipeline_id === pid);

// ── Reuniões e entrevistas ─────────────────────────────────────────────────

export type Comparecimento = {
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
    agendadas: nossos.length,
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
  conversao: number | null;
  funil: FatiaDeFunil[];
  origens: FatiaDeOrigem[];
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
  const apolices = doPipeline(ops, cfg.pipelines.policies).filter((o) => dentro(o.created_at, j));
  // "clientes únicos": a mesma pessoa pode ter mais de uma apólice no período.
  const clientes = new Set(apolices.map((o) => o.contact_id ?? o.id));
  return {
    novosLeads: novos.length,
    reunioes: comparecimento(appts, cfg.calendarios.prospect, j, agora),
    clientesEmitidos: clientes.size,
    policiesEmitidas: apolices.length,
    valorEmitido: apolices.reduce((t, o) => t + (Number(o.monetary_value) || 0), 0),
    conversao: novos.length > 0 ? clientes.size / novos.length : null,
    funil: porEstagio(ops, estagios, cfg.pipelines.prospects),
    origens: porOrigem(novos, cfg),
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
  // Registro = está HOJE no estágio "Registrado" e entrou nele dentro da
  // janela. Quem passou por lá e seguiu adiante não é contado: o GHL só guarda
  // a ÚLTIMA mudança de estágio, e inventar o resto seria pior que faltar.
  const registrados = cands.filter(
    (o) => o.stage_id === cfg.estagios.registrado && dentro(o.last_stage_change_at, j),
  );
  return {
    novosCandidatos: novos.length,
    entrevistas: comparecimento(appts, cfg.calendarios.recruiting, j, agora),
    registrados: registrados.length,
    conversao: novos.length > 0 ? registrados.length / novos.length : null,
    funil: porEstagio(ops, estagios, cfg.pipelines.recruiting),
    origens: porOrigem(novos, cfg),
  };
}

// ── Agency ─────────────────────────────────────────────────────────────────

export type PainelAgency = {
  total: number;
  ativos: number;
  inativos: number;
  novosNoPeriodo: number;
  porNivel: { nome: string; curto: string; total: number }[];
};

export function painelAgency(ops: Oportunidade[], cfg: ConfigSeguros, j: Janela): PainelAgency {
  const agentes = doPipeline(ops, cfg.pipelines.agency);
  // Inativo = está no estágio "Agente inativo" OU a oportunidade foi abandonada.
  const ehInativo = (o: Oportunidade) =>
    o.stage_id === cfg.estagios.agenteInativo || o.status === "abandoned";
  const inativos = agentes.filter(ehInativo);
  return {
    total: agentes.length,
    ativos: agentes.length - inativos.length,
    inativos: inativos.length,
    novosNoPeriodo: agentes.filter((o) => dentro(o.created_at, j)).length,
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
