type SP = Record<string, string | string[] | undefined> | undefined;

/**
 * Build a client dashboard href, preserving current query params and applying
 * overrides (set a key to undefined to remove it). Keeps funnel + range + dates
 * in sync when switching one of them.
 */
export function clientHref(slug: string, sp: SP, overrides: Record<string, string | undefined>): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(sp ?? {})) {
    if (typeof v === "string") params.set(k, v);
  }
  for (const [k, v] of Object.entries(overrides)) {
    if (v === undefined) params.delete(k);
    else params.set(k, v);
  }
  const qs = params.toString();
  return qs ? `/${slug}?${qs}` : `/${slug}`;
}
