-- Ajustes de dados do clube Masmorra Poker — 2026-10-17
-- Rodar ANTES de 20261017180000_jogador_por_id.sql (o índice único exige isto).
-- Decisões do dono do clube em 17/10/2026:
--   * apagar as 6 mesas "teste" criadas em 13/10 (toque múltiplo);
--   * juntar os 4 cadastros "Jean" (duplicados vazios de 01/10) em um só;
--   * "bruno" nas mesas = cadastro "Bruno Pedrozo"; "julio" = cadastro "Julião".

-- 1. Mesas de teste (6 mesas, 4 lançamentos de teste) ----------------------
delete from public.transactions where table_id in (
  'dbf0e3f8-b194-405a-a7d5-d823c4c844fa','96f629b5-e944-4d99-866b-41276ff8e02d',
  '2de876b2-4b4c-4bfb-88d8-01445c3d2b8f','e7a2916e-5bd1-48a8-af73-56e320b7ccc1',
  '28956b68-8848-41e7-9c79-f6acc524a071','420f0cc9-8ca6-498f-8d26-ea6864799510');
delete from public.table_players where table_id in (
  'dbf0e3f8-b194-405a-a7d5-d823c4c844fa','96f629b5-e944-4d99-866b-41276ff8e02d',
  '2de876b2-4b4c-4bfb-88d8-01445c3d2b8f','e7a2916e-5bd1-48a8-af73-56e320b7ccc1',
  '28956b68-8848-41e7-9c79-f6acc524a071','420f0cc9-8ca6-498f-8d26-ea6864799510');
delete from public.tables where id in (
  'dbf0e3f8-b194-405a-a7d5-d823c4c844fa','96f629b5-e944-4d99-866b-41276ff8e02d',
  '2de876b2-4b4c-4bfb-88d8-01445c3d2b8f','e7a2916e-5bd1-48a8-af73-56e320b7ccc1',
  '28956b68-8848-41e7-9c79-f6acc524a071','420f0cc9-8ca6-498f-8d26-ea6864799510');

-- 2. Cadastros "Jean" duplicados: fica b18aca36 -----------------------------
delete from public.players where id in (
  '6c787d43-55cd-4991-8005-c94b34f29590',
  'd48920f0-0771-401e-b042-c8b4a77fc944',
  'f6f9429b-b57f-44e4-864b-bdba9ee8ab52');

-- 3. Espaços sobrando nos nomes (ex.: "Julião ") ------------------------------
update public.players set name = trim(name)
where club_id = '1c300690-e270-4503-afce-c549fbd14f58' and name <> trim(name);
update public.table_players set name = trim(name)
where club_id = '1c300690-e270-4503-afce-c549fbd14f58' and name <> trim(name);

-- 4. Nomes antigos nas mesas -> cadastro atual -------------------------------
update public.table_players set name = 'Bruno Pedrozo'
where club_id = '1c300690-e270-4503-afce-c549fbd14f58' and name = 'bruno';
update public.table_players
set name = (select name from public.players where id = '87d7b0be-2ed3-44b9-ad02-6afd9042b1a8')
where club_id = '1c300690-e270-4503-afce-c549fbd14f58' and name = 'julio';
