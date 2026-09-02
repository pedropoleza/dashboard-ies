import { supabaseDashboard, supabaseToken } from "./supabase";
import { getAgencyToken, getLocationToken, ghlGet, fetchAllOpportunities } from "./ghl";
import { normalizeSource, type Attribution } from "./sources";
import type { ClientConfig } from "./clients";

function isoOrNull(v: unknown): string | null {
  if (!v) return null;
  const d = new Date(v as string);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

export async function runSync(client: ClientConfig) {
  const startedAt = Date.now();
  const c = client.slug;
  const supabase = supabaseDashboard();
  const agencyToken = await getAgencyToken(supabaseToken());
  const token = await getLocationToken(agencyToken, client.company_id, client.location_id);
  const now = new Date().toISOString();

  // --- Pipelines / stages ---
  const pipelinesRes = await ghlGet(token, `/opportunities/pipelines?locationId=${client.location_id}`);
  const pipelines: any[] = pipelinesRes.pipelines ?? [];
  const stageRows = pipelines.flatMap((p) =>
    (p.stages ?? []).map((s: any) => ({
      client: c,
      stage_id: s.id,
      pipeline_id: p.id,
      pipeline_name: p.name,
      name: s.name,
      position: s.position ?? 0,
      updated_at: now,
    })),
  );
  if (stageRows.length) await supabase.from("stages").upsert(stageRows, { onConflict: "client,stage_id" });

  // --- Users / agents ---
  let usersRes: any;
  try {
    usersRes = await ghlGet(token, `/users/?locationId=${client.location_id}`);
  } catch {
    usersRes = await ghlGet(agencyToken, `/users/?locationId=${client.location_id}`);
  }
  const users: any[] = usersRes.users ?? [];
  const agentRows = users.map((u) => ({
    client: c,
    user_id: u.id,
    name: u.name || `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim() || u.email,
    email: u.email ?? null,
    role: u.roles?.role ?? null,
    type: u.roles?.type ?? null,
    is_active: true,
    updated_at: now,
  }));
  const agentFirstNames = new Set(
    agentRows.map((a) => (a.name ?? "").toLowerCase().trim().split(/\s+/)[0]).filter(Boolean),
  );
  if (agentRows.length) await supabase.from("agents").upsert(agentRows, { onConflict: "client,user_id" });

  // --- Opportunities ---
  const { opportunities, total } = await fetchAllOpportunities(token, client.location_id);
  const oppRows = opportunities.map((o) => {
    const attrs: any[] = o.attributions ?? [];
    const lastAttr: Attribution = attrs.find((a) => a.isLast) ?? attrs[0] ?? {};
    const rel = (o.relations ?? [])[0] ?? {};
    const contact = o.contact ?? {};
    return {
      client: c,
      id: o.id,
      name: o.name ?? null,
      contact_id: o.contactId ?? null,
      contact_name: contact.name ?? rel.fullName ?? rel.contactName ?? null,
      contact_email: contact.email ?? rel.email ?? null,
      contact_phone: contact.phone ?? rel.phone ?? null,
      pipeline_id: o.pipelineId ?? null,
      stage_id: o.pipelineStageId ?? null,
      assigned_to: o.assignedTo ?? null,
      status: o.status ?? null,
      source_raw: o.source || null,
      source_category: normalizeSource(o.source, lastAttr, agentFirstNames),
      monetary_value: o.monetaryValue ?? 0,
      utm_source: lastAttr.utmSource ?? null,
      utm_medium: lastAttr.utmMedium ?? null,
      utm_campaign: lastAttr.utmCampaign ?? null,
      utm_session_source: lastAttr.utmSessionSource ?? null,
      ad_source: lastAttr.adSource ?? null,
      created_at: isoOrNull(o.createdAt),
      updated_at: isoOrNull(o.updatedAt),
      last_stage_change_at: isoOrNull(o.lastStageChangeAt),
      last_status_change_at: isoOrNull(o.lastStatusChangeAt),
      synced_at: now,
    };
  });

  for (let i = 0; i < oppRows.length; i += 500) {
    const { error } = await supabase
      .from("opportunities")
      .upsert(oppRows.slice(i, i + 500), { onConflict: "client,id" });
    if (error) throw new Error("opportunities upsert: " + error.message);
  }

  const result = {
    client: c,
    stages: stageRows.length,
    agents: agentRows.length,
    opportunities: oppRows.length,
    ghl_total: total,
    elapsed_ms: Date.now() - startedAt,
  };

  await supabase.from("sync_state").upsert(
    {
      client: c,
      id: "opportunities",
      last_sync_at: now,
      total_count: oppRows.length,
      status: "ok",
      detail: result,
      updated_at: now,
    },
    { onConflict: "client,id" },
  );

  return result;
}
