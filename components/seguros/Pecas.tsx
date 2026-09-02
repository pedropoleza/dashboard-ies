// Peças do perfil "seguros". Herdam a linguagem visual que já existe (.card,
// .eyebrow, .font-display, .tnum) para o painel parecer parte do GHL, e não um
// site colado dentro dele.
//
// Duas regras carregadas aqui dentro, porque são fáceis de perder no detalhe:
//   · cor nunca carrega significado sozinha. "Compareceu" e "faltou" se
//     distinguem por rótulo e forma, não só por verde e vermelho.
//   · zero não vai em negrito. Zero em destaque grita uma notícia ruim que
//     muitas vezes é só "não teve nada neste período".

import { fmtInt, fmtMoney } from "@/lib/format";

export function Secao({
  titulo,
  ajuda,
  children,
  acao,
}: {
  titulo: string;
  ajuda?: string;
  children: React.ReactNode;
  acao?: React.ReactNode;
}) {
  return (
    <section className="card reveal p-5 sm:p-6">
      <header className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-semibold text-ink">{titulo}</h2>
          {ajuda && <p className="mt-1 text-xs leading-relaxed text-ink-faint">{ajuda}</p>}
        </div>
        {acao}
      </header>
      {children}
    </section>
  );
}

export function Kpi({
  rotulo,
  valor,
  sub,
  delta,
  destaque = true,
  moeda = false,
}: {
  rotulo: string;
  valor: number | null;
  sub?: string;
  delta?: number | null;
  destaque?: boolean;
  moeda?: boolean;
}) {
  const vazio = valor === null || valor === 0;
  const texto = valor === null ? "sem dado" : moeda ? fmtMoney(valor) : fmtInt(valor);
  return (
    <div className="-mb-px -mr-px border-b border-r border-line p-4 sm:p-5">
      <div className="eyebrow">{rotulo}</div>
      <div
        className={`font-display mt-2.5 text-[1.85rem] leading-none ${
          vazio || !destaque ? "font-normal text-ink-soft" : "text-ink"
        }`}
      >
        {texto}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-soft">
        {delta !== undefined && <Delta valor={delta ?? null} />}
        {sub && <span>{sub}</span>}
      </div>
    </div>
  );
}

function Delta({ valor }: { valor: number | null }) {
  if (valor === null) return <span className="text-ink-faint">sem base anterior</span>;
  const pct = valor * 100;
  const parado = Math.abs(pct) < 0.5;
  const cor = parado
    ? "var(--color-ink-faint)"
    : pct > 0
      ? "var(--color-sage)"
      : "var(--color-terra)";
  return (
    <span className="tnum inline-flex items-center gap-0.5 font-medium" style={{ color: cor }}>
      <span aria-hidden>{parado ? "→" : pct > 0 ? "↑" : "↓"}</span>
      {Math.abs(pct).toFixed(0)}%
      <span className="sr-only">
        {parado ? "estável" : pct > 0 ? "acima" : "abaixo"} do período anterior
      </span>
    </span>
  );
}

export function Grade({ children }: { children: React.ReactNode }) {
  return (
    <div className="card reveal grid grid-cols-2 overflow-hidden lg:grid-cols-4">{children}</div>
  );
}

/** Barras horizontais. Rótulo e número sempre visíveis: a barra é reforço. */
export function Barras({
  itens,
  vazio = "Nada neste período.",
  moeda = false,
}: {
  itens: { nome: string; total: number; detalhe?: string }[];
  vazio?: string;
  moeda?: boolean;
}) {
  const max = Math.max(1, ...itens.map((i) => i.total));
  const soma = itens.reduce((t, i) => t + i.total, 0);
  if (soma === 0) return <Vazio>{vazio}</Vazio>;
  return (
    <ul className="space-y-2.5">
      {itens.map((i) => (
        <li key={i.nome}>
          <div className="flex items-baseline justify-between gap-3 text-[13px]">
            <span className="truncate text-ink-soft">{i.nome}</span>
            <span className="tnum shrink-0 font-medium text-ink">
              {moeda ? fmtMoney(i.total) : fmtInt(i.total)}
              {i.detalhe && <span className="ml-1.5 font-normal text-ink-faint">{i.detalhe}</span>}
            </span>
          </div>
          <div className="funnel-track mt-1.5 h-1.5 overflow-hidden rounded-full">
            <div
              className="bar-grow h-full rounded-full"
              style={{
                width: `${Math.max(2, (i.total / max) * 100)}%`,
                background: i.total === 0 ? "var(--color-line)" : "var(--color-ivy)",
              }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function Vazio({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-lg bg-paper-2/60 px-4 py-6 text-center text-[13px] text-ink-faint">
      {children}
    </p>
  );
}

/**
 * Comparecimento. Mostra a taxa E o que ficou sem marcação, porque uma taxa
 * calculada sobre poucas marcações engana mais do que informa.
 */
export function Comparecimento({
  dados,
  rotuloEvento,
}: {
  dados: {
    agendadas: number;
    realizadas: number;
    noShows: number;
    canceladas: number;
    semMarcacao: number;
    futuras: number;
    taxa: number | null;
  };
  rotuloEvento: string;
}) {
  const linhas = [
    { nome: `${rotuloEvento} realizadas`, total: dados.realizadas, marca: "✓" },
    { nome: "Faltaram", total: dados.noShows, marca: "✕" },
    { nome: "Canceladas", total: dados.canceladas, marca: "—" },
    { nome: "Ainda vão acontecer", total: dados.futuras, marca: "→" },
    { nome: "Já passaram e ninguém marcou", total: dados.semMarcacao, marca: "?" },
  ];
  return (
    <div>
      <div className="flex items-end gap-3">
        <div>
          <div className="eyebrow">Comparecimento</div>
          <div
            className={`font-display mt-1 text-[2.1rem] leading-none ${
              dados.taxa === null ? "font-normal text-ink-soft" : "text-ink"
            }`}
          >
            {dados.taxa === null ? "sem marcação" : `${Math.round(dados.taxa * 100)}%`}
          </div>
        </div>
        <p className="pb-1 text-xs leading-snug text-ink-faint">
          {dados.taxa === null
            ? "ninguém marcou presença ou falta neste período"
            : `sobre ${dados.realizadas + dados.noShows} ${
                dados.realizadas + dados.noShows === 1 ? "marcada" : "marcadas"
              }`}
        </p>
      </div>
      <ul className="mt-4 space-y-1.5 text-[13px]">
        {linhas.map((l) => (
          <li key={l.nome} className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2 text-ink-soft">
              <span
                aria-hidden
                className="grid h-4 w-4 shrink-0 place-items-center rounded text-[10px] font-semibold"
                style={{ background: "var(--color-paper-2)", color: "var(--color-ink-faint)" }}
              >
                {l.marca}
              </span>
              {l.nome}
            </span>
            <span className={`tnum ${l.total === 0 ? "text-ink-faint" : "font-medium text-ink"}`}>
              {fmtInt(l.total)}
            </span>
          </li>
        ))}
      </ul>
      {dados.semMarcacao > 0 && (
        <p className="mt-3 text-xs leading-relaxed text-ink-faint">
          A taxa acima ignora as {fmtInt(dados.semMarcacao)} sem marcação. Marcar quem compareceu no
          calendário do GHL faz o número virar realidade.
        </p>
      )}
    </div>
  );
}
