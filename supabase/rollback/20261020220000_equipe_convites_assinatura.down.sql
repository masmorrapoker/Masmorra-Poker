-- Desfaz 20261020220000_equipe_convites_assinatura.
-- Os papéis ficam como estão (dono/gerente/caixa); só a regra de validação sai.

drop function if exists public.admin_definir_vencimento(uuid, date);
drop function if exists public.admin_novo_convite(uuid, text);
drop function if exists public.admin_criar_clube(text, date);
drop function if exists public.admin_listar_clubes();
drop function if exists public.equipe_remover(uuid);
drop function if exists public.equipe_alterar_papel(uuid, text);
drop function if exists public.equipe_listar();
drop function if exists public.aceitar_convite(text, text);
drop function if exists public.ver_convite(text);
drop table if exists public.club_invites;
drop function if exists public.meu_acesso();
drop function if exists public.meu_papel();

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

drop function if exists public.club_bloqueado(date);
grant update on public.clubs to authenticated;
alter table public.clubs drop column if exists paid_until;

drop function if exists public.is_platform_admin();
drop table if exists public.platform_admins;

alter table public.profiles drop constraint if exists profiles_role_valido;
alter table public.profiles alter column role drop not null;
alter table public.profiles alter column role set default 'operator';
