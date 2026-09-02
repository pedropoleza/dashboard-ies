import { supabaseDashboard } from "./supabase";
import type { ClientConfig, PipelineScope } from "./clients";
import type { Range } from "./dates";

type SP = Record<string, string | string[] | undefined>;
const s = (sp: SP, k: string) => {
  const v = sp[k];
  return typeof v === "string" ? v : undefined;
};

export type OppRow = {
  id: string;
  name: string | null;
  contact_name: string | null;
  stage_id: string | null;
  assigned_to: string | null;
  source_category: string | null;
  monetary_value: number | null;
  status: string | null;
  created_at: string | null;
  last_stage_change_at: string | null;
};
export type CallRow = {
  contact_name: string | null;
  contact_phone: string | null;
  direction: string | null;
  duration: number | null;
  call_status: string | null;
  event_time: string | null;
  is_successful: boolean | null;
};
export type LeadRow = {
  phone: string;
  name: string | null;
  calls: number;
  connected: number;
  last: string | null;
};

export type DrillResult =
  | { kind: "opps"; title: string; rows: OppRow[]; total: number; stageNames: Record<string, string>; agentNames: Record<string, string> }
  | { kind: "calls"; title: string; rows: CallRow[]; total: number }
  | { kind: "leads"; title: string; rows: LeadRow[]; total: number };

export async function getDrill(
  client: ClientConfig,
  range: Range,
  scope: PipelineScope,
  sp: SP,
): Promise<DrillResult | null> {
  const drill = s(sp, "drill");
  if (!drill) return null;
  const value = s(sp, "value");
  const sdr = s(sp, "sdr");
  const mode = s(sp, "mode") ?? "all";
  const supabase = supabaseDashboard();
  const c = client.slug;
  const p_start = range.start.toISOString();
  const p_end = range.end.toISOString();
  const minSecs = client.call_min_seconds;

  // ---- Calls drills ----
  if (drill === "calls") {
    if (!sdr) return null;
    const { data } = await supabase
      .from("webhook_events")
      .select("contact_name,contact_phone,direction,duration,call_status,event_time,is_successful")
      .eq("client", c)
      .eq("event_type", "call")
      .eq("user_id", sdr)
      .gte("event_time", p_start)
      .lt("event_time", p_end)
      .order("event_time", { ascending: false })
      .limit(1000);
    const isConn = (r: any) =>
      minSecs > 0 ? (r.duration ?? 0) >= minSecs : r.is_successful === true;

    if (mode === "leads") {
      const map = new Map<string, LeadRow>();
      for (const r of data ?? []) {
        const k = r.contact_phone ?? "(sem telefone)";
        const cur = map.get(k) ?? { phone: k, name: r.contact_name ?? null, calls: 0, connected: 0, last: null };
        cur.calls += 1;
        if (isConn(r)) cur.connected += 1;
        if (r.contact_name && !cur.name) cur.name = r.contact_name;
        if (!cur.last || (r.event_time && r.event_time > cur.last)) cur.last = r.event_time;
        map.set(k, cur);
      }
      const rows = [...map.values()].sort((a, b) => b.calls - a.calls);
      return { kind: "leads", title: "Leads contactados", rows, total: rows.length };
    }
    let rows = (data ?? []) as CallRow[];
    if (mode === "connected") rows = rows.filter(isConn);
    return {
      kind: "calls",
      title: mode === "connected" ? "Ligações conectadas" : "Ligações",
      rows,
      total: rows.length,
    };
  }

  // ---- Opportunities drills ----
  // "Em atendimento" (open) uses the current open-pipeline snapshot (no date filter, like the KPI).
  const allOpen = drill === "kpi" && value === "open";
  let q = supabase
    .from("opportunities")
    .select(
      "id,name,contact_name,stage_id,assigned_to,source_category,monetary_value,status,created_at,last_stage_change_at,pipeline_id",
    )
    .eq("client", c)
    .order("last_stage_change_at", { ascending: false, nullsFirst: false })
    .limit(300);
  if (!allOpen) q = q.gte("created_at", p_start).lt("created_at", p_end);
  if (scope.pipeline_ids.length) q = q.in("pipeline_id", scope.pipeline_ids);

  let title = "";
  if (drill === "source") {
    if (!value) return null;
    q = q.eq("source_category", value);
    title = `Origem: ${value}`;
  } else if (drill === "channel") {
    if (!value) return null;
    if (value === "Direto / sem UTM") {
      q = q.or("ad_source.is.null,ad_source.eq.").or("utm_source.is.null,utm_source.eq.");
    } else {
      q = q.or(`ad_source.eq.${value},utm_source.eq.${value}`);
    }
    title = `Canal: ${value}`;
  } else if (drill === "campaign") {
    if (!value) return null;
    q = q.eq("utm_campaign", value);
    title = `Campanha: ${value}`;
  } else if (drill === "stage") {
    if (!value) return null;
    q = q.eq("stage_id", value);
    title = "Etapa";
  } else if (drill === "kpi") {
    if (value === "leads") title = "Leads no período";
    else if (value === "appts") {
      if (scope.appt_stage_ids.length) q = q.in("stage_id", scope.appt_stage_ids);
      title = "Agendamentos";
    } else if (value === "won") {
      if (scope.won_stage_ids.length) q = q.in("stage_id", scope.won_stage_ids);
      else q = q.eq("status", "won");
      title = scope.won_label;
    } else if (value === "open") {
      q = q.eq("status", "open");
      title = "Em atendimento";
    } else if (value === "lost") {
      q = q.eq("status", "lost");
      title = "Perdidos";
    } else return null;
  } else return null;

  const [{ data: rowsRaw }, stagesRes, agentsRes] = await Promise.all([
    q,
    supabase.from("stages").select("stage_id,name").eq("client", c),
    supabase.from("agents").select("user_id,name").eq("client", c),
  ]);
  const stageNames: Record<string, string> = {};
  for (const r of stagesRes.data ?? []) stageNames[r.stage_id] = r.name;
  const agentNames: Record<string, string> = {};
  for (const r of agentsRes.data ?? []) agentNames[r.user_id] = r.name;
  const rows = (rowsRaw ?? []) as OppRow[];

  if (drill === "stage" && value) title = `Etapa: ${stageNames[value] ?? "Etapa"}`;

  return { kind: "opps", title, rows, total: rows.length, stageNames, agentNames };
}
