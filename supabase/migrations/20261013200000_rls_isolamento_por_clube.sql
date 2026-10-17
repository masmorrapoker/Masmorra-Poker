-- Masmorra Manager — Isolamento real entre clubes (RLS)
-- 2026-10-13
--
-- Antes: todas as tabelas tinham políticas "Allow all operations" (using true),
-- que anulavam as políticas de isolamento por clube e liberavam leitura/escrita
-- de qualquer dado para qualquer pessoa com a chave pública.
--
-- Depois:
--   * visitante não autenticado (anon): sem acesso a nenhuma tabela;
--   * operador autenticado: só enxerga e altera dados do próprio clube;
--   * o operador não consegue trocar o próprio club_id nem role.
-- Rollback: supabase/rollback/20261013200000_rls_isolamento_por_clube.down.sql

-- 1. Função auxiliar: clube do usuário logado ------------------------------
create or replace function public.current_club_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select club_id from public.profiles where id = auth.uid()
$$;

revoke all on function public.current_club_id() from public, anon;
grant execute on function public.current_club_id() to authenticated;

-- 2. Remove todas as políticas antigas ------------------------------------
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

-- 3. Permissões de tabela -------------------------------------------------
-- O site público não lê nada do banco; só usuários logados acessam dados.
revoke all on public.clubs, public.profiles, public.club_settings,
              public.tables, public.players, public.table_players,
              public.transactions
  from anon;

-- TRUNCATE/TRIGGER/REFERENCES ignoram RLS e não são usados pelo app.
revoke truncate, trigger, references
  on public.clubs, public.profiles, public.club_settings,
     public.tables, public.players, public.table_players,
     public.transactions
  from authenticated;

-- Clube e perfil não são criados/apagados pelo app (provisionamento é administrativo).
revoke insert, delete on public.clubs, public.profiles from authenticated;
revoke delete on public.club_settings from authenticated;

-- No perfil, o operador só pode alterar o próprio nome.
revoke update on public.profiles from authenticated;
grant update (full_name) on public.profiles to authenticated;

-- 4. Políticas novas ------------------------------------------------------
alter table public.clubs         enable row level security;
alter table public.profiles      enable row level security;
alter table public.club_settings enable row level security;
alter table public.tables        enable row level security;
alter table public.players       enable row level security;
alter table public.table_players enable row level security;
alter table public.transactions  enable row level security;

-- clubs
create policy "clubs: ler o proprio clube" on public.clubs
  for select to authenticated
  using (id = (select public.current_club_id()));
create policy "clubs: editar o proprio clube" on public.clubs
  for update to authenticated
  using (id = (select public.current_club_id()))
  with check (id = (select public.current_club_id()));

-- profiles
create policy "profiles: ler o proprio perfil" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()));
create policy "profiles: editar o proprio perfil" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- club_settings
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

-- dados operacionais: acesso total, mas só dentro do próprio clube
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

-- 5. Storage: logos -------------------------------------------------------
-- Leitura continua pública (o bucket é público). Upload só por operador logado,
-- e só com nome de arquivo prefixado pelo id do próprio clube
-- (o app já salva como "<club_id>-<timestamp>.<ext>").
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
