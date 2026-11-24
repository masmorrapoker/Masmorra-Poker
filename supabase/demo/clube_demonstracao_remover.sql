-- REMOVER (rollback): apaga todos os dados do clube de demonstração, para refazer do zero.
-- Clube: Seu Clube de Poker (7262a52c-c249-4ada-9359-cf6ae33aa1e7). Mantém o clube, o login demo e a configuração.
-- Não toca em nenhum outro clube: tudo filtra por v_club, e a proteção confere id e nome.
-- Para refazer: rode este arquivo e depois o clube_demonstracao_aplicar.sql (gerado de novo para o dia).
do $$
declare
  v_club constant uuid := '7262a52c-c249-4ada-9359-cf6ae33aa1e7';
begin
  if not exists (select 1 from public.clubs where id = v_club and name = 'Seu Clube de Poker') then
    raise exception 'Clube de demonstração não encontrado. Nada foi feito.';
  end if;

  delete from public.debt_settlements where club_id = v_club;
  delete from public.cash_closings where club_id = v_club;
  delete from public.tournaments where club_id = v_club;   -- leva inscritos e movimentos (cascade)
  delete from public.tables where club_id = v_club;        -- leva jogadores da mesa, lançamentos e histórico (cascade)
  delete from public.players where club_id = v_club;
  delete from public.transactions_audit where club_id = v_club;  -- registros de "apagado" gerados pela própria limpeza
  delete from public.table_events where club_id = v_club;

  raise notice 'Dados do clube de demonstração removidos.';
end
$$;
