-- SIMULAÇÃO da migração 20261013200000_rls_isolamento_por_clube
-- Seguro: aplica a correção, roda os testes e DESFAZ TUDO no final
-- (o "erro" vermelho no fim é proposital e contém o resultado dos testes).
-- Como usar: Supabase > SQL Editor > New query > colar tudo > Run.

do $test$
declare r text := ''; n bigint;
begin

create or replace function public.current_club_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $f$
  select club_id from public.profiles where id = auth.uid()
$f$;

revoke all on function public.current_club_id() from public, anon;
grant execute on function public.current_club_id() to authenticated;

drop policy if exists "Allow all operations for clubs"          on public.clubs;
drop policy if exists "Allow all operations for profiles"       on public.profiles;
drop policy if exists "Users can read own profile"              on public.profiles;
drop policy if exists "Allow all operations for club_settings"  on public.club_settings;
drop policy if exists "Allow all operations for tables"         on public.tables;
drop policy if exists "Club isolation tables"                   on public.tables;
drop policy if exists "Allow all operations for players"        on public.players;
drop policy if exists "Club isolation players"                  on public.players;
drop policy if exists "Allow all operations for table_players"  on public.table_players;
drop policy if exists "Club isolation table players"            on public.table_players;
drop policy if exists "Allow all operations for transactions"   on public.transactions;
drop policy if exists "Club isolation transactions"             on public.transactions;

revoke all on public.clubs, public.profiles, public.club_settings,
              public.tables, public.players, public.table_players,
              public.transactions
  from anon;

revoke truncate, trigger, references
  on public.clubs, public.profiles, public.club_settings,
     public.tables, public.players, public.table_players,
     public.transactions
  from authenticated;

revoke insert, delete on public.clubs, public.profiles from authenticated;
revoke delete on public.club_settings from authenticated;

revoke update on public.profiles from authenticated;
grant update (full_name) on public.profiles to authenticated;

alter table public.clubs         enable row level security;
alter table public.profiles      enable row level security;
alter table public.club_settings enable row level security;
alter table public.tables        enable row level security;
alter table public.players       enable row level security;
alter table public.table_players enable row level security;
alter table public.transactions  enable row level security;

create policy "clubs: ler o proprio clube" on public.clubs
  for select to authenticated
  using (id = (select public.current_club_id()));
create policy "clubs: editar o proprio clube" on public.clubs
  for update to authenticated
  using (id = (select public.current_club_id()))
  with check (id = (select public.current_club_id()));

create policy "profiles: ler o proprio perfil" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()));
create policy "profiles: editar o proprio perfil" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy "club_settings: ler do proprio clube" on public.club_settings
  for select to authenticated
  using (club_id = (select public.current_club_id()));
create policy "club_settings: criar do proprio clube" on public.club_settings
  for insert to authenticated
  with check (club_id = (select public.current_club_id()));
create policy "club_settings: editar do proprio clube" on public.club_settings
  for update to authenticated
  using (club_id = (select public.current_club_id()))
  with check (club_id = (select public.current_club_id()));

create policy "tables: proprio clube" on public.tables
  for all to authenticated
  using (club_id = (select public.current_club_id()))
  with check (club_id = (select public.current_club_id()));

create policy "players: proprio clube" on public.players
  for all to authenticated
  using (club_id = (select public.current_club_id()))
  with check (club_id = (select public.current_club_id()));

create policy "table_players: proprio clube" on public.table_players
  for all to authenticated
  using (club_id = (select public.current_club_id()))
  with check (club_id = (select public.current_club_id()));

create policy "transactions: proprio clube" on public.transactions
  for all to authenticated
  using (club_id = (select public.current_club_id()))
  with check (club_id = (select public.current_club_id()));

drop policy if exists "Allow public upload to logos" on storage.objects;

create policy "logos: upload do proprio clube" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'logos'
    and name like (select public.current_club_id())::text || '-%'
  );
create policy "logos: atualizar do proprio clube" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'logos'
    and name like (select public.current_club_id())::text || '-%'
  );

perform set_config('request.jwt.claims', json_build_object('sub','920ec72f-ba38-4ff7-82ac-74558707ba26','role','authenticated')::text, true);
perform set_config('request.jwt.claim.sub','920ec72f-ba38-4ff7-82ac-74558707ba26', true);
execute 'set local role authenticated';
r:=r||' ### OPERADOR MASMORRA POKER';
begin execute $q$select count(*) from public.clubs$q$ into n; r:=r||' | clubs='||n; exception when others then r:=r||' | clubs=ERRO:'||sqlerrm; end;
begin execute $q$select count(*) from public.profiles$q$ into n; r:=r||' | profiles='||n; exception when others then r:=r||' | profiles=ERRO:'||sqlerrm; end;
begin execute $q$select count(*) from public.club_settings$q$ into n; r:=r||' | club_settings='||n; exception when others then r:=r||' | club_settings=ERRO:'||sqlerrm; end;
begin execute $q$select count(*) from public.tables$q$ into n; r:=r||' | tables='||n; exception when others then r:=r||' | tables=ERRO:'||sqlerrm; end;
begin execute $q$select count(*) from public.players$q$ into n; r:=r||' | players='||n; exception when others then r:=r||' | players=ERRO:'||sqlerrm; end;
begin execute $q$select count(*) from public.table_players$q$ into n; r:=r||' | table_players='||n; exception when others then r:=r||' | table_players=ERRO:'||sqlerrm; end;
begin execute $q$select count(*) from public.transactions$q$ into n; r:=r||' | transactions='||n; exception when others then r:=r||' | transactions=ERRO:'||sqlerrm; end;
begin execute $q$select count(*) from public.tables where club_id='1aefa5fe-6baf-42ee-a4ec-444ea53904aa'$q$ into n; r:=r||' | ver_mesas_outro_clube='||n; exception when others then r:=r||' | ver_mesas_outro_clube=ERRO:'||sqlerrm; end;
begin execute $q$update public.profiles set club_id='1aefa5fe-6baf-42ee-a4ec-444ea53904aa' where id='920ec72f-ba38-4ff7-82ac-74558707ba26'$q$; get diagnostics n=row_count; r:=r||' | trocar_meu_clube=ok('||n||' linhas)'; exception when others then r:=r||' | trocar_meu_clube=BLOQUEADO:'||left(sqlerrm,70); end;
begin execute $q$update public.profiles set role='admin' where id='920ec72f-ba38-4ff7-82ac-74558707ba26'$q$; get diagnostics n=row_count; r:=r||' | trocar_meu_role=ok('||n||' linhas)'; exception when others then r:=r||' | trocar_meu_role=BLOQUEADO:'||left(sqlerrm,70); end;
begin execute $q$update public.profiles set full_name=full_name where id='920ec72f-ba38-4ff7-82ac-74558707ba26'$q$; get diagnostics n=row_count; r:=r||' | editar_meu_nome=ok('||n||' linhas)'; exception when others then r:=r||' | editar_meu_nome=BLOQUEADO:'||left(sqlerrm,70); end;
begin execute $q$insert into public.tables(name,club_id) values ('teste-rls','1c300690-e270-4503-afce-c549fbd14f58')$q$; get diagnostics n=row_count; r:=r||' | criar_mesa_no_meu_clube=ok('||n||' linhas)'; exception when others then r:=r||' | criar_mesa_no_meu_clube=BLOQUEADO:'||left(sqlerrm,70); end;
begin execute $q$insert into public.tables(name,club_id) values ('teste-rls','1aefa5fe-6baf-42ee-a4ec-444ea53904aa')$q$; get diagnostics n=row_count; r:=r||' | criar_mesa_em_outro_clube=ok('||n||' linhas)'; exception when others then r:=r||' | criar_mesa_em_outro_clube=BLOQUEADO:'||left(sqlerrm,70); end;
begin execute $q$update public.tables set name=name where club_id='1aefa5fe-6baf-42ee-a4ec-444ea53904aa'$q$; get diagnostics n=row_count; r:=r||' | editar_mesas_outro_clube=ok('||n||' linhas)'; exception when others then r:=r||' | editar_mesas_outro_clube=BLOQUEADO:'||left(sqlerrm,70); end;
begin execute $q$delete from public.transactions where club_id='1aefa5fe-6baf-42ee-a4ec-444ea53904aa'$q$; get diagnostics n=row_count; r:=r||' | apagar_transacoes_outro_clube=ok('||n||' linhas)'; exception when others then r:=r||' | apagar_transacoes_outro_clube=BLOQUEADO:'||left(sqlerrm,70); end;
begin execute $q$update public.clubs set name=name where id='1c300690-e270-4503-afce-c549fbd14f58'$q$; get diagnostics n=row_count; r:=r||' | editar_meu_clube=ok('||n||' linhas)'; exception when others then r:=r||' | editar_meu_clube=BLOQUEADO:'||left(sqlerrm,70); end;
begin execute $q$update public.clubs set name=name where id='1aefa5fe-6baf-42ee-a4ec-444ea53904aa'$q$; get diagnostics n=row_count; r:=r||' | editar_outro_clube=ok('||n||' linhas)'; exception when others then r:=r||' | editar_outro_clube=BLOQUEADO:'||left(sqlerrm,70); end;
begin execute $q$insert into public.clubs(name) values ('clube-falso-rls')$q$; get diagnostics n=row_count; r:=r||' | criar_clube=ok('||n||' linhas)'; exception when others then r:=r||' | criar_clube=BLOQUEADO:'||left(sqlerrm,70); end;
begin execute $q$update public.club_settings set city=city where club_id='1c300690-e270-4503-afce-c549fbd14f58'$q$; get diagnostics n=row_count; r:=r||' | editar_settings_meu=ok('||n||' linhas)'; exception when others then r:=r||' | editar_settings_meu=BLOQUEADO:'||left(sqlerrm,70); end;
begin execute $q$insert into storage.objects(bucket_id,name) values ('logos','1c300690-e270-4503-afce-c549fbd14f58-rlstest.png')$q$; get diagnostics n=row_count; r:=r||' | logo_meu_clube=ok('||n||' linhas)'; exception when others then r:=r||' | logo_meu_clube=BLOQUEADO:'||left(sqlerrm,70); end;
begin execute $q$insert into storage.objects(bucket_id,name) values ('logos','1aefa5fe-6baf-42ee-a4ec-444ea53904aa-rlstest.png')$q$; get diagnostics n=row_count; r:=r||' | logo_outro_clube=ok('||n||' linhas)'; exception when others then r:=r||' | logo_outro_clube=BLOQUEADO:'||left(sqlerrm,70); end;
execute 'reset role';
perform set_config('request.jwt.claims', json_build_object('role','anon')::text, true);
perform set_config('request.jwt.claim.sub','', true);
execute 'set local role anon';
r:=r||' ### VISITANTE SEM LOGIN';
begin execute $q$select count(*) from public.clubs$q$ into n; r:=r||' | clubs='||n; exception when others then r:=r||' | clubs=ERRO:'||sqlerrm; end;
begin execute $q$select count(*) from public.profiles$q$ into n; r:=r||' | profiles='||n; exception when others then r:=r||' | profiles=ERRO:'||sqlerrm; end;
begin execute $q$select count(*) from public.tables$q$ into n; r:=r||' | tables='||n; exception when others then r:=r||' | tables=ERRO:'||sqlerrm; end;
begin execute $q$select count(*) from public.transactions$q$ into n; r:=r||' | transactions='||n; exception when others then r:=r||' | transactions=ERRO:'||sqlerrm; end;
begin execute $q$insert into public.tables(name,club_id) values ('x','1c300690-e270-4503-afce-c549fbd14f58')$q$; get diagnostics n=row_count; r:=r||' | anon_criar_mesa=ok('||n||' linhas)'; exception when others then r:=r||' | anon_criar_mesa=BLOQUEADO:'||left(sqlerrm,70); end;
begin execute $q$insert into storage.objects(bucket_id,name) values ('logos','1c300690-e270-4503-afce-c549fbd14f58-x.png')$q$; get diagnostics n=row_count; r:=r||' | anon_upload_logo=ok('||n||' linhas)'; exception when others then r:=r||' | anon_upload_logo=BLOQUEADO:'||left(sqlerrm,70); end;
execute 'reset role';

raise exception 'SIMULACAO (nada foi gravado): %', r;
end $test$;