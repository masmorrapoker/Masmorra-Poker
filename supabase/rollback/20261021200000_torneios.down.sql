-- Desfaz 20261021200000_torneios (apaga os torneios registrados).
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

drop function if exists public.torneio_tv(text);
drop function if exists public.agora();
drop function if exists public.torneio_relogio(uuid, int, boolean, int);
drop table if exists public.tournament_movements;
drop table if exists public.tournament_entries;
drop table if exists public.tournaments;
