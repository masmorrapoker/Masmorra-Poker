-- Limpeza das mesas de teste do Masmorra Poker (teste, teste 2, teste 3)
-- Apaga só: as 3 mesas de teste, seus jogadores/lançamentos/histórico,
-- os 2 pagamentos de fiado de teste e os 3 cadastros "teste" criados nelas.
-- As travas de mesa encerrada são desligadas só durante esta limpeza.
begin;
set local session_replication_role = replica;
delete from public.debt_settlements where player_id in ('360a82af-7728-4a79-a098-b1ef9dacf2e5','afc6d0c1-1ad2-4f22-b0d4-1453c0ec902e','f1ee9ef0-43c7-4b11-ae6f-e885f9209f9a') or table_id in ('94d505c8-9539-4d0d-9e3f-69d0df6479bf','6d99e0ec-b324-4e4c-88bc-2e4797cafe07','26bc9e80-be29-4e14-8ad9-b22fac128232');
delete from public.table_events where table_id in ('94d505c8-9539-4d0d-9e3f-69d0df6479bf','6d99e0ec-b324-4e4c-88bc-2e4797cafe07','26bc9e80-be29-4e14-8ad9-b22fac128232');
delete from public.transactions_audit where (old_data->>'table_id')::uuid in ('94d505c8-9539-4d0d-9e3f-69d0df6479bf','6d99e0ec-b324-4e4c-88bc-2e4797cafe07','26bc9e80-be29-4e14-8ad9-b22fac128232');
delete from public.transactions where table_id in ('94d505c8-9539-4d0d-9e3f-69d0df6479bf','6d99e0ec-b324-4e4c-88bc-2e4797cafe07','26bc9e80-be29-4e14-8ad9-b22fac128232');
delete from public.table_players where table_id in ('94d505c8-9539-4d0d-9e3f-69d0df6479bf','6d99e0ec-b324-4e4c-88bc-2e4797cafe07','26bc9e80-be29-4e14-8ad9-b22fac128232');
delete from public.tables where id in ('94d505c8-9539-4d0d-9e3f-69d0df6479bf','6d99e0ec-b324-4e4c-88bc-2e4797cafe07','26bc9e80-be29-4e14-8ad9-b22fac128232');
delete from public.players where id in ('360a82af-7728-4a79-a098-b1ef9dacf2e5','afc6d0c1-1ad2-4f22-b0d4-1453c0ec902e','f1ee9ef0-43c7-4b11-ae6f-e885f9209f9a')
  and not exists (select 1 from public.table_players tp where tp.player_id = players.id);
set local session_replication_role = origin;
commit;
