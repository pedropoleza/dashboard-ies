// ─── Perfil "seguros": leitura do banco ─────────────────────────────────────
// A conta inteira cabe na memória (245 oportunidades, 48 agendamentos), então
// buscamos as linhas e agregamos em TypeScript, onde a matemática é testável.
// Se um dia uma conta deste perfil crescer uma ordem de grandeza, a conversa
// vira função SQL; hoje seria complexidade sem ganho.

import { supabaseDashboard } from "@/lib/supabase";
import type { ClientConfig } from "@/lib/clients";
import { configSeguros } from "./config";
import {
  painelProspects, painelRecruiting, painelAgency, janelaAnterior, variacao,
  type Oportunidade, type Agendamento, type Estagio, type Janela,
} from "./metricas";

export type DadosSeguros = {
  prospects: ReturnType<typeof painelProspects>;
  prospectsAnterior: ReturnType<typeof painelProspects>;
  recruiting: ReturnType<typeof painelRecruiting>;
  recruitingAnterior: ReturnType<typeof painelRecruiting>;
  agency: ReturnType<typeof painelAgency>;
  ultimaSync: string | null;
  variacao: typeof variacao;
};

export async function carregarSeguros(
  client: ClientConfig,
  janela: Janela,
): Promise<DadosSeguros | null> {
  const cfg = configSeguros(client.slug);
  if (!cfg) return null;
  const db = supabaseDashboard();

  const [ops, appts, estagios, sync] = await Promise.all([
    db
      .from("opportunities")
      .select(
        "id,name,contact_id,contact_name,pipeline_id,stage_id,status,monetary_value,contact_tags,created_at,last_stage_change_at",
      )
      .eq("client", client.slug)
      .limit(5000),
    db
      .from("appointments")
      .select("id,calendar_id,contact_id,contact_name,title,status,start_time")
      .eq("client", client.slug)
      .limit(5000),
    db
      .from("stages")
      .select("stage_id,pipeline_id,name,position")
      .eq("client", client.slug)
      .limit(500),
    db
      .from("sync_state")
      .select("last_sync_at")
      .eq("client", client.slug)
      .eq("id", "opportunities")
      .maybeSingle(),
  ]);

  const O = (ops.data ?? []) as Oportunidade[];
  const A = (appts.data ?? []) as Agendamento[];
  const E = (estagios.data ?? []) as Estagio[];
  const agora = new Date();
  const anterior = janelaAnterior(janela);

  return {
    prospects: painelProspects(O, A, E, cfg, janela, agora),
    prospectsAnterior: painelProspects(O, A, E, cfg, anterior, agora),
    recruiting: painelRecruiting(O, A, E, cfg, janela, agora),
    recruitingAnterior: painelRecruiting(O, A, E, cfg, anterior, agora),
    agency: painelAgency(O, cfg, janela),
    ultimaSync: (sync.data as { last_sync_at: string } | null)?.last_sync_at ?? null,
    variacao,
  };
}
