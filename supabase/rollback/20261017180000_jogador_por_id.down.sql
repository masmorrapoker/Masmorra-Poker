-- ROLLBACK de 20261017180000_jogador_por_id.sql
-- Remove triggers, índice único e a coluna player_id. Nenhum lançamento é apagado.

drop trigger if exists transactions_bloquear_mesa_encerrada on public.transactions;
drop function if exists public.transactions_bloquear_mesa_encerrada();

drop trigger if exists players_propagar_nome on public.players;
drop function if exists public.players_propagar_nome();

drop trigger if exists table_players_vincular_cadastro on public.table_players;
drop function if exists public.table_players_vincular_cadastro();

drop index if exists public.players_club_nome_unico;
drop index if exists public.table_players_player_id_idx;
alter table public.table_players drop column if exists player_id;
