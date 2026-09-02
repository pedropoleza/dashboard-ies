// Parse timestamps coming from GHL custom data.
// GHL renders call/appointment times as naive Orlando (Eastern) wall-clock,
// e.g. "2026-05-21 16:22:18". Convert those to UTC (DST-aware). Other formats
// (ISO, human-readable) fall back to Date parsing.

function nthSunday(y: number, month: number, n: number): number {
  let count = 0;
  for (let d = 1; d <= 31; d++) {
    const dt = new Date(Date.UTC(y, month - 1, d));
    if (dt.getUTCMonth() !== month - 1) break;
    if (dt.getUTCDay() === 0 && ++count === n) return d;
  }
  return 1;
}

function isEdt(y: number, mo: number, d: number): boolean {
  const start = Date.UTC(y, 2, nthSunday(y, 3, 2)); // 2nd Sun Mar
  const end = Date.UTC(y, 10, nthSunday(y, 11, 1)); // 1st Sun Nov
  const t = Date.UTC(y, mo - 1, d);
  return t >= start && t < end;
}

export function parseGhlTime(s: unknown): string | null {
  if (!s) return null;
  const str = String(s).trim();
  const m = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (m) {
    const Y = +m[1], Mo = +m[2], D = +m[3], H = +m[4], Mi = +m[5], S = m[6] ? +m[6] : 0;
    const offset = isEdt(Y, Mo, D) ? 4 : 5;
    return new Date(Date.UTC(Y, Mo - 1, D, H + offset, Mi, S)).toISOString();
  }
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d.toISOString();
}
