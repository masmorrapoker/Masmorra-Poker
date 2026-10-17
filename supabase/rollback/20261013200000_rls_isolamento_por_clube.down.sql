-- ROLLBACK de 20261013200000_rls_isolamento_por_clube.sql
-- Restaura exatamente as políticas e permissões que existiam em 13/10/2026.
-- ATENÇÃO: isso reabre o acesso total aos dados. Use só em emergência.

drop policy if exists "clubs: ler o proprio clube"             on public.clubs;
drop policy if exists "clubs: editar o proprio clube"          on public.clubs;
drop policy if exists "profiles: ler o proprio perfil"         on public.profiles;
drop policy if exists "profiles: editar o proprio perfil"      on public.profiles;
drop policy if exists "club_settings: ler do proprio clube"    on public.club_settings;
drop policy if exists "club_settings: criar do proprio clube"  on public.club_settings;
drop policy if exists "club_settings: editar do proprio clube" on public.club_settings;
drop policy if exists "tables: proprio clube"                  on public.tables;
drop policy if exists "players: proprio clube"                 on public.players;
drop policy if exists "table_players: proprio clube"           on public.table_players;
drop policy if exists "transactions: proprio clube"            on public.transactions;
drop policy if exists "logos: upload do proprio clube"         on storage.objects;
drop policy if exists "logos: atualizar do proprio clube"      on storage.objects;

grant all on public.clubs, public.profiles, public.club_settings,
             public.tables, public.players, public.table_players,
             public.transactions
  to anon, authenticated;

create policy "Allow all operations for clubs" on public.clubs for all using (true) with check (true);
create policy "Allow all operations for profiles" on public.profiles for all using (true) with check (true);
create policy "Users can read own profile" on public.profiles for select using (auth.uid() = id);
create policy "Allow all operations for club_settings" on public.club_settings for all using (true) with check (true);
create policy "Allow all operations for tables" on public.tables for all using (true) with check (true);
create policy "Club isolation tables" on public.tables for all using (club_id = (select profiles.club_id from profiles where profiles.id = auth.uid()));
create policy "Allow all operations for players" on public.players for all using (true) with check (true);
create policy "Club isolation players" on public.players for all using (club_id = (select profiles.club_id from profiles where profiles.id = auth.uid()));
create policy "Allow all operations for table_players" on public.table_players for all using (true) with check (true);
create policy "Club isolation table players" on public.table_players for all using (club_id = (select profiles.club_id from profiles where profiles.id = auth.uid()));
create policy "Allow all operations for transactions" on public.transactions for all using (true) with check (true);
create policy "Club isolation transactions" on public.transactions for all using (club_id = (select profiles.club_id from profiles where profiles.id = auth.uid()));
create policy "Allow public upload to logos" on storage.objects for insert with check (bucket_id = 'logos');

drop function if exists public.current_club_id();
