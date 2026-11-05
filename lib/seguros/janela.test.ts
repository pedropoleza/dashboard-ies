// O período tem que ser o mesmo para quem olha de Nova York e do Brasil.
//   node --test lib/seguros/janela.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { hojeNoFuso, janelaCustomValida, janelaDoPeriodo } from "./janela.ts";

const NY = "America/New_York";
// 04/11/2026, 22h em Nova York: no Brasil e em UTC já é dia 05
const AGORA = new Date("2026-11-05T03:00:00Z");
const DIA = 86_400_000;

test("hoje é o dia da conta, não o de quem olha", () => {
  assert.equal(hojeNoFuso(NY, AGORA), "2026-11-04");
  assert.equal(hojeNoFuso("America/Sao_Paulo", AGORA), "2026-11-05");
});

test("hoje vai da meia-noite à meia-noite em Nova York", () => {
  const j = janelaDoPeriodo("hoje", "", "", NY, AGORA);
  assert.equal(j.inicio.toISOString(), "2026-11-04T05:00:00.000Z");
  assert.equal(j.fim.toISOString(), "2026-11-05T05:00:00.000Z");
});

test("30 dias são 30 dias inteiros, com hoje incluído", () => {
  const j = janelaDoPeriodo("30d", "", "", NY, AGORA);
  assert.equal(j.fim.toISOString(), "2026-11-05T05:00:00.000Z");
  // 06/10 ainda é horário de verão: a meia-noite é às 04h UTC, e a janela tem 1h a mais
  assert.equal(j.inicio.toISOString(), "2026-10-06T04:00:00.000Z");
  assert.equal(j.fim.getTime() - j.inicio.getTime(), 30 * DIA + 3_600_000);
});

test("este ano começa em 1º de janeiro na conta", () => {
  assert.equal(janelaDoPeriodo("ano", "", "", NY, AGORA).inicio.toISOString(), "2026-01-01T05:00:00.000Z");
});

test("intervalo escolhido inclui o último dia inteiro", () => {
  const j = janelaCustomValida("2026-10-01", "2026-10-31", NY)!;
  assert.equal(j.inicio.toISOString(), "2026-10-01T04:00:00.000Z");
  assert.equal(j.fim.toISOString(), "2026-11-01T04:00:00.000Z");
});

test("par inválido não forma janela e o painel cai em 30 dias", () => {
  assert.equal(janelaCustomValida("2026-10-31", "2026-10-01", NY), null);
  assert.equal(janelaCustomValida("", "2026-10-01", NY), null);
  const j = janelaDoPeriodo("custom", "2026-10-31", "2026-10-01", NY, AGORA);
  assert.equal(j.inicio.toISOString(), janelaDoPeriodo("30d", "", "", NY, AGORA).inicio.toISOString());
});
