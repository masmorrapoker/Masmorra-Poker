-- SIMULAÇÃO: ajustes do Masmorra Poker + migração jogador_por_id, com testes.
-- Seguro: desfaz tudo no final (o erro vermelho é proposital e traz o resultado).

do $test$
declare r text := ''; n bigint; v text;
begin

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

delete from public.players where id in (
  '6c787d43-55cd-4991-8005-c94b34f29590',
  'd48920f0-0771-401e-b042-c8b4a77fc944',
  'f6f9429b-b57f-44e4-864b-bdba9ee8ab52');

update public.players set name = trim(name)
where club_id = '1c300690-e270-4503-afce-c549fbd14f58' and name <> trim(name);
update public.table_players set name = trim(name)
where club_id = '1c300690-e270-4503-afce-c549fbd14f58' and name <> trim(name);

update public.table_players set name = 'Bruno Pedrozo'
where club_id = '1c300690-e270-4503-afce-c549fbd14f58' and name = 'bruno';
update public.table_players
set name = (select name from public.players where id = '87d7b0be-2ed3-44b9-ad02-6afd9042b1a8')
where club_id = '1c300690-e270-4503-afce-c549fbd14f58' and name = 'julio';

alter table public.table_players
  add column if not exists player_id uuid references public.players(id) on delete restrict;

create index if not exists table_players_player_id_idx on public.table_players(player_id);

update public.table_players tp
set player_id = p.id
from public.players p
where tp.player_id is null
  and p.club_id = tp.club_id
  and lower(trim(p.name)) = lower(trim(tp.name))
  and (
    select count(*) from public.players p2
    where p2.club_id = tp.club_id
      and lower(trim(p2.name)) = lower(trim(tp.name))
  ) = 1;

create unique index if not exists players_club_nome_unico
  on public.players (club_id, lower(trim(name)));

create or replace function public.table_players_vincular_cadastro()
returns trigger
language plpgsql
set search_path = public
as $f$
declare
  v_club uuid;
  v_name text;
  v_status text;
begin
  select status into v_status from public.tables where id = new.table_id;
  if v_status = 'closed' then
    raise exception 'Mesa encerrada: não é possível adicionar jogadores.'
      using errcode = 'P0001';
  end if;

  if new.player_id is null then
    select id into new.player_id
    from public.players
    where club_id = new.club_id
      and lower(trim(name)) = lower(trim(new.name))
    limit 1;
  end if;

  if new.player_id is not null then
    select club_id, name into v_club, v_name
    from public.players where id = new.player_id;

    if v_club is distinct from new.club_id then
      raise exception 'Jogador não pertence a este clube.' using errcode = 'P0001';
    end if;
    new.name := v_name;
  end if;

  return new;
end
$f$;

drop trigger if exists table_players_vincular_cadastro on public.table_players;
create trigger table_players_vincular_cadastro
  before insert on public.table_players
  for each row execute function public.table_players_vincular_cadastro();

create or replace function public.players_propagar_nome()
returns trigger
language plpgsql
set search_path = public
as $f$
begin
  if new.name is distinct from old.name then
    update public.table_players set name = new.name where player_id = new.id;
  end if;
  return new;
end
$f$;

drop trigger if exists players_propagar_nome on public.players;
create trigger players_propagar_nome
  after update of name on public.players
  for each row execute function public.players_propagar_nome();

create or replace function public.transactions_bloquear_mesa_encerrada()
returns trigger
language plpgsql
set search_path = public
as $f$
declare
  v_status text;
begin
  select status into v_status
  from public.tables
  where id = coalesce(new.table_id, old.table_id);

  if v_status = 'closed' then
    raise exception 'Mesa encerrada: não é possível alterar lançamentos.'
      using errcode = 'P0001';
  end if;

  return coalesce(new, old);
end
$f$;

drop trigger if exists transactions_bloquear_mesa_encerrada on public.transactions;
create trigger transactions_bloquear_mesa_encerrada
  before insert or update or delete on public.transactions
  for each row execute function public.transactions_bloquear_mesa_encerrada();
r:=r||' ### DADOS (esperado: tx=373 bi=28370 co=23556 jogadores_mesa=119 sem_vinculo=0 jean=1)';
begin execute $q$select count(*)::text from public.transactions where club_id='1c300690-e270-4503-afce-c549fbd14f58'$q$ into v; r:=r||' | tx='||coalesce(v,'nulo'); exception when others then r:=r||' | tx=ERRO:'||left(sqlerrm,80); end;
begin execute $q$select sum(amount) filter (where type='buy_in')::text from public.transactions where club_id='1c300690-e270-4503-afce-c549fbd14f58'$q$ into v; r:=r||' | bi='||coalesce(v,'nulo'); exception when others then r:=r||' | bi=ERRO:'||left(sqlerrm,80); end;
begin execute $q$select sum(amount) filter (where type='cash_out')::text from public.transactions where club_id='1c300690-e270-4503-afce-c549fbd14f58'$q$ into v; r:=r||' | co='||coalesce(v,'nulo'); exception when others then r:=r||' | co=ERRO:'||left(sqlerrm,80); end;
begin execute $q$select count(*)::text from public.table_players where club_id='1c300690-e270-4503-afce-c549fbd14f58'$q$ into v; r:=r||' | jogadores_mesa='||coalesce(v,'nulo'); exception when others then r:=r||' | jogadores_mesa=ERRO:'||left(sqlerrm,80); end;
begin execute $q$select count(*)::text from public.table_players where club_id='1c300690-e270-4503-afce-c549fbd14f58' and player_id is null$q$ into v; r:=r||' | sem_vinculo='||coalesce(v,'nulo'); exception when others then r:=r||' | sem_vinculo=ERRO:'||left(sqlerrm,80); end;
begin execute $q$select count(*)::text from public.players where club_id='1c300690-e270-4503-afce-c549fbd14f58' and lower(name)='jean'$q$ into v; r:=r||' | jean='||coalesce(v,'nulo'); exception when others then r:=r||' | jean=ERRO:'||left(sqlerrm,80); end;
begin execute $q$select count(*)::text from public.tables where club_id='1c300690-e270-4503-afce-c549fbd14f58' and name='teste'$q$ into v; r:=r||' | mesas_teste='||coalesce(v,'nulo'); exception when others then r:=r||' | mesas_teste=ERRO:'||left(sqlerrm,80); end;
begin execute $q$select count(*)::text from public.table_players tp join public.players p on p.id=tp.player_id where p.name='Bruno Pedrozo'$q$ into v; r:=r||' | mesas_bruno_pedrozo='||coalesce(v,'nulo'); exception when others then r:=r||' | mesas_bruno_pedrozo=ERRO:'||left(sqlerrm,80); end;
begin execute $q$select count(*)::text from public.table_players tp join public.players p on p.id=tp.player_id where p.id='87d7b0be-2ed3-44b9-ad02-6afd9042b1a8'$q$ into v; r:=r||' | mesas_juliao='||coalesce(v,'nulo'); exception when others then r:=r||' | mesas_juliao=ERRO:'||left(sqlerrm,80); end;
perform set_config('request.jwt.claims', json_build_object('sub','920ec72f-ba38-4ff7-82ac-74558707ba26','role','authenticated')::text, true);
perform set_config('request.jwt.claim.sub','920ec72f-ba38-4ff7-82ac-74558707ba26', true);
execute 'set local role authenticated';
r:=r||' ### REGRAS (como seu operador)';
begin execute $q$insert into public.players(name,club_id) values (' JEAN ','1c300690-e270-4503-afce-c549fbd14f58')$q$; get diagnostics n=row_count; r:=r||' | cadastrar_jean_de_novo=ok('||n||')'; exception when others then r:=r||' | cadastrar_jean_de_novo=BLOQUEADO:'||left(sqlerrm,70); end;
begin execute $q$insert into public.players(name,club_id) values ('Teste Simulacao','1c300690-e270-4503-afce-c549fbd14f58')$q$; get diagnostics n=row_count; r:=r||' | cadastrar_jogador_novo=ok('||n||')'; exception when others then r:=r||' | cadastrar_jogador_novo=BLOQUEADO:'||left(sqlerrm,70); end;
begin execute $q$insert into public.tables(name,club_id) values ('sim-aberta','1c300690-e270-4503-afce-c549fbd14f58')$q$; get diagnostics n=row_count; r:=r||' | criar_mesa=ok('||n||')'; exception when others then r:=r||' | criar_mesa=BLOQUEADO:'||left(sqlerrm,70); end;
begin execute $q$insert into public.table_players(table_id,name,club_id) select id,'teste simulacao','1c300690-e270-4503-afce-c549fbd14f58' from public.tables where name='sim-aberta'$q$; get diagnostics n=row_count; r:=r||' | add_na_mesa_so_com_nome=ok('||n||')'; exception when others then r:=r||' | add_na_mesa_so_com_nome=BLOQUEADO:'||left(sqlerrm,70); end;
begin execute $q$select coalesce(tp.name,'')||' / vinculado='||(tp.player_id is not null) from public.table_players tp join public.tables t on t.id=tp.table_id where t.name='sim-aberta'$q$ into v; r:=r||' | vinculo_preenchido_e_nome_corrigido='||coalesce(v,'nulo'); exception when others then r:=r||' | vinculo_preenchido_e_nome_corrigido=ERRO:'||left(sqlerrm,80); end;
begin execute $q$insert into public.transactions(table_id,player_id,type,amount,club_id) select tp.table_id,tp.id,'buy_in',100,'1c300690-e270-4503-afce-c549fbd14f58' from public.table_players tp join public.tables t on t.id=tp.table_id where t.name='sim-aberta'$q$; get diagnostics n=row_count; r:=r||' | lancar_buyin_mesa_aberta=ok('||n||')'; exception when others then r:=r||' | lancar_buyin_mesa_aberta=BLOQUEADO:'||left(sqlerrm,70); end;
begin execute $q$update public.players set name='Teste Renomeado' where name='Teste Simulacao' and club_id='1c300690-e270-4503-afce-c549fbd14f58'$q$; get diagnostics n=row_count; r:=r||' | renomear_cadastro=ok('||n||')'; exception when others then r:=r||' | renomear_cadastro=BLOQUEADO:'||left(sqlerrm,70); end;
begin execute $q$select tp.name from public.table_players tp join public.tables t on t.id=tp.table_id where t.name='sim-aberta'$q$ into v; r:=r||' | nome_na_mesa_apos_renomear='||coalesce(v,'nulo'); exception when others then r:=r||' | nome_na_mesa_apos_renomear=ERRO:'||left(sqlerrm,80); end;
begin execute $q$update public.tables set status='closed', closed_at=now() where name='sim-aberta'$q$; get diagnostics n=row_count; r:=r||' | fechar_mesa=ok('||n||')'; exception when others then r:=r||' | fechar_mesa=BLOQUEADO:'||left(sqlerrm,70); end;
begin execute $q$insert into public.transactions(table_id,player_id,type,amount,club_id) select tp.table_id,tp.id,'cash_out',50,'1c300690-e270-4503-afce-c549fbd14f58' from public.table_players tp join public.tables t on t.id=tp.table_id where t.name='sim-aberta'$q$; get diagnostics n=row_count; r:=r||' | lancar_em_mesa_fechada=ok('||n||')'; exception when others then r:=r||' | lancar_em_mesa_fechada=BLOQUEADO:'||left(sqlerrm,70); end;
begin execute $q$delete from public.transactions where table_id in (select id from public.tables where name='sim-aberta')$q$; get diagnostics n=row_count; r:=r||' | apagar_lancamento_mesa_fechada=ok('||n||')'; exception when others then r:=r||' | apagar_lancamento_mesa_fechada=BLOQUEADO:'||left(sqlerrm,70); end;
begin execute $q$insert into public.table_players(table_id,name,club_id) select id,'Jean','1c300690-e270-4503-afce-c549fbd14f58' from public.tables where name='sim-aberta'$q$; get diagnostics n=row_count; r:=r||' | add_jogador_mesa_fechada=ok('||n||')'; exception when others then r:=r||' | add_jogador_mesa_fechada=BLOQUEADO:'||left(sqlerrm,70); end;
execute 'reset role';

raise exception 'SIMULACAO (nada foi gravado): %', r;
end $test$;