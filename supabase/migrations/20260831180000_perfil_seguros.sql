-- ═══ Perfil "seguros" (Eliane de Souza), 31/08/2026 ═════════════════════════
--
-- A conta da Eliane precisa de três domínios que o dashboard padrão não cobre:
-- Prospects (seguro), Recruiting (candidatos) e Agency (carreira dos agentes).
-- Duas coisas faltavam no banco pra isso:
--
--   1. TAGS DO CONTATO. A origem do lead não existe no campo `source` dela
--      (4 de 125 leads preenchidos). Existe nas TAGS, e a busca de
--      oportunidades do GHL já devolve `contact.tags` embutido, então dá pra
--      guardar sem sincronizar 1.200 contatos.
--   2. AGENDAMENTOS. Reunião marcada, realizada e no-show vêm da API de
--      calendários, que o sync não lia. Diferente de `webhook_events` (que só
--      tem o que chegou por webhook daqui pra frente), esta tabela é
--      sincronizada, então serve pro histórico.
--
-- Aditiva: nada é removido e o dashboard atual (IES) não muda de comportamento.

alter table public.opportunities
  add column if not exists contact_tags text[];

create table if not exists public.appointments (
  client            text not null,
  id                text not null,
  calendar_id       text,
  calendar_name     text,
  contact_id        text,
  contact_name      text,
  title             text,
  status            text,          -- confirmed | showed | noshow | cancelled | invalid
  start_time        timestamptz,
  end_time          timestamptz,
  assigned_user_id  text,
  created_at        timestamptz,
  updated_at        timestamptz,
  synced_at         timestamptz default now(),
  primary key (client, id)
);

create index if not exists appointments_client_start_idx
  on public.appointments (client, start_time desc);

create index if not exists appointments_client_cal_idx
  on public.appointments (client, calendar_id);

-- O sync grava por service-role (ignora RLS); ligar a trava mantém o padrão do
-- projeto de nenhuma tabela ficar aberta ao anon.
alter table public.appointments enable row level security;
