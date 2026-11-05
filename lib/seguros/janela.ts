// ─── Perfil "seguros": o período, sempre no fuso da conta ───────────────────
//
// A conta da Eliane opera em Nova York e a Camila, que confere o painel, está no
// Brasil. Calculado no fuso do navegador, o mesmo "hoje" ou "01 a 31" mostrava
// números diferentes para cada uma, e nenhum batia com o GHL. Aqui o dia é o da conta.
//
// Toda janela é feita de dias inteiros e termina na meia-noite seguinte (o fim é
// exclusivo), então "30 dias" tem 30 dias de verdade e a janela anterior usada na
// comparação também. Sem dependências, para rodar no navegador e no node --test.

import type { DataIso, Periodo } from "./navegacao";

export type JanelaDeDias = { inicio: Date; fim: Date };

/** Quanto o fuso está à frente do UTC naquele instante, em milissegundos. */
function deslocamento(instante: number, fuso: string): number {
  const partes: Record<string, string> = {};
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: fuso, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
  for (const p of fmt.formatToParts(new Date(instante))) partes[p.type] = p.value;
  const comoUtc = Date.UTC(+partes.year, +partes.month - 1, +partes.day, +partes.hour, +partes.minute, +partes.second);
  return comoUtc - instante;
}

/** A meia-noite daquele dia, no fuso da conta. Duas passadas por causa da troca de horário. */
function meiaNoite(dia: DataIso, fuso: string): Date {
  const [a, m, d] = dia.split("-").map(Number);
  const base = Date.UTC(a, m - 1, d);
  let utc = base;
  for (let i = 0; i < 2; i++) utc = base - deslocamento(utc, fuso);
  return new Date(utc);
}

/** Soma dias a uma data de calendário, sem passar por fuso nenhum. */
function somarDias(dia: DataIso, n: number): DataIso {
  const [a, m, d] = dia.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d + n)).toISOString().slice(0, 10);
}

const diaValido = (s: DataIso) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));

/** O dia de hoje na conta, YYYY-MM-DD. */
export function hojeNoFuso(fuso: string, agora: Date = new Date()): DataIso {
  return new Intl.DateTimeFormat("en-CA", { timeZone: fuso, year: "numeric", month: "2-digit", day: "2-digit" }).format(agora);
}

/** Do começo do dia inicial ao fim do dia final, ou null se o par não forma um intervalo. */
export function janelaCustomValida(de: DataIso, ate: DataIso, fuso: string): JanelaDeDias | null {
  if (!diaValido(de) || !diaValido(ate) || de > ate) return null;
  return { inicio: meiaNoite(de, fuso), fim: meiaNoite(somarDias(ate, 1), fuso) };
}

export function janelaDoPeriodo(
  periodo: Periodo,
  de: DataIso,
  ate: DataIso,
  fuso: string,
  agora: Date = new Date(),
): JanelaDeDias {
  // Par inválido nunca derruba a tela: cai no padrão de 30 dias. Dentro do iframe do
  // GHL um erro de render vira quadrado branco sem explicação.
  if (periodo === "custom") {
    const j = janelaCustomValida(de, ate, fuso);
    if (j) return j;
  }
  const hoje = hojeNoFuso(fuso, agora);
  const fim = meiaNoite(somarDias(hoje, 1), fuso);
  const dias: Partial<Record<Periodo, number>> = { hoje: 1, "7d": 7, "90d": 90 };
  if (periodo === "ano") return { inicio: meiaNoite(`${hoje.slice(0, 4)}-01-01`, fuso), fim };
  if (periodo === "tudo") return { inicio: meiaNoite("2000-01-01", fuso), fim };
  return { inicio: meiaNoite(somarDias(hoje, 1 - (dias[periodo] ?? 30)), fuso), fim };
}
