// Register / update a client dashboard.
// Usage: node --env-file=.env.local scripts/add_client.mjs clients/<slug>.json
// JSON shape (see clients/_template.json):
//   { "slug","name","code","city","location_id","company_id","accent",
//     "timezone","currency","locale","pipeline_id","sdr_user_ids":[],
//     "appt_stage_min","won_stage_min","features":{...},"active" }
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";

const path = process.argv[2];
if (!path) { console.error("Usage: node --env-file=.env.local scripts/add_client.mjs <config.json>"); process.exit(1); }

const cfg = JSON.parse(fs.readFileSync(path, "utf8"));
for (const k of ["slug", "name", "location_id"]) {
  if (!cfg[k]) throw new Error(`Missing required field: ${k}`);
}
cfg.company_id = cfg.company_id || "TdmQMjj86Y3LgppiB96K"; // Spark agency default

const url = process.env.DASHBOARD_SUPABASE_URL;
const key = process.env.DASHBOARD_SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("Missing DASHBOARD_SUPABASE_* env");
const supabase = createClient(url, key, { auth: { persistSession: false } });

const { error } = await supabase.from("clients").upsert(
  {
    slug: cfg.slug,
    name: cfg.name,
    code: cfg.code ?? cfg.slug.toUpperCase().slice(0, 3),
    city: cfg.city ?? null,
    location_id: cfg.location_id,
    company_id: cfg.company_id,
    timezone: cfg.timezone ?? "America/New_York",
    currency: cfg.currency ?? "USD",
    locale: cfg.locale ?? "pt-BR",
    accent: cfg.accent ?? "#2f54eb",
    pipeline_id: cfg.pipeline_id ?? null,
    sdr_user_ids: cfg.sdr_user_ids ?? [],
    appt_stage_min: cfg.appt_stage_min ?? 4,
    won_stage_min: cfg.won_stage_min ?? 999,
    appt_stage_ids: cfg.appt_stage_ids ?? [],
    won_stage_ids: cfg.won_stage_ids ?? [],
    call_min_seconds: cfg.call_min_seconds ?? 0,
    won_label: cfg.won_label ?? null,
    pipelines: cfg.pipelines ?? [],
    features: cfg.features ?? { kpis: true, funnel: true, leadOrigin: true, sdr: true, peopleInService: true },
    active: cfg.active ?? true,
    updated_at: new Date().toISOString(),
  },
  { onConflict: "slug" },
);
if (error) throw new Error(error.message);

console.log(`\n✓ Client '${cfg.slug}' saved.\n`);
console.log("Next steps:");
console.log(`  1. Sync GHL data:   GET /api/cron/sync?client=${cfg.slug}&secret=$CRON_SECRET`);
console.log(`     (then inspect the pipeline and set appt_stage_min / won_stage_min / sdr_user_ids, re-run if needed)`);
console.log(`  2. Webhook URL:     /api/webhooks/ghl?key=$WEBHOOK_SECRET   (client auto-resolved by location_id)`);
console.log(`  3. GHL menu link:   https://ies-dashboard-flax.vercel.app/{{location.id}}   (dynamic — same link every account)`);
console.log(`     or direct slug:  https://ies-dashboard-flax.vercel.app/${cfg.slug}`);
console.log(`  4. (optional) historical import: node --env-file=.env.local scripts/import_csv.mjs ${cfg.slug} calls.csv appts.csv\n`);
