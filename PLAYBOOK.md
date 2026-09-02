# Spark Client Dashboards — Playbook

Multi-client dashboards for GoHighLevel (GHL) accounts, built to embed inside GHL as a
**Custom Menu Link**. One Next.js app + one Supabase project serve every client; each client
is a row in the `clients` table and a route at `/<slug>`.

---

## Architecture

- **App:** Next.js 15 (App Router) on Vercel. Project `ies-dashboard` → `https://ies-dashboard-flax.vercel.app`.
  - `/` → redirects to the default client (`DEFAULT_CLIENT`, currently `ies`).
  - `/<slug>` → that client's dashboard (e.g. `/ies`).
  - `/api/webhooks/ghl` → receives GHL call/appointment webhooks (multi-client).
  - `/api/cron/sync` → re-syncs GHL opportunities/pipeline/users into Supabase (all clients, daily).
- **Data:** one Supabase project (`acazvqhihynklrqgkvxm`). Tables are **multi-tenant** with a `client` column:
  `clients`, `opportunities`, `stages`, `agents`, `webhook_events`, `sync_state`.
  Aggregations are `dash_*(p_client, …)` Postgres functions. RLS on; access is server-only via the service key.
- **GHL token:** read live from the shared **"GHL Token"** Supabase project (`tbziahcpkrfiksqhuhpe`).
  The app mints a per-location token at sync time. The token project stores **only** the agency token.

Two data sources feed a dashboard:
1. **GHL opportunities + pipeline + users** — pulled by the sync (funnel, lead origin, conversion, people-in-service).
2. **GHL workflow webhooks** — calls + appointments, pushed in real time (SDR call activity).

---

## The standard dashboard (sections)

All sections are toggled per client via `features`. Default = all on.

| feature key       | section               | data source                                  |
|-------------------|-----------------------|----------------------------------------------|
| `kpis`            | KPI stat-bar (+deltas)| opportunities (period vs previous period)    |
| `funnel`          | Funnel by stage       | opportunities by current stage               |
| `leadOrigin`      | Lead origin + channels| opportunity `source` + UTM attribution       |
| `sdr`             | SDR scorecards        | webhook calls + appointments + conversion    |
| `peopleInService` | Active opportunities  | open opportunities                           |

**Per-client knobs** (in `clients`): `accent` (brand color), `code` (monogram), `city`, `currency`,
`sdr_user_ids` (which agents show as SDR cards), `appt_stage_min` / `won_stage_min` (pipeline positions
that count as "appointment reached" / "won" — set after inspecting the client's pipeline).

---

## Onboard a new client (one-shot)

1. **Collect:** GHL `location_id` (company_id defaults to the Spark agency). Brand color, city, display name.
2. **Config:** copy `clients/_template.json` → `clients/<slug>.json`, fill it in.
3. **Register:** `node --env-file=.env.local scripts/add_client.mjs clients/<slug>.json`
4. **Sync:** hit `GET /api/cron/sync?client=<slug>&secret=$CRON_SECRET` (or run the cron). This loads the
   pipeline, users and opportunities.
5. **Tune the pipeline:** look at `select position, name from stages where client='<slug>' order by position`.
   Set `appt_stage_min` (first "appointment" stage position) and `won_stage_min` (the "closed/won" stage
   position) in the JSON, re-run `add_client.mjs`. Set `sdr_user_ids` to the agents to feature.
6. **Webhooks (SDR section):** in GHL, add workflow webhooks for calls and appointments pointing to
   `https://ies-dashboard-flax.vercel.app/api/webhooks/ghl?key=$WEBHOOK_SECRET` (client auto-resolves by
   `location_id`; you may append `&client=<slug>` to be explicit). See **Webhook spec** below.
7. **(Optional) history:** `node --env-file=.env.local scripts/import_csv.mjs <slug> calls.csv appts.csv`.
8. **Embed:** set the GHL Custom Menu Link to `https://ies-dashboard-flax.vercel.app/{{location.id}}` — a **single dynamic URL** (works for every account, ideal in a snapshot; the route resolves slug **or** location_id). Or use the direct slug `…/<slug>`.

No redeploy needed to add a client — it's all data + config.

---

## Webhook spec

GHL nests configured fields under a **`customData`** object. The standard payload also carries
`contact_id`, `full_name`, `phone`, `location.id`, etc. Times render as **naive Eastern** (converted to UTC).

**Calls** — add these custom-data fields (keys exactly):
`call.direction`, `call.duration`, `call.to`, `call.user_name`, `call.user_id`, `call.start_time`, `call.status`.

**Appointments** — add: `user_id` (`{{user.id}}`), `user_name` (`{{appointment.user.name}}`),
`start_time` (`{{appointment.start_time}}`), `end_time` (`{{appointment.end_time}}`).

A call counts as **connected** when `call.status` is `completed`/`answered` with a non-zero duration
(`isConnectedCall` in `app/api/webhooks/ghl/route.ts`). Need other custom fields for a new feature?
Ask Pedro to add them in the GHL webhook — they arrive under `customData`.

---

## Ops

- **Secrets** (Vercel env): `DASHBOARD_SUPABASE_URL/SERVICE_ROLE_KEY` (data + clients),
  `TOKEN_SUPABASE_URL/SERVICE_ROLE_KEY` (read agency token), `CRON_SECRET`, `WEBHOOK_SECRET`, `DEFAULT_CLIENT`.
- **Sync cadence:** Vercel cron daily (Hobby plan limit). Manual/instant: `GET /api/cron/sync?client=<slug>&secret=…`.
- **Local preview:** `npm run dev`, dashboards at `localhost:3000/<slug>`.

---

## Perfil "seguros" (Eliane, 31/08/2026)

Segundo tipo de dashboard na mesma plataforma, para contas de seguro que operam
três domínios em vez de um funil: **Prospects**, **Recruiting** e **Agency**.
Ativa quando `lib/seguros/config.ts` tem uma entrada para o slug do cliente.

**Onde cada número nasce** (a conta da Eliane não usa o campo `source` do GHL,
e os campos de agente do contato estão preenchidos em 8 de 1.200):

| Métrica | Fonte | Data de referência |
|---|---|---|
| Novos leads / candidatos | oportunidades do pipeline | `created_at` |
| Reuniões e entrevistas | tabela `appointments` (API de calendários) | `start_time` |
| Comparecimento | `appointmentStatus` | showed ÷ (showed + noshow) |
| Clientes e apólices | pipeline Policies | `created_at` da oportunidade |
| Valor emitido | `monetary_value` | idem |
| Registros de agente | estágio "Registrado" | `last_stage_change_at` |
| Níveis de carreira | estágios do pipeline Agency | estado atual |
| Origem | **tags do contato**, mapeadas em `config.ts` | idem ao lead |

**Regras que o código carrega e é fácil perder de vista:**
- reunião que já passou e continua "confirmed" é **sem marcação**, não presença;
  a taxa ignora essas e o painel mostra quantas são;
- a taxa é `null` quando nada foi marcado, e o painel escreve isso em vez de
  mostrar 0%, que afirmaria "ninguém compareceu";
- tag fora do mapa vira "Sem origem", nunca atribuição adivinhada;
- "Registrado" conta quem está lá HOJE e entrou na janela: o GHL guarda só a
  última mudança de estágio.

**Sincronização:** cron de 3 em 3 horas só para este cliente
(`/api/cron/sync?client=eliane`), mais o botão de atualizar agora no cabeçalho.
O diário geral continua valendo para os outros. O sync da agenda só roda para
quem tem `features.appointments`, então nenhum cliente antigo ganhou chamada de
API a mais.

**Conferência antes de publicar:**
```bash
node --test lib/seguros/metricas.test.ts                    # a matemática
node --env-file=.env.local scripts/conferir_eliane.mjs      # painel x GHL ao vivo
```
O segundo compara os dois lados de forma independente e sai com erro em qualquer
divergência.
