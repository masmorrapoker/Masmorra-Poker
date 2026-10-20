-- Masmorra Manager — Fechamento de caixa da noite
-- 2026-10-20
--
-- Uma linha por noite de jogo e por clube: troco inicial, dinheiro esperado
-- (calculado no app a partir dos acertos), dinheiro contado e a diferença.
-- "summary" guarda um retrato dos totais no momento do fechamento, para o
-- histórico não mudar se algo for corrigido depois.
--
-- Fechamento não é editado: para refazer, desfaz (até 24h) e fecha de novo.
-- Rollback: supabase/rollback/20261020200000_fechamento_de_caixa.down.sql

create table if not exists public.cash_closings (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  night date not null,
  opening_cash numeric not null default 0 check (opening_cash >= 0),
  expected_cash numeric not null,
  counted_cash numeric not null check (counted_cash >= 0),
  difference numeric generated always as (counted_cash - expected_cash) stored,
  summary jsonb not null default '{}'::jsonb,
  note text,
  closed_by_name text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  constraint cash_closings_uma_por_noite unique (club_id, night)
);

alter table public.cash_closings enable row level security;

revoke all on public.cash_closings from anon;
revoke update, truncate, trigger, references on public.cash_closings from authenticated;
grant select, insert, delete on public.cash_closings to authenticated;

drop policy if exists "cash_closings: ler do proprio clube" on public.cash_closings;
create policy "cash_closings: ler do proprio clube" on public.cash_closings
  for select to authenticated
  using (club_id = (select public.current_club_id()));

drop policy if exists "cash_closings: fechar no proprio clube" on public.cash_closings;
create policy "cash_closings: fechar no proprio clube" on public.cash_closings
  for insert to authenticated
  with check (club_id = (select public.current_club_id()));

drop policy if exists "cash_closings: desfazer em 24h" on public.cash_closings;
create policy "cash_closings: desfazer em 24h" on public.cash_closings
  for delete to authenticated
  using (
    club_id = (select public.current_club_id())
    and created_at > now() - interval '24 hours'
  );
