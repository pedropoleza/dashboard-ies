export type RangePreset = "today" | "7d" | "30d" | "90d" | "ytd" | "all";

export const RANGE_OPTIONS: { value: RangePreset; label: string }[] = [
  { value: "today", label: "Hoje" },
  { value: "7d", label: "7 dias" },
  { value: "30d", label: "30 dias" },
  { value: "90d", label: "90 dias" },
  { value: "ytd", label: "Este ano" },
  { value: "all", label: "Tudo" },
];

export type Range = { start: Date; end: Date; preset: RangePreset | "custom"; label: string };

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Milliseconds that `tz` is ahead of UTC at the given instant. */
function tzOffsetMs(utcMs: number, tz: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, hourCycle: "h23",
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
  const p: Record<string, string> = {};
  for (const part of dtf.formatToParts(new Date(utcMs))) p[part.type] = part.value;
  const asUTC = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return asUTC - utcMs;
}

/** A wall-clock time in `tz` → the corresponding UTC Date. */
function zonedToUtc(y: number, mo: number, d: number, h: number, mi: number, s: number, tz: string): Date {
  let utc = Date.UTC(y, mo - 1, d, h, mi, s);
  for (let i = 0; i < 2; i++) utc = Date.UTC(y, mo - 1, d, h, mi, s) - tzOffsetMs(utc, tz);
  return new Date(utc);
}

function todayParts(tz: string): { y: number; mo: number; d: number } {
  const p: Record<string, string> = {};
  for (const part of new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date()))
    p[part.type] = part.value;
  return { y: +p.year, mo: +p.month, d: +p.day };
}

function parseYmd(s: string): { y: number; mo: number; d: number } | null {
  const m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  return m ? { y: +m[1], mo: +m[2], d: +m[3] } : null;
}

export function resolveRange(
  sp: Record<string, string | string[] | undefined> | undefined,
  tz = "America/New_York",
): Range {
  const get = (k: string) => {
    const v = sp?.[k];
    return typeof v === "string" ? v : undefined;
  };

  // Custom date range (?from=YYYY-MM-DD&to=YYYY-MM-DD), interpreted in the client tz.
  const from = get("from");
  const to = get("to");
  const f = from ? parseYmd(from) : null;
  if (f) {
    const start = zonedToUtc(f.y, f.mo, f.d, 0, 0, 0, tz);
    const t = to ? parseYmd(to) : null;
    const end = t ? zonedToUtc(t.y, t.mo, t.d, 23, 59, 59, tz) : new Date();
    return { start, end, preset: "custom", label: t ? `${from} → ${to}` : `desde ${from}` };
  }

  const preset = (RANGE_OPTIONS.find((o) => o.value === get("range"))?.value ?? "30d") as RangePreset;
  const end = new Date();
  let start: Date;
  switch (preset) {
    case "today": {
      const t = todayParts(tz);
      start = zonedToUtc(t.y, t.mo, t.d, 0, 0, 0, tz);
      break;
    }
    case "7d": start = daysAgo(7); break;
    case "90d": start = daysAgo(90); break;
    case "ytd": start = new Date(end.getFullYear(), 0, 1); break;
    case "all": start = new Date("2000-01-01T00:00:00Z"); break;
    default: start = daysAgo(30);
  }
  return { start, end, preset, label: RANGE_OPTIONS.find((o) => o.value === preset)!.label };
}

/** The equal-length window immediately before `range`, for deltas. */
export function previousRange(range: Range): { start: Date; end: Date } | null {
  if (range.preset === "all" || range.preset === "ytd") return null;
  const span = range.end.getTime() - range.start.getTime();
  if (span <= 0) return null;
  return { start: new Date(range.start.getTime() - span), end: new Date(range.start.getTime()) };
}
