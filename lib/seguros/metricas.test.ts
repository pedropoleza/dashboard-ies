// Testes das definições que decidem número. Rodam sem dependência:
//   node --test lib/seguros/metricas.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  comparecimento, porOrigem, porEstagio, painelProspects, painelRecruiting,
  painelAgency, janelaAnterior, variacao, SEM_ORIGEM,
  type Oportunidade, type Agendamento, type Estagio,
} from "./metricas.ts";
import { configSeguros } from "./config.ts";

const cfg = configSeguros("eliane")!;
const J = { inicio: new Date("2026-08-01T00:00:00Z"), fim: new Date("2026-09-01T00:00:00Z") };
const AGORA = new Date("2026-08-31T22:00:00Z");
const CAL = cfg.calendarios.prospect[0];

const ag = (p: Partial<Agendamento>): Agendamento => ({
  id: Math.random().toString(36).slice(2), calendar_id: CAL, contact_id: null,
  contact_name: null, title: null, status: "confirmed",
  start_time: "2026-08-10T14:00:00Z", ...p,
});
const op = (p: Partial<Oportunidade>): Oportunidade => ({
  id: Math.random().toString(36).slice(2), name: null, contact_id: null, contact_name: null,
  pipeline_id: cfg.pipelines.prospects, stage_id: null, status: "open", monetary_value: 0,
  contact_tags: null, created_at: "2026-08-10T12:00:00Z", last_stage_change_at: null, ...p,
});

test("reunião passada sem marcação não vira presença", () => {
  const c = comparecimento(
    [ag({ status: "showed" }), ag({ status: "noshow" }), ag({ status: "confirmed" })],
    [CAL], J, AGORA,
  );
  assert.equal(c.agendadas, 3);
  assert.equal(c.realizadas, 1);
  assert.equal(c.noShows, 1);
  assert.equal(c.semMarcacao, 1, "a confirmada que já passou é 'sem marcação'");
  assert.equal(c.taxa, 0.5, "a taxa ignora a sem marcação, não a conta como presença");
});

test("sem nada marcado a taxa é nula, não zero", () => {
  const c = comparecimento([ag({ status: "confirmed" })], [CAL], J, AGORA);
  assert.equal(c.taxa, null, "zero afirmaria 'ninguém compareceu', o que seria mentira");
});

test("reunião futura não entra na taxa e conta como futura", () => {
  const c = comparecimento(
    [ag({ status: "confirmed", start_time: "2026-08-31T23:30:00Z" })], [CAL], J, AGORA,
  );
  assert.equal(c.futuras, 1);
  assert.equal(c.semMarcacao, 0);
  assert.equal(c.taxa, null);
});

test("calendário de outro domínio não contamina", () => {
  const c = comparecimento([ag({ calendar_id: "outro", status: "showed" })], [CAL], J, AGORA);
  assert.equal(c.agendadas, 0);
});

test("origem: a primeira tag do mapa vence e o total fecha", () => {
  const ops = [
    op({ contact_tags: ["morno", "indicação", "evento"] }),
    op({ contact_tags: ["instagram"] }),
    op({ contact_tags: ["frio", "prospect-seguro"] }), // nenhuma é origem
    op({ contact_tags: null }),
  ];
  const r = porOrigem(ops, cfg);
  const total = r.reduce((t, x) => t + x.total, 0);
  assert.equal(total, ops.length, "a soma das fatias tem que ser o total de leads");
  assert.equal(r.find((x) => x.origem === "Indicação")?.total, 1);
  assert.equal(r.find((x) => x.origem === SEM_ORIGEM)?.total, 2);
  assert.equal(r[r.length - 1].origem, SEM_ORIGEM, "sem origem fica por último");
});

test("clientes únicos: duas apólices da mesma pessoa são um cliente", () => {
  const estagios: Estagio[] = [];
  const ops = [
    op({ pipeline_id: cfg.pipelines.policies, contact_id: "c1", monetary_value: 2400 }),
    op({ pipeline_id: cfg.pipelines.policies, contact_id: "c1", monetary_value: 1200 }),
    op({ pipeline_id: cfg.pipelines.policies, contact_id: "c2", monetary_value: 600 }),
  ];
  const p = painelProspects(ops, [], estagios, cfg, J, AGORA);
  assert.equal(p.policiesEmitidas, 3);
  assert.equal(p.clientesEmitidos, 2);
  assert.equal(p.valorEmitido, 4200);
});

test("apólice de fora da janela não entra", () => {
  const ops = [op({ pipeline_id: cfg.pipelines.policies, contact_id: "c1", created_at: "2026-07-15T12:00:00Z", monetary_value: 999 })];
  const p = painelProspects(ops, [], [], cfg, J, AGORA);
  assert.equal(p.policiesEmitidas, 0);
  assert.equal(p.valorEmitido, 0);
});

test("registro conta só quem está em Registrado e entrou na janela", () => {
  const ops = [
    op({ pipeline_id: cfg.pipelines.recruiting, stage_id: cfg.estagios.registrado, last_stage_change_at: "2026-08-12T10:00:00Z" }),
    op({ pipeline_id: cfg.pipelines.recruiting, stage_id: cfg.estagios.registrado, last_stage_change_at: "2026-06-01T10:00:00Z" }),
    op({ pipeline_id: cfg.pipelines.recruiting, stage_id: "outro", last_stage_change_at: "2026-08-12T10:00:00Z" }),
  ];
  const r = painelRecruiting(ops, [], [], cfg, J, AGORA);
  assert.equal(r.registrados, 1);
});

test("agência: inativo por estágio ou por abandono, e nível não conta inativo", () => {
  const nivel = cfg.carreira[2]; // Agent (45%)
  const ops = [
    op({ pipeline_id: cfg.pipelines.agency, stage_id: nivel.id }),
    op({ pipeline_id: cfg.pipelines.agency, stage_id: nivel.id, status: "abandoned" }),
    op({ pipeline_id: cfg.pipelines.agency, stage_id: cfg.estagios.agenteInativo }),
  ];
  const a = painelAgency(ops, cfg, J);
  assert.equal(a.total, 3);
  assert.equal(a.inativos, 2);
  assert.equal(a.ativos, 1);
  assert.equal(a.porNivel.find((n) => n.nome === nivel.nome)?.total, 1);
});

test("funil respeita a ordem dos estágios e mostra estágio vazio", () => {
  const estagios: Estagio[] = [
    { stage_id: "s2", pipeline_id: cfg.pipelines.prospects, name: "Segundo", position: 1 },
    { stage_id: "s1", pipeline_id: cfg.pipelines.prospects, name: "Primeiro", position: 0 },
  ];
  const f = porEstagio([op({ stage_id: "s1" })], estagios, cfg.pipelines.prospects);
  assert.deepEqual(f.map((x) => x.nome), ["Primeiro", "Segundo"]);
  assert.equal(f[1].total, 0, "estágio vazio aparece com zero, não some");
});

test("janela anterior tem a mesma duração e termina onde a atual começa", () => {
  const a = janelaAnterior(J);
  assert.equal(a.fim.getTime(), J.inicio.getTime());
  assert.equal(a.fim.getTime() - a.inicio.getTime(), J.fim.getTime() - J.inicio.getTime());
});

test("variação sem base: 0 para 0 é estável, 0 para algo é indefinido", () => {
  assert.equal(variacao(0, 0), 0);
  assert.equal(variacao(5, 0), null, "crescer a partir de zero não é percentual");
  assert.equal(variacao(15, 10), 0.5);
});
