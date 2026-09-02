import { supabaseDashboard } from "./supabase";
import { previousRange, type Range } from "./dates";
import type { ClientConfig, PipelineScope } from "./clients";

export type Kpis = {
  total_leads: number;
  open_count: number;
  won_count: number;
  lost_count: number;
  appts_set: number;
  deals_closed: number;
  won_value: number;
  total_active: number;
};

export type FunnelStage = { stage_id: string; name: string; stage_position: number; count: number };
export type SourceRow = { category: string; count: number; value: number };
export type ChannelRow = { channel: string; count: number };
export type CampaignRow = { campaign: string; count: number };
export type AgentConvRow = { user_id: string; name: string | null; leads: number; appts: number; won: number; value: number };
export type SdrCallRow = {
  user_id: string;
  name: string | null;
  total_calls: number;
  successful_calls: number;
  total_leads: number;
  successful_leads: number;
  appointments: number;
  last_call: string | null;
  avg_seconds: number | null;
};
export type ActiveOpp = {
  id: string;
  name: string | null;
  contact_name: string | null;
  stage_id: string | null;
  assigned_to: string | null;
  source_category: string | null;
  created_at: string | null;
  last_stage_change_at: string | null;
  monetary_value: number | null;
  status: string | null;
};

export type Deltas = { leads: number | null; appts: number | null; deals: number | null; lost: number | null };

export type DashboardData = {
  kpis: Kpis;
  deltas: Deltas;
  funnel: FunnelStage[];
  sources: SourceRow[];
  channels: ChannelRow[];
  campaigns: CampaignRow[];
  agentConv: AgentConvRow[];
  sdrCalls: SdrCallRow[];
  active: ActiveOpp[];
  stageNames: Record<string, string>;
  stagePos: Record<string, number>;
  agentNames: Record<string, string>;
  syncState: { last_sync_at: string | null; total_count: number | null } | null;
};

const EMPTY_KPIS: Kpis = {
  total_leads: 0, open_count: 0, won_count: 0, lost_count: 0,
  appts_set: 0, deals_closed: 0, won_value: 0, total_active: 0,
};

export async function getDashboardData(
  client: ClientConfig,
  range: Range,
  scope: PipelineScope,
): Promise<DashboardData> {
  const supabase = supabaseDashboard();
  const c = client.slug;
  const p_start = range.start.toISOString();
  const p_end = range.end.toISOString();
  const pipelines = scope.pipeline_ids;
  const args = { p_client: c, p_start, p_end, p_pipelines: pipelines };
  const sdrArgs = { p_client: c, p_start, p_end, p_min_seconds: client.call_min_seconds };
  const kpiArgs = {
    ...args,
    p_appt_min: client.appt_stage_min,
    p_won_min: client.won_stage_min,
    p_appt_ids: scope.appt_stage_ids,
    p_won_ids: scope.won_stage_ids,
  };

  let activeQ = supabase
    .from("opportunities")
    .select(
      "id,name,contact_name,stage_id,assigned_to,source_category,created_at,last_stage_change_at,monetary_value,status",
    )
    .eq("client", c)
    .eq("status", "open");
  if (pipelines.length) activeQ = activeQ.in("pipeline_id", pipelines);

  const [kpis, funnel, sources, channels, campaigns, agentConv, sdrCalls, active, stages, agents, sync] =
    await Promise.all([
      supabase.rpc("dash_kpis", kpiArgs),
      supabase.rpc("dash_funnel", args),
      supabase.rpc("dash_sources", args),
      supabase.rpc("dash_channels", args),
      supabase.rpc("dash_campaigns", { ...args, p_limit: 8 }),
      supabase.rpc("dash_agent_conversion", kpiArgs),
      supabase.rpc("dash_sdr_calls", sdrArgs),
      activeQ.order("last_stage_change_at", { ascending: false, nullsFirst: false }).limit(60),
      supabase.from("stages").select("stage_id,name,position").eq("client", c).order("position"),
      supabase.from("agents").select("user_id,name").eq("client", c),
      supabase.from("sync_state").select("last_sync_at,total_count").eq("client", c).eq("id", "opportunities").maybeSingle(),
    ]);

  const stageNames: Record<string, string> = {};
  const stagePos: Record<string, number> = {};
  for (const s of stages.data ?? []) {
    stageNames[s.stage_id] = s.name;
    stagePos[s.stage_id] = s.position;
  }
  const agentNames: Record<string, string> = {};
  for (const a of agents.data ?? []) agentNames[a.user_id] = a.name;

  const curKpis = (kpis.data as Kpis) ?? EMPTY_KPIS;

  let deltas: Deltas = { leads: null, appts: null, deals: null, lost: null };
  const prev = previousRange(range);
  if (prev) {
    const prevRes = await supabase.rpc("dash_kpis", {
      p_client: c,
      p_start: prev.start.toISOString(),
      p_end: prev.end.toISOString(),
      p_appt_min: client.appt_stage_min,
      p_won_min: client.won_stage_min,
      p_pipelines: pipelines,
      p_appt_ids: scope.appt_stage_ids,
      p_won_ids: scope.won_stage_ids,
    });
    const pk = (prevRes.data as Kpis) ?? EMPTY_KPIS;
    const d = (cur: number, p: number) => (p > 0 ? ((cur - p) / p) * 100 : null);
    deltas = {
      leads: d(curKpis.total_leads, pk.total_leads),
      appts: d(curKpis.appts_set, pk.appts_set),
      deals: d(curKpis.deals_closed, pk.deals_closed),
      lost: d(curKpis.lost_count, pk.lost_count),
    };
  }

  return {
    kpis: curKpis,
    deltas,
    funnel: (funnel.data ?? []) as FunnelStage[],
    sources: (sources.data ?? []) as SourceRow[],
    channels: (channels.data ?? []) as ChannelRow[],
    campaigns: (campaigns.data ?? []) as CampaignRow[],
    agentConv: (agentConv.data ?? []) as AgentConvRow[],
    sdrCalls: (sdrCalls.data ?? []) as SdrCallRow[],
    active: (active.data ?? []) as ActiveOpp[],
    stageNames,
    stagePos,
    agentNames,
    syncState: sync.data ?? null,
  };
}

export type FunnelSummaryRow = {
  id: string;
  label: string;
  won_label: string;
  leads: number;
  appts: number;
  won: number;
};

/** Per-funnel headline numbers for the "Geral" overview. */
export async function getFunnelsSummary(client: ClientConfig, range: Range): Promise<FunnelSummaryRow[]> {
  const supabase = supabaseDashboard();
  const p_start = range.start.toISOString();
  const p_end = range.end.toISOString();
  return Promise.all(
    client.pipelines.map(async (p) => {
      const res = await supabase.rpc("dash_kpis", {
        p_client: client.slug,
        p_start,
        p_end,
        p_appt_min: client.appt_stage_min,
        p_won_min: client.won_stage_min,
        p_pipelines: [p.id],
        p_appt_ids: p.appt_stage_ids ?? [],
        p_won_ids: p.won_stage_ids ?? [],
      });
      const k = (res.data as Kpis) ?? EMPTY_KPIS;
      return {
        id: p.id,
        label: p.label,
        won_label: p.won_label,
        leads: k.total_leads,
        appts: k.appts_set,
        won: k.deals_closed,
      };
    }),
  );
}
