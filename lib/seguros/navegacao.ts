// Aba e período lidos da URL. Mora fora do componente de cliente porque quem
// lê a URL primeiro é o servidor, e função exportada de um módulo "use client"
// não pode ser chamada de lá.

export type Aba = "prospects" | "recruiting" | "agency";
export type Periodo = "hoje" | "7d" | "30d" | "90d" | "ano" | "tudo";

export const ABAS: { id: Aba; rotulo: string }[] = [
  { id: "prospects", rotulo: "Prospects" },
  { id: "recruiting", rotulo: "Recruiting" },
  { id: "agency", rotulo: "Agency" },
];

export const PERIODOS: { id: Periodo; rotulo: string }[] = [
  { id: "hoje", rotulo: "Hoje" },
  { id: "7d", rotulo: "7 dias" },
  { id: "30d", rotulo: "30 dias" },
  { id: "90d", rotulo: "90 dias" },
  { id: "ano", rotulo: "Este ano" },
  { id: "tudo", rotulo: "Tudo" },
];

export function abaDaUrl(v: unknown): Aba {
  return v === "recruiting" || v === "agency" ? v : "prospects";
}

export function periodoDaUrl(v: unknown): Periodo {
  return PERIODOS.some((p) => p.id === v) ? (v as Periodo) : "30d";
}
