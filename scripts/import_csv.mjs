// Import historical GHL call + appointment CSV exports into webhook_events for a client.
// Usage: node --env-file=.env.local scripts/import_csv.mjs <client_slug> <calls.csv> [appointments.csv]
// Idempotent: re-running replaces this client's csv-imported rows.
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";

const [, , CLIENT, CALLS_CSV, APPTS_CSV] = process.argv;
if (!CLIENT || !CALLS_CSV) {
  console.error("Usage: node --env-file=.env.local scripts/import_csv.mjs <client_slug> <calls.csv> [appointments.csv]");
  process.exit(1);
}

const url = process.env.DASHBOARD_SUPABASE_URL;
const key = process.env.DASHBOARD_SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("Missing DASHBOARD_SUPABASE_* env");
const supabase = createClient(url, key, { auth: { persistSession: false } });

const { data: client, error: cErr } = await supabase
  .from("clients").select("slug, location_id").eq("slug", CLIENT).maybeSingle();
if (cErr || !client) throw new Error(`Client '${CLIENT}' not found in clients table`);
const LOCATION_ID = client.location_id;

// --- quote-aware CSV parser ---
function parseCsv(text) {
  const rows = [];
  let row = [], field = "", inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQ = false; }
      else field += c;
    } else if (c === '"') inQ = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\r") { /* skip */ }
    else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}
function readCsv(path) {
  if (!path || !fs.existsSync(path)) return [];
  const rows = parseCsv(fs.readFileSync(path, "utf8"));
  const idx = Object.fromEntries(rows[0].map((h, i) => [h.trim(), i]));
  return rows.slice(1).filter((r) => r.length > 1).map((r) => {
    const o = {};
    for (const h in idx) o[h] = r[idx[h]] ?? "";
    return o;
  });
}

// --- naive ET timestamp -> UTC ISO (DST-aware) ---
function nthSunday(y, m, n) { let c = 0; for (let d = 1; d <= 31; d++) { const dt = new Date(Date.UTC(y, m - 1, d)); if (dt.getUTCMonth() !== m - 1) break; if (dt.getUTCDay() === 0 && ++c === n) return d; } return 1; }
function isEdt(y, mo, d) { const s = Date.UTC(y, 2, nthSunday(y, 3, 2)), e = Date.UTC(y, 10, nthSunday(y, 11, 1)), t = Date.UTC(y, mo - 1, d); return t >= s && t < e; }
function etToUtc(s) {
  if (!s) return null;
  const m = String(s).trim().match(/^(\d{4})-(\d{1,2})-(\d{1,2})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (!m) { const d = new Date(s); return isNaN(d.getTime()) ? null : d.toISOString(); }
  const Y = +m[1], Mo = +m[2], D = +m[3], H = +m[4], Mi = +m[5], S = m[6] ? +m[6] : 0;
  return new Date(Date.UTC(Y, Mo - 1, D, H + (isEdt(Y, Mo, D) ? 4 : 5), Mi, S)).toISOString();
}
const connected = (st, dur) => (st === "completed" || st === "answered") && (dur ?? 0) > 0;

const calls = readCsv(CALLS_CSV).filter((r) => (r["location_id"] || LOCATION_ID) === LOCATION_ID).map((r) => {
  const dur = r["customData_call.duration"] === "" ? null : parseInt(r["customData_call.duration"], 10);
  const status = (r["customData_call.status"] || "").trim();
  return {
    client: CLIENT, location_id: LOCATION_ID, event_type: "call",
    user_id: r["customData_call.user_id"] || null, user_name: r["customData_call.user_name"] || null,
    contact_id: r["contact_id"] || null, contact_name: r["full_name"]?.trim() || null,
    contact_phone: r["customData_call.to"] || r["phone"] || null, direction: r["customData_call.direction"] || null,
    duration: Number.isNaN(dur) ? null : dur, call_status: status || null,
    is_successful: connected(status.toLowerCase(), dur), event_time: etToUtc(r["customData_call.start_time"]),
    raw: { import: "csv" },
  };
}).filter((r) => r.event_time);

const appts = readCsv(APPTS_CSV).filter((r) => (r["location_id"] || LOCATION_ID) === LOCATION_ID).map((r) => {
  const start = etToUtc(r["calendar_startTime"] || r["customData_start_time"]);
  return {
    client: CLIENT, location_id: LOCATION_ID, event_type: "appointment",
    user_id: r["customData_user_id"] || null, user_name: r["customData_user_name"] || null,
    contact_id: r["contact_id"] || null, contact_name: r["full_name"]?.trim() || null,
    appt_start_time: start, appt_end_time: etToUtc(r["calendar_endTime"] || r["customData_end_time"]),
    appt_status: r["calendar_appoinmentStatus"] || r["calendar_status"] || null, event_time: start,
    raw: { import: "csv", created_by_user_id: r["calendar_created_by_user_id"] || null },
  };
}).filter((r) => r.event_time);

console.log(`[${CLIENT}] parsed ${calls.length} calls, ${appts.length} appointments`);

await supabase.from("webhook_events").delete().eq("client", CLIENT).eq("raw->>import", "csv");
async function insertAll(rows) {
  for (let i = 0; i < rows.length; i += 1000) {
    const { error } = await supabase.from("webhook_events").insert(rows.slice(i, i + 1000));
    if (error) throw new Error(`insert @${i}: ${error.message}`);
    process.stdout.write(`\r  inserted ${Math.min(i + 1000, rows.length)}/${rows.length}`);
  }
  process.stdout.write("\n");
}
if (calls.length) { console.log("Inserting calls..."); await insertAll(calls); }
if (appts.length) { console.log("Inserting appointments..."); await insertAll(appts); }
console.log("Done.");
