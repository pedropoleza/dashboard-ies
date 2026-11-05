import { supabaseDashboard, supabaseToken } from "./supabase";
import { getAgencyToken, getLocationToken, ghlGet, fetchAllOpportunities, fetchCalendars, fetchCalendarEvents } from "./ghl";
import { normalizeSource, type Attribution } from "./sources";
import type { ClientConfig } from "./clients";
import { configSeguros, type ConfigSeguros } from "./seguros/config";

function isoOrNull(v: unknown): string | null {
  if (!v) return null;
  const d = new Date(v as string);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

/** Valor de um campo personalizado da oportunidade, venha como texto, data ou número. */
function campoDa(o: any, id: string): string | number | null {
  const f = (o.customFields ?? []).find((c: any) => c.id === id);
  return f ? (f.fieldValueString ?? f.fieldValueDate ?? f.fieldValueNumber ?? null) : null;
}

/** Os campos de data do GHL chegam em milissegundos, na meia-noite UTC do dia: o dia é
 *  o da data em UTC, e converter para o fuso da conta jogaria tudo para a véspera. */
function diaOuNull(v: string | number | null): string | null {
  if (v === null || v === "") return null;
  const ms = typeof v === "number" || /^\d{10,}$/.test(v) ? Number(v) : Date.parse(v);
  return Number.isFinite(ms) ? new Date(ms).toISOString().slice(0, 10) : null;
}

function camposDeSeguros(o: any, cfg: ConfigSeguros) {
  const texto = (id: string) => {
    const v = campoDa(o, id);
    return v === null ? null : String(v);
  };
  return {
    policy_issue_date: diaOuNull(campoDa(o, cfg.campos.emissaoApolice)),
    policy_status: texto(cfg.campos.statusApolice),
    agent_status: texto(cfg.campos.statusAgente),
    agent_start_date: diaOuNull(campoDa(o, cfg.campos.inicioAgente)),
  };
}

/**
 * Apaga o que o GHL não devolveu nesta rodada, senão oportunidade removida lá segue
 * contando no painel para sempre (em 04/11 eram 9 na Eliane, com 7 em vez de 3 no estágio
 * Primeira reunião marcada, e 278 no Jonathan). Um teto protege contra resposta incompleta
 * da API: rodada que apagaria mais de um quarto da base não apaga nada e avisa no log.
 */
async function removerFantasmas(
  supabase: ReturnType<typeof supabaseDashboard>,
  tabela: "opportunities" | "appointments",
  client: string,
  rodada: string,
  vivos: number,
): Promise<number> {
  const { count, error } = await supabase
    .from(tabela)
    .select("id", { count: "exact", head: true })
    .eq("client", client)
    .lt("synced_at", rodada);
  if (error) throw new Error(`${tabela} fantasmas: ${error.message}`);
  const n = count ?? 0;
  if (n === 0) return 0;
  if (n > Math.max(25, vivos / 4)) {
    console.warn(`[sync] ${client}: ${n} ${tabela} sumiram do GHL de uma vez (vivas: ${vivos}), nao apaguei`);
    return 0;
  }
  const { error: erroDel } = await supabase.from(tabela).delete().eq("client", client).lt("synced_at", rodada);
  if (erroDel) throw new Error(`${tabela} remocao: ${erroDel.message}`);
  return n;
}

/** A falha só existia na resposta do cron, que ninguém lê: a Ideal English School ficou
 *  um mês sem sincronizar sem deixar rastro. `last_sync_at` fica como está, porque é a
 *  última vez que deu certo e é o que a tela mostra. */
async function registrarFalha(client: string, erro: unknown) {
  const mensagem = erro instanceof Error ? erro.message : String(erro);
  const agora = new Date().toISOString();
  console.error(`[sync] ${client} falhou: ${mensagem}`);
  try {
    await supabaseDashboard()
      .from("sync_state")
      .upsert(
        { client, id: "opportunities", status: "error", detail: { error: mensagem.slice(0, 500), at: agora }, updated_at: agora },
        { onConflict: "client,id" },
      );
  } catch (e) {
    console.error(`[sync] ${client}: nao consegui registrar a falha`, e);
  }
}

export async function runSync(client: ClientConfig) {
  try {
    return await sincronizar(client);
  } catch (e) {
    await registrarFalha(client.slug, e);
    throw e;
  }
}

async function sincronizar(client: ClientConfig) {
  const startedAt = Date.now();
  const c = client.slug;
  const supabase = supabaseDashboard();
  const agencyToken = await getAgencyToken(supabaseToken());
  const token = await getLocationToken(agencyToken, client.company_id, client.location_id);
  const now = new Date().toISOString();
  const seguros = configSeguros(c);

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
      // As tags do contato vêm embutidas na busca de oportunidades, então dão
      // origem de lead sem custar uma sincronização de 1.200 contatos. É a
      // única fonte de origem que existe nesta conta: `source` está preenchido
      // em 4 de 125 leads.
      contact_tags: Array.isArray(contact.tags) ? contact.tags : null,
      ...(seguros ? camposDeSeguros(o, seguros) : {}),
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

  // Só com a lista completa na mão: resposta parcial da API não pode apagar nada.
  const removidasOps =
    total === opportunities.length
      ? await removerFantasmas(supabase, "opportunities", c, now, oppRows.length)
      : 0;

  // --- Agendamentos (só para quem liga a feature) ---
  let appointments = 0;
  let removidosAppts = 0;
  if (client.features.appointments) {
    const INICIO = Date.UTC(2024, 0, 1);
    const FIM = Date.now() + 180 * 24 * 60 * 60 * 1000;
    const calendars = await fetchCalendars(token, client.location_id);
    const apptRows: any[] = [];
    for (const cal of calendars) {
      const eventos = await fetchCalendarEvents(token, client.location_id, cal.id, INICIO, FIM);
      for (const e of eventos) {
        if (e.deleted) continue;
        apptRows.push({
          client: c,
          id: e.id,
          calendar_id: e.calendarId ?? cal.id,
          calendar_name: cal.name ?? null,
          contact_id: e.contactId ?? null,
          contact_name: null, // o evento não traz nome; a tela junta pelo contato
          title: e.title ?? null,
          // `appointmentStatus` é o campo certo. O payload traz também
          // `appoinmentStatus`, com erro de digitação, que é do GHL e não nosso.
          status: e.appointmentStatus ?? e.appoinmentStatus ?? null,
          start_time: isoOrNull(e.startTime),
          end_time: isoOrNull(e.endTime),
          assigned_user_id: e.assignedUserId ?? null,
          created_at: isoOrNull(e.dateAdded),
          updated_at: isoOrNull(e.dateUpdated),
          synced_at: now,
        });
      }
    }
    for (let i = 0; i < apptRows.length; i += 500) {
      const { error } = await supabase
        .from("appointments")
        .upsert(apptRows.slice(i, i + 500), { onConflict: "client,id" });
      if (error) throw new Error("appointments upsert: " + error.message);
    }
    appointments = apptRows.length;
    removidosAppts = await removerFantasmas(supabase, "appointments", c, now, apptRows.length);
  }

  const result = {
    client: c,
    stages: stageRows.length,
    agents: agentRows.length,
    opportunities: oppRows.length,
    appointments,
    fantasmas_removidos: { opportunities: removidasOps, appointments: removidosAppts },
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
