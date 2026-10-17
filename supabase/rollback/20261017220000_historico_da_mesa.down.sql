-- ROLLBACK de 20261017220000_historico_da_mesa.sql
-- ATENÇÃO: apaga a linha do tempo das mesas. Lançamentos e auditoria não são afetados.

drop trigger if exists table_players_validar_remocao on public.table_players;
drop function if exists public.table_players_validar_remocao();

drop trigger if exists registrar_evento_mesa on public.transactions;
drop trigger if exists registrar_evento_mesa on public.table_players;
drop trigger if exists registrar_evento_mesa on public.tables;
drop function if exists public.registrar_evento_mesa();

do $$
begin
  if exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'table_events') then
    alter publication supabase_realtime drop table public.table_events;
  end if;
end
$$;

drop table if exists public.table_events;
