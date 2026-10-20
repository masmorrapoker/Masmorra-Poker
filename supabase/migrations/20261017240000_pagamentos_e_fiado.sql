-- Masmorra Manager — Formas de pagamento e controle de fiado
-- 2026-10-17
--
-- 1. transactions.payment_method: dinheiro | pix | cartao | fiado (opcional;
--    lançamentos antigos ficam "não informado").
-- 2. debt_settlements: pagamentos de fiado (quitações), por jogador do cadastro.
-- 3. fiado_saldos: visão com o saldo devedor de cada jogador
--    (fiado lançado − pagamentos), respeitando as regras de acesso por clube.
--
-- Nada é alterado nos lançamentos existentes.
-- Rollback: supabase/rollback/20261017240000_pagamentos_e_fiado.down.sql

-- 1. Forma de pagamento -------------------------------------------------------
alter table public.transactions
  add column if not exists payment_method text
  check (payment_method in ('dinheiro', 'pix', 'cartao', 'fiado'));

-- Cash-out não pode ser "fiado" (o clube paga o jogador).
alter table public.transactions
  drop constraint if exists transactions_cashout_sem_fiado;
alter table public.transactions
  add constraint transactions_cashout_sem_fiado
  check (not (type = 'cash_out' and payment_method = 'fiado'));

-- 2. Pagamentos de fiado ----------------------------------------------------------
create table if not exists public.debt_settlements (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete restrict,
  amount numeric not null check (amount > 0),
  method text not null check (method in ('dinheiro', 'pix', 'cartao', 'abatido_cashout')),
  note text,
  table_id uuid references public.tables(id) on delete set null,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);

create index if not exists debt_settlements_player_idx
  on public.debt_settlements (club_id, player_id, created_at desc);

alter table public.debt_settlements enable row level security;

revoke all on public.debt_settlements from anon;
revoke update, truncate, trigger, references on public.debt_settlements from authenticated;
grant select, insert, delete on public.debt_settlements to authenticated;

drop policy if exists "debt_settlements: ler do proprio clube" on public.debt_settlements;
create policy "debt_settlements: ler do proprio clube" on public.debt_settlements
  for select to authenticated
  using (club_id = (select public.current_club_id()));

drop policy if exists "debt_settlements: registrar no proprio clube" on public.debt_settlements;
create policy "debt_settlements: registrar no proprio clube" on public.debt_settlements
  for insert to authenticated
  with check (
    club_id = (select public.current_club_id())
    and exists (
      select 1 from public.players p
      where p.id = debt_settlements.player_id and p.club_id = debt_settlements.club_id
    )
  );

-- Desfazer um pagamento lançado por engano: só nas primeiras 24 horas.
drop policy if exists "debt_settlements: desfazer em 24h" on public.debt_settlements;
create policy "debt_settlements: desfazer em 24h" on public.debt_settlements
  for delete to authenticated
  using (
    club_id = (select public.current_club_id())
    and created_at > now() - interval '24 hours'
  );

-- 3. Saldo de fiado por jogador ---------------------------------------------------
create or replace view public.fiado_saldos
with (security_invoker = true) as
select
  p.club_id,
  p.id as player_id,
  p.name,
  p.phone,
  coalesce(d.devido, 0) as devido,
  coalesce(s.pago, 0) as pago,
  coalesce(d.devido, 0) - coalesce(s.pago, 0) as saldo,
  greatest(d.ultimo_fiado, s.ultimo_pagamento) as ultima_movimentacao
from public.players p
left join (
  select tp.player_id, sum(x.amount) as devido, max(x.created_at) as ultimo_fiado
  from public.transactions x
  join public.table_players tp on tp.id = x.player_id
  where x.payment_method = 'fiado' and x.type in ('buy_in', 'consumo')
  group by tp.player_id
) d on d.player_id = p.id
left join (
  select player_id, sum(amount) as pago, max(created_at) as ultimo_pagamento
  from public.debt_settlements
  group by player_id
) s on s.player_id = p.id
where coalesce(d.devido, 0) > 0 or coalesce(s.pago, 0) > 0;

revoke all on public.fiado_saldos from anon;
grant select on public.fiado_saldos to authenticated;
