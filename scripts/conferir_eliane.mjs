// Reconciliação: o que o dashboard mostra tem que ser o que o GHL tem.
// Lê os dois lados de forma independente e compara. Qualquer divergência sai
// com código 1, para servir de porteiro antes de publicar.
//   node --env-file=.env.local scripts/conferir_eliane.mjs
import { createClient } from "@supabase/supabase-js";

const SLUG = "eliane", LOC = "UPBHBX5RwcigLjECqvU8", CO = "TdmQMjj86Y3LgppiB96K";
const db = createClient(process.env.DASHBOARD_SUPABASE_URL, process.env.DASHBOARD_SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const tdb = createClient(process.env.TOKEN_SUPABASE_URL, process.env.TOKEN_SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const { data: tok } = await tdb.from("Token Refresher").select("access_token").limit(1).single();
const r = await fetch("https://services.leadconnectorhq.com/oauth/locationToken", {
  method: "POST",
  headers: { Authorization: `Bearer ${tok.access_token}`, Version: "2021-07-28", "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
  body: new URLSearchParams({ companyId: CO, locationId: LOC }),
});
const LT = JSON.parse(await r.text()).access_token;
const g = async (path, versao = "2021-07-28") => {
  const res = await fetch(`https://services.leadconnectorhq.com${path}`, { headers: { Authorization: `Bearer ${LT}`, Version: versao, Accept: "application/json" } });
  if (!res.ok) throw new Error(`${path} -> ${res.status}`);
  return res.json();
};

// ── GHL ao vivo ──
const vivo = [];
let url = `/opportunities/search?location_id=${LOC}&limit=100`;
for (let i = 0; i < 20 && url; i++) {
  const d = await g(url);
  vivo.push(...(d.opportunities ?? []));
  url = d.meta?.nextPageUrl?.replace("https://services.leadconnectorhq.com", "") ?? null;
}
const cals = (await g(`/calendars/?locationId=${LOC}`)).calendars ?? [];
const eventos = new Map();
const INI = Date.UTC(2024, 0, 1), FIM = Date.now() + 180 * 86400000, FATIA = 120 * 86400000;
for (const c of cals) {
  for (let a = INI; a < FIM; a += FATIA) {
    const d = await g(`/calendars/events?locationId=${LOC}&calendarId=${c.id}&startTime=${a}&endTime=${Math.min(a + FATIA, FIM)}`, "2021-04-15");
    for (const e of d.events ?? []) if (!e.deleted) eventos.set(e.id, e);
  }
}

// ── Banco do dashboard ──
const { data: ops } = await db.from("opportunities").select("id,pipeline_id,monetary_value,contact_tags,stage_id").eq("client", SLUG).limit(5000);
const { data: appts } = await db.from("appointments").select("id,status").eq("client", SLUG).limit(5000);

// ── Comparação ──
const falhas = [];
const checar = (rotulo, a, b) => {
  const ok = a === b;
  console.log(`${ok ? "OK  " : "FALHA"} ${rotulo.padEnd(42)} GHL=${String(a).padStart(9)}  painel=${String(b).padStart(9)}`);
  if (!ok) falhas.push(rotulo);
};

checar("oportunidades no total", vivo.length, ops.length);
const porPipeVivo = {}, porPipeBanco = {};
for (const o of vivo) porPipeVivo[o.pipelineId] = (porPipeVivo[o.pipelineId] ?? 0) + 1;
for (const o of ops) porPipeBanco[o.pipeline_id] = (porPipeBanco[o.pipeline_id] ?? 0) + 1;
const NOMES = { pNdcs7yI8ftr4fCEA1yF: "Prospects", iRtCRZQww1qV6m3nAezT: "Policies", IsCc4xeHMFcfhLfpiBeV: "Recruiting", RJhGPwWjWrPf21IOSwNo: "Agency" };
for (const [pid, nome] of Object.entries(NOMES)) checar(`oportunidades em ${nome}`, porPipeVivo[pid] ?? 0, porPipeBanco[pid] ?? 0);

const valVivo = Math.round(vivo.filter((o) => o.pipelineId === "iRtCRZQww1qV6m3nAezT").reduce((t, o) => t + (o.monetaryValue ?? 0), 0));
const valBanco = Math.round(ops.filter((o) => o.pipeline_id === "iRtCRZQww1qV6m3nAezT").reduce((t, o) => t + Number(o.monetary_value ?? 0), 0));
checar("valor emitido em Policies (US$)", valVivo, valBanco);

const clientesVivo = new Set(vivo.filter((o) => o.pipelineId === "iRtCRZQww1qV6m3nAezT").map((o) => o.contactId)).size;
const { data: opsPol } = await db.from("opportunities").select("contact_id").eq("client", SLUG).eq("pipeline_id", "iRtCRZQww1qV6m3nAezT");
checar("clientes distintos com apólice", clientesVivo, new Set(opsPol.map((o) => o.contact_id)).size);

checar("agendamentos", eventos.size, appts.length);
for (const st of ["showed", "noshow", "confirmed", "cancelled"]) {
  checar(`agendamentos ${st}`, [...eventos.values()].filter((e) => (e.appointmentStatus ?? "") === st).length, appts.filter((a) => a.status === st).length);
}

// ── Datas que decidem número (apólice e agente), mês a mês ──
const CAMPOS = { emissao: "y4Z12LjPJqNvaiHBYqKd", statusApolice: "EAHat0M6jDhbPIagbsEe", statusAgente: "K9mXgAp2vQG4sN9w9M7L", inicio: "jmnofrbsvrpztZqVRTZW" };
const campo = (o, id) => { const c = (o.customFields ?? []).find((x) => x.id === id); return c ? (c.fieldValueString ?? c.fieldValueDate ?? null) : null; };
const dia = (v) => (v ? new Date(v).toISOString().slice(0, 10) : null);
const POL = "iRtCRZQww1qV6m3nAezT", AG = "RJhGPwWjWrPf21IOSwNo";
const { data: opsDatas } = await db.from("opportunities").select("id,pipeline_id,monetary_value,policy_issue_date,policy_status,agent_status,agent_start_date").eq("client", SLUG).limit(5000);
const polVivo = vivo.filter((o) => o.pipelineId === POL), polBanco = opsDatas.filter((o) => o.pipeline_id === POL);
const fora = ["declined", "not taken", "incomplete"];
const mesVivo = {}, mesBanco = {}, valVivoMes = {}, valBancoMes = {};
for (const o of polVivo) { if (fora.includes(String(campo(o, CAMPOS.statusApolice)).toLowerCase())) continue; const m = dia(campo(o, CAMPOS.emissao))?.slice(0, 7) ?? "sem data"; mesVivo[m] = (mesVivo[m] ?? 0) + 1; valVivoMes[m] = (valVivoMes[m] ?? 0) + (o.monetaryValue ?? 0); }
for (const o of polBanco) { if (fora.includes(String(o.policy_status).toLowerCase())) continue; const m = o.policy_issue_date?.slice(0, 7) ?? "sem data"; mesBanco[m] = (mesBanco[m] ?? 0) + 1; valBancoMes[m] = (valBancoMes[m] ?? 0) + Number(o.monetary_value ?? 0); }
for (const m of [...new Set([...Object.keys(mesVivo), ...Object.keys(mesBanco)])].sort()) {
  checar(`apólices emitidas em ${m}`, mesVivo[m] ?? 0, mesBanco[m] ?? 0);
  checar(`valor emitido em ${m} (US$)`, Math.round(valVivoMes[m] ?? 0), Math.round(valBancoMes[m] ?? 0));
}
const agVivo = vivo.filter((o) => o.pipelineId === AG), agBanco = opsDatas.filter((o) => o.pipeline_id === AG);
checar("agentes com data de início", agVivo.filter((o) => campo(o, CAMPOS.inicio)).length, agBanco.filter((o) => o.agent_start_date).length);
checar("agentes Inactive", agVivo.filter((o) => campo(o, CAMPOS.statusAgente) === "Inactive").length, agBanco.filter((o) => o.agent_status === "Inactive").length);
const idsVivos = new Set(vivo.map((o) => o.id));
checar("fantasmas no painel (tem que ser 0)", 0, ops.filter((o) => !idsVivos.has(o.id)).length);

const comTagVivo = vivo.filter((o) => Array.isArray(o.contact?.tags)).length;
checar("oportunidades com tags do contato", comTagVivo, ops.filter((o) => o.contact_tags !== null).length);

console.log("");
if (falhas.length) { console.log(`${falhas.length} divergência(s):`, falhas.join(" · ")); process.exit(1); }
console.log("Tudo conferido: o painel espelha o GHL.");
