// ─── Perfil "seguros": leitura do banco ─────────────────────────────────────
// A conta inteira cabe na memória (245 oportunidades, 48 agendamentos), então
// buscamos as linhas e agregamos em TypeScript, onde a matemática é testável.
// Se um dia uma conta deste perfil crescer uma ordem de grandeza, a conversa
// vira função SQL; hoje seria complexidade sem ganho.

import { supabaseDashboard } from "@/lib/supabase";
import type { ClientConfig } from "@/lib/clients";
import { configSeguros } from "./config";
import type { Oportunidade, Agendamento, Estagio } from "./metricas";

/**
 * Linhas enxutas que vão para o navegador. Só o que a matemática usa: nada de
 * nome, e-mail ou telefone. A conta inteira tem 245 oportunidades, então cabe
 * de sobra, e com os dados no cliente trocar de aba ou de período deixa de ser
 * uma ida ao servidor.
 */
export type LinhasSeguros = {
  ops: Oportunidade[];
  appts: Agendamento[];
  estagios: Estagio[];
  ultimaSync: string | null;
};

export async function carregarSeguros(client: ClientConfig): Promise<LinhasSeguros | null> {
  const cfg = configSeguros(client.slug);
  if (!cfg) return null;
  const db = supabaseDashboard();

  const [ops, appts, estagios, sync] = await Promise.all([
    db
      .from("opportunities")
      .select(
        "id,contact_id,pipeline_id,stage_id,status,monetary_value,contact_tags,created_at,last_stage_change_at",
      )
      .eq("client", client.slug)
      .limit(5000),
    db
      .from("appointments")
      .select("id,calendar_id,status,start_time")
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

  void cfg; // a configuração vive no cliente; aqui só garante que o perfil existe

  return {
    ops: (ops.data ?? []) as Oportunidade[],
    appts: (appts.data ?? []) as Agendamento[],
    estagios: (estagios.data ?? []) as Estagio[],
    ultimaSync: (sync.data as { last_sync_at: string } | null)?.last_sync_at ?? null,
  };
}
