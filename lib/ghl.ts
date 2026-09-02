import type { SupabaseClient } from "@supabase/supabase-js";

const BASE = "https://services.leadconnectorhq.com";
const VERSION = "2021-07-28";

/** Read the agency (Company) OAuth token from the shared GHL Token table. */
export async function getAgencyToken(supabase: SupabaseClient): Promise<string> {
  const { data, error } = await supabase
    .from("Token Refresher")
    .select("access_token")
    .limit(1)
    .single();
  if (error || !data?.access_token) {
    throw new Error("Could not read agency token: " + (error?.message ?? "no row"));
  }
  return data.access_token as string;
}

/** Exchange the agency token for a location-scoped token. */
export async function getLocationToken(
  agencyToken: string,
  companyId: string,
  locationId: string,
): Promise<string> {
  const res = await fetch(`${BASE}/oauth/locationToken`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${agencyToken}`,
      Version: VERSION,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: new URLSearchParams({ companyId, locationId }),
  });
  if (!res.ok) {
    throw new Error(`locationToken ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
  const json = await res.json();
  return json.access_token as string;
}

async function fetchJson(url: string, token: string): Promise<any> {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Version: VERSION, Accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`GHL ${res.status} @ ${url}: ${(await res.text()).slice(0, 300)}`);
  }
  return res.json();
}

export function ghlGet(token: string, path: string): Promise<any> {
  return fetchJson(BASE + path, token);
}

/** Paginate the opportunities search endpoint across an entire location. */
export async function fetchAllOpportunities(
  token: string,
  locationId: string,
  onPage?: (n: number, total: number | null) => void,
): Promise<{ opportunities: any[]; total: number | null }> {
  const out: any[] = [];
  let total: number | null = null;
  let url: string | null = `${BASE}/opportunities/search?location_id=${locationId}&limit=100`;
  let guard = 0;
  while (url && guard < 400) {
    guard++;
    const res = await fetchJson(url, token);
    const ops: any[] = res.opportunities ?? [];
    total = res.meta?.total ?? total;
    out.push(...ops);
    onPage?.(out.length, total);

    let next: string | null = res.meta?.nextPageUrl ?? null;
    if (!next && ops.length === 100) {
      const sort = ops[ops.length - 1]?.sort;
      if (Array.isArray(sort) && sort.length) {
        next =
          `${BASE}/opportunities/search?location_id=${locationId}&limit=100` +
          sort.map((v: unknown) => `&searchAfter=${encodeURIComponent(String(v))}`).join("");
      }
    }
    url = next;
  }
  return { opportunities: out, total };
}

// ─── Calendários e agendamentos ─────────────────────────────────────────────
// A API de eventos exige janela em epoch ms e devolve `appointmentStatus`
// (confirmed | showed | noshow | cancelled | invalid). É ela que dá reunião
// marcada, realizada e no-show COM histórico, ao contrário do webhook, que só
// enxerga o que chegou depois de ligado.

const VERSION_CALENDARIO = "2021-04-15";

async function fetchJsonVersao(url: string, token: string, versao: string): Promise<any> {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Version: versao, Accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`GHL ${res.status} @ ${url}: ${(await res.text()).slice(0, 300)}`);
  }
  return res.json();
}

export async function fetchCalendars(token: string, locationId: string): Promise<any[]> {
  const res = await fetchJsonVersao(`${BASE}/calendars/?locationId=${locationId}`, token, VERSION);
  return res.calendars ?? [];
}

/**
 * Eventos de um calendário numa janela, em fatias de 120 dias. A API responde
 * por janela, e pedir dois anos de uma vez já voltou truncado em outras contas,
 * então fatiar é o que garante que nada some no meio.
 */
export async function fetchCalendarEvents(
  token: string,
  locationId: string,
  calendarId: string,
  startMs: number,
  endMs: number,
): Promise<any[]> {
  const FATIA = 120 * 24 * 60 * 60 * 1000;
  const porId = new Map<string, any>();
  for (let ini = startMs; ini < endMs; ini += FATIA) {
    const fim = Math.min(ini + FATIA, endMs);
    const url =
      `${BASE}/calendars/events?locationId=${locationId}&calendarId=${calendarId}` +
      `&startTime=${ini}&endTime=${fim}`;
    const res = await fetchJsonVersao(url, token, VERSION_CALENDARIO);
    for (const e of res.events ?? []) porId.set(e.id, e);
  }
  return [...porId.values()];
}
