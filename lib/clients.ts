import { supabaseDashboard } from "./supabase";

export type Features = {
  kpis: boolean;
  funnel: boolean;
  leadOrigin: boolean;
  sdr: boolean;
  peopleInService: boolean;
};

export type PipelineCfg = {
  id: string;
  label: string;
  won_label: string;
  appt_stage_ids: string[];
  won_stage_ids: string[];
};

export type ClientConfig = {
  slug: string;
  name: string;
  code: string | null;
  city: string | null;
  location_id: string;
  company_id: string;
  timezone: string;
  currency: string;
  locale: string;
  accent: string;
  pipeline_id: string | null;
  sdr_user_ids: string[];
  appt_stage_min: number;
  won_stage_min: number;
  appt_stage_ids: string[];
  won_stage_ids: string[];
  call_min_seconds: number;
  won_label: string;
  pipelines: PipelineCfg[];
  features: Features;
  active: boolean;
};

const DEFAULT_FEATURES: Features = {
  kpis: true,
  funnel: true,
  leadOrigin: true,
  sdr: true,
  peopleInService: true,
};

function normalize(row: any): ClientConfig {
  return {
    slug: row.slug,
    name: row.name,
    code: row.code ?? null,
    city: row.city ?? null,
    location_id: row.location_id,
    company_id: row.company_id,
    timezone: row.timezone ?? "America/New_York",
    currency: row.currency ?? "USD",
    locale: row.locale ?? "pt-BR",
    accent: row.accent ?? "#2f54eb",
    pipeline_id: row.pipeline_id ?? null,
    sdr_user_ids: row.sdr_user_ids ?? [],
    appt_stage_min: row.appt_stage_min ?? 4,
    won_stage_min: row.won_stage_min ?? 999,
    appt_stage_ids: row.appt_stage_ids ?? [],
    won_stage_ids: row.won_stage_ids ?? [],
    call_min_seconds: row.call_min_seconds ?? 0,
    won_label: row.won_label || "Fechados",
    pipelines: Array.isArray(row.pipelines) ? row.pipelines : [],
    features: { ...DEFAULT_FEATURES, ...(row.features ?? {}) },
    active: row.active ?? true,
  };
}

export type PipelineScope = {
  id: string | null; // single pipeline id, or null for "Geral"
  pipeline_ids: string[]; // pipelines to include (1 for a funnel, all for Geral, [] = no filter)
  label: string | null;
  won_label: string;
  appt_stage_ids: string[];
  won_stage_ids: string[];
  isGeral: boolean;
};

export const GERAL = "all";

/** Resolve the active funnel for a client. Multi-funnel clients default to a
 *  "Geral" view (all funnels aggregated); `selectedId` picks one funnel. */
export function resolvePipeline(client: ClientConfig, selectedId?: string): PipelineScope {
  const ps = client.pipelines;
  if (ps.length === 0) {
    const ids = client.pipeline_id ? [client.pipeline_id] : [];
    return {
      id: client.pipeline_id,
      pipeline_ids: ids,
      label: null,
      won_label: client.won_label,
      appt_stage_ids: client.appt_stage_ids,
      won_stage_ids: client.won_stage_ids,
      isGeral: false,
    };
  }
  const found = selectedId && selectedId !== GERAL ? ps.find((x) => x.id === selectedId) : null;
  if (found) {
    return {
      id: found.id,
      pipeline_ids: [found.id],
      label: found.label,
      won_label: found.won_label || client.won_label,
      appt_stage_ids: found.appt_stage_ids ?? [],
      won_stage_ids: found.won_stage_ids ?? [],
      isGeral: false,
    };
  }
  // Geral — aggregate across all funnels (union of their appt/won stages).
  return {
    id: null,
    pipeline_ids: ps.map((p) => p.id),
    label: "Geral",
    won_label: "Ganhos",
    appt_stage_ids: ps.flatMap((p) => p.appt_stage_ids ?? []),
    won_stage_ids: ps.flatMap((p) => p.won_stage_ids ?? []),
    isGeral: true,
  };
}

export async function getClient(slug: string): Promise<ClientConfig | null> {
  const { data, error } = await supabaseDashboard()
    .from("clients")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  if (error || !data) return null;
  return normalize(data);
}

const KEY_RE = /^[A-Za-z0-9_-]+$/;

/**
 * Resolve a client by either its slug ("ies") or its GHL location_id
 * ("p98J95UDEF0sFMi8puw2"). Lets the GHL Custom Menu Link be a single dynamic
 * URL using {{location.id}} that works for every account.
 */
export async function getClientByKey(key: string): Promise<ClientConfig | null> {
  if (!key || !KEY_RE.test(key)) return null;
  const { data, error } = await supabaseDashboard()
    .from("clients")
    .select("*")
    .or(`slug.eq.${key},location_id.eq.${key}`)
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return normalize(data);
}

export async function getActiveClients(): Promise<ClientConfig[]> {
  const { data, error } = await supabaseDashboard()
    .from("clients")
    .select("*")
    .eq("active", true)
    .order("slug");
  if (error || !data) return [];
  return data.map(normalize);
}
