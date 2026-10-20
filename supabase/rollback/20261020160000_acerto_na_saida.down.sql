-- Desfaz 20261020160000_acerto_na_saida (volta ao fiado lançado no buy-in).
-- Atenção: o fiado gerado nos acertos deixa de aparecer no saldo.

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

drop index if exists public.debt_settlements_transaction_idx;
alter table public.debt_settlements drop column if exists transaction_id;

drop trigger if exists transactions_validar_fiado_do_acerto on public.transactions;
drop function if exists public.validar_fiado_do_acerto();

alter table public.transactions drop constraint if exists transactions_fiado_amount_valido;
alter table public.transactions drop column if exists fiado_amount;
