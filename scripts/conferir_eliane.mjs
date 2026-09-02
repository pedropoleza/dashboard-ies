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

const comTagVivo = vivo.filter((o) => Array.isArray(o.contact?.tags)).length;
checar("oportunidades com tags do contato", comTagVivo, ops.filter((o) => o.contact_tags !== null).length);

console.log("");
if (falhas.length) { console.log(`${falhas.length} divergência(s):`, falhas.join(" · ")); process.exit(1); }
console.log("Tudo conferido: o painel espelha o GHL.");
