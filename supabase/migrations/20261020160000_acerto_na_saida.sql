-- Masmorra Manager — Acerto na saída do jogador
-- 2026-10-20
--
-- Como os clubes da região trabalham: ninguém paga o buy-in na hora. O acerto
-- é feito quando o jogador sai:
--   - saiu perdendo  → paga a diferença (dinheiro/PIX/cartão) ou fica devendo;
--   - saiu ganhando  → o clube paga já descontando o buy-in (e pode abater
--                      fiado antigo).
--
-- 1. transactions.fiado_amount: no cash-out, quanto do acerto ficou devendo.
--    transactions.payment_method no cash-out passa a significar "como o acerto
--    foi pago/recebido".
-- 2. Trava: o fiado do cash-out não pode passar do que o jogador deve na mesa.
-- 3. debt_settlements.transaction_id: o abatimento de fiado fica preso ao
--    cash-out; se o cash-out for removido, o abatimento some junto.
-- 4. fiado_saldos passa a somar o fiado gerado nos acertos.
--
-- Nada é alterado nos lançamentos existentes.
-- Rollback: supabase/rollback/20261020160000_acerto_na_saida.down.sql

-- 1. Fiado gerado no acerto ------------------------------------------------------
alter table public.transactions
  add column if not exists fiado_amount numeric not null default 0;

alter table public.transactions
  drop constraint if exists transactions_fiado_amount_valido;
alter table public.transactions
  add constraint transactions_fiado_amount_valido
  check (fiado_amount >= 0 and (fiado_amount = 0 or type = 'cash_out'));

-- 2. O fiado não pode passar do que o jogador deve na mesa -------------------------
create or replace function public.validar_fiado_do_acerto()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  devendo numeric;
begin
  if new.type <> 'cash_out' or coalesce(new.fiado_amount, 0) = 0 then
    return new;
  end if;

  select coalesce(sum(case when type in ('buy_in', 'consumo') then amount else -amount end), 0)
    into devendo
  from public.transactions
  where player_id = new.player_id
    and id is distinct from new.id;

  devendo := devendo - new.amount;

  if new.fiado_amount > greatest(devendo, 0) then
    raise exception 'Fiado (%) maior que o valor devido pelo jogador na mesa (%).',
      new.fiado_amount, greatest(devendo, 0)
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists transactions_validar_fiado_do_acerto on public.transactions;
create trigger transactions_validar_fiado_do_acerto
  before insert or update of amount, fiado_amount, type on public.transactions
  for each row execute function public.validar_fiado_do_acerto();

-- 3. Abatimento preso ao cash-out ---------------------------------------------------
alter table public.debt_settlements
  add column if not exists transaction_id uuid
  references public.transactions(id) on delete cascade;

create index if not exists debt_settlements_transaction_idx
  on public.debt_settlements (transaction_id) where transaction_id is not null;

-- 4. Saldo de fiado: buy-in/consumo no fiado (modelo antigo) + fiado dos acertos ----
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
  select tp.player_id,
         sum(case when x.type = 'cash_out' then x.fiado_amount else x.amount end) as devido,
         max(x.created_at) as ultimo_fiado
  from public.transactions x
  join public.table_players tp on tp.id = x.player_id
  where (x.payment_method = 'fiado' and x.type in ('buy_in', 'consumo'))
     or (x.type = 'cash_out' and x.fiado_amount > 0)
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
