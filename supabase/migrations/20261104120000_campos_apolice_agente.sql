-- Perfil "seguros", 04/11/2026: os campos que dizem quando uma apolice foi emitida e
-- quando um agente foi registrado. A Camila pediu os numeros por Issued Date e pela
-- data real do registro em 28/08, e o painel contava pela criacao da oportunidade,
-- que e o dia em que o sync do Five Rings importou (28 apolices em 11/09/2025, 22 em
-- 18/05/2026).
--
-- Aditiva e so com colunas anulaveis, sem default: nao reescreve a tabela e os outros
-- clientes nao mudam. Sao colunas tipadas, e nao um jsonb com os campos da oportunidade,
-- para nao trazer data de nascimento e nome do segurado para este banco.

alter table public.opportunities
  add column if not exists policy_issue_date date,
  add column if not exists policy_status text,
  add column if not exists agent_status text,
  add column if not exists agent_start_date date;
