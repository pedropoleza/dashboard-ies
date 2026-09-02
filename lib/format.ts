export const TZ = "America/New_York";
const LOCALE = "pt-BR";

const intFmt = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 0 });
const moneyFmt = new Intl.NumberFormat(LOCALE, {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

export function fmtInt(n: number | null | undefined): string {
  return intFmt.format(Math.round(Number(n ?? 0)));
}

export function fmtMoney(n: number | null | undefined): string {
  return moneyFmt.format(Number(n ?? 0));
}

export function fmtPct(n: number | null | undefined, digits = 1): string {
  const v = Number(n ?? 0);
  return `${v.toFixed(digits)}%`;
}

export function pct(part: number, whole: number): number {
  if (!whole) return 0;
  return (part / whole) * 100;
}

const dtFmt = new Intl.DateTimeFormat(LOCALE, {
  timeZone: TZ,
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});
const dateFmt = new Intl.DateTimeFormat(LOCALE, {
  timeZone: TZ,
  day: "2-digit",
  month: "short",
  year: "numeric",
});

export function fmtDateTime(d: string | Date | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  if (isNaN(date.getTime())) return "—";
  return dtFmt.format(date);
}

export function fmtDate(d: string | Date | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  if (isNaN(date.getTime())) return "—";
  return dateFmt.format(date);
}

/** "há 3 h", "há 2 d" — compact relative time in pt-BR. */
export function fmtRelative(d: string | Date | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  if (isNaN(date.getTime())) return "—";
  const diff = Date.now() - date.getTime();
  const min = Math.round(diff / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${h} h`;
  const days = Math.round(h / 24);
  if (days < 30) return `há ${days} d`;
  return fmtDate(date);
}

/** Seconds → "2m 05s" / "45s". */
export function fmtDuration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined) return "—";
  const s = Math.round(Number(seconds));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}m ${String(rem).padStart(2, "0")}s`;
}

export function initials(name: string | null | undefined): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
