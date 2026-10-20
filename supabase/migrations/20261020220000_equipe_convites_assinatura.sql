-- Masmorra Manager — Equipe, convites, painel do administrador e assinatura
-- 2026-10-20
--
-- 1. Papéis na equipe do clube: dono, gerente, caixa.
--    Os usuários atuais ("operator") viram "dono" do seu clube.
-- 2. Administrador da plataforma (quem vende o sistema): cria clubes e
--    controla o vencimento. Só por funções, nunca por acesso direto às tabelas.
-- 3. Assinatura manual: clubs.paid_until. Vencido há mais de 3 dias, o clube
--    fica bloqueado (current_club_id() deixa de devolver o clube, então todas
--    as regras de acesso negam). paid_until nulo = sem vencimento.
-- 4. Convites por link (token): o dono convida gerente/caixa; o administrador
--    convida o dono de um clube novo. Quem abre o link cria a conta e entra.
-- 5. Funções da equipe: listar, mudar papel, remover.
--
-- Rollback: supabase/rollback/20261020220000_equipe_convites_assinatura.down.sql

-- 1. Papéis ---------------------------------------------------------------------------
update public.profiles set role = 'dono' where role is null or role not in ('dono', 'gerente', 'caixa');
alter table public.profiles alter column role set default 'caixa';
alter table public.profiles alter column role set not null;
alter table public.profiles drop constraint if exists profiles_role_valido;
alter table public.profiles add constraint profiles_role_valido check (role in ('dono', 'gerente', 'caixa'));

-- 2. Administrador da plataforma -------------------------------------------------------
create table if not exists public.platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.platform_admins enable row level security;
revoke all on public.platform_admins from anon, authenticated;

insert into public.platform_admins (user_id)
values ('920ec72f-ba38-4ff7-82ac-74558707ba26')
on conflict do nothing;

create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.platform_admins where user_id = auth.uid())
$$;
revoke all on function public.is_platform_admin() from public, anon;
grant execute on function public.is_platform_admin() to authenticated;

-- 3. Assinatura -----------------------------------------------------------------------
alter table public.clubs add column if not exists paid_until date;

-- O clube não pode mudar o próprio vencimento: update só nas colunas de cadastro.
revoke update on public.clubs from authenticated;
grant update (name, logo_url, beer_price, energy_price, marketing_inactive_days,
              marketing_message_template, marketing_club_name)
  on public.clubs to authenticated;

-- Clube bloqueado = vencido há mais de 3 dias.
create or replace function public.club_bloqueado(p_paid_until date)
returns boolean
language sql
stable
as $$
  select p_paid_until is not null and p_paid_until < (now() at time zone 'America/Sao_Paulo')::date - 3
$$;

-- Todas as regras de acesso usam current_club_id(): clube bloqueado não acessa nada.
create or replace function public.current_club_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select p.club_id
  from public.profiles p
  join public.clubs c on c.id = p.club_id
  where p.id = auth.uid()
    and not public.club_bloqueado(c.paid_until)
$$;
revoke all on function public.current_club_id() from public, anon;
grant execute on function public.current_club_id() to authenticated;

create or replace function public.meu_papel()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid() and club_id = public.current_club_id()
$$;
revoke all on function public.meu_papel() from public, anon;
grant execute on function public.meu_papel() to authenticated;

-- O que o app precisa saber ao entrar (funciona mesmo com o clube bloqueado).
create or replace function public.meu_acesso()
returns json
language sql
stable
security definer
set search_path = public
as $$
  select json_build_object(
    'club_id', p.club_id,
    'club_name', c.name,
    'role', p.role,
    'full_name', p.full_name,
    'paid_until', c.paid_until,
    'blocked', public.club_bloqueado(c.paid_until),
    'is_admin', public.is_platform_admin()
  )
  from (select auth.uid() as uid) me
  left join public.profiles p on p.id = me.uid
  left join public.clubs c on c.id = p.club_id
$$;
revoke all on function public.meu_acesso() from public, anon;
grant execute on function public.meu_acesso() to authenticated;

-- 4. Convites -------------------------------------------------------------------------
create table if not exists public.club_invites (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  role text not null check (role in ('dono', 'gerente', 'caixa')),
  token text not null unique default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  label text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days',
  used_at timestamptz,
  used_by uuid references auth.users(id) on delete set null
);
create index if not exists club_invites_club_idx on public.club_invites (club_id, created_at desc);

alter table public.club_invites enable row level security;
revoke all on public.club_invites from anon, authenticated;
grant select, insert, delete on public.club_invites to authenticated;

-- Dono convida qualquer papel; gerente só convida caixa. Caixa não convida.
drop policy if exists "club_invites: ver do proprio clube" on public.club_invites;
create policy "club_invites: ver do proprio clube" on public.club_invites
  for select to authenticated
  using (club_id = (select public.current_club_id()) and (select public.meu_papel()) in ('dono', 'gerente'));

drop policy if exists "club_invites: convidar" on public.club_invites;
create policy "club_invites: convidar" on public.club_invites
  for insert to authenticated
  with check (
    club_id = (select public.current_club_id())
    and used_at is null and used_by is null
    and (
      (select public.meu_papel()) = 'dono'
      or ((select public.meu_papel()) = 'gerente' and role = 'caixa')
    )
  );

drop policy if exists "club_invites: cancelar" on public.club_invites;
create policy "club_invites: cancelar" on public.club_invites
  for delete to authenticated
  using (
    club_id = (select public.current_club_id())
    and used_at is null
    and (
      (select public.meu_papel()) = 'dono'
      or ((select public.meu_papel()) = 'gerente' and role = 'caixa')
    )
  );

-- Informações públicas do convite (para a tela de convite, antes do login).
create or replace function public.ver_convite(p_token text)
returns json
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select json_build_object(
       'club_name', c.name,
       'role', i.role,
       'valid', i.used_at is null and i.expires_at > now(),
       'reason', case when i.used_at is not null then 'usado' when i.expires_at <= now() then 'expirado' end
     )
     from public.club_invites i
     join public.clubs c on c.id = i.club_id
     where i.token = p_token),
    json_build_object('valid', false, 'reason', 'inexistente')
  )
$$;
revoke all on function public.ver_convite(text) from public;
grant execute on function public.ver_convite(text) to anon, authenticated;

-- Aceita o convite com a conta logada.
create or replace function public.aceitar_convite(p_token text, p_nome text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_inv public.club_invites%rowtype;
  v_atual uuid;
begin
  if v_uid is null then
    raise exception 'Faça login para aceitar o convite.' using errcode = '28000';
  end if;

  select * into v_inv from public.club_invites where token = p_token for update;
  if not found then
    raise exception 'Convite não encontrado.' using errcode = 'P0002';
  end if;
  if v_inv.used_at is not null then
    raise exception 'Este convite já foi usado.' using errcode = 'P0001';
  end if;
  if v_inv.expires_at <= now() then
    raise exception 'Este convite expirou. Peça um novo.' using errcode = 'P0001';
  end if;

  select club_id into v_atual from public.profiles where id = v_uid;
  if v_atual is not null and v_atual <> v_inv.club_id then
    raise exception 'Esta conta já faz parte de outro clube. Use outro e-mail.' using errcode = 'P0001';
  end if;

  insert into public.profiles (id, club_id, role, full_name)
  values (v_uid, v_inv.club_id, v_inv.role, nullif(trim(p_nome), ''))
  on conflict (id) do update
    set club_id = excluded.club_id,
        role = excluded.role,
        full_name = coalesce(excluded.full_name, public.profiles.full_name);

  update public.club_invites set used_at = now(), used_by = v_uid where id = v_inv.id;
  return v_inv.club_id;
end;
$$;
revoke all on function public.aceitar_convite(text, text) from public, anon;
grant execute on function public.aceitar_convite(text, text) to authenticated;

-- 5. Equipe ---------------------------------------------------------------------------
create or replace function public.equipe_listar()
returns table (user_id uuid, full_name text, email text, role text, created_at timestamptz, is_me boolean)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.full_name, u.email::text, p.role, p.created_at, p.id = auth.uid()
  from public.profiles p
  join auth.users u on u.id = p.id
  where p.club_id = public.current_club_id()
  order by case p.role when 'dono' then 0 when 'gerente' then 1 else 2 end, p.created_at
$$;
revoke all on function public.equipe_listar() from public, anon;
grant execute on function public.equipe_listar() to authenticated;

create or replace function public.equipe_alterar_papel(p_user uuid, p_role text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_club uuid := public.current_club_id();
begin
  if public.meu_papel() is distinct from 'dono' then
    raise exception 'Só o dono pode mudar papéis.' using errcode = '42501';
  end if;
  if p_role not in ('dono', 'gerente', 'caixa') then
    raise exception 'Papel inválido.' using errcode = '22023';
  end if;
  if p_user = auth.uid() and p_role <> 'dono'
     and (select count(*) from public.profiles where club_id = v_club and role = 'dono') <= 1 then
    raise exception 'O clube precisa de pelo menos um dono.' using errcode = 'P0001';
  end if;
  update public.profiles set role = p_role where id = p_user and club_id = v_club;
  if not found then
    raise exception 'Pessoa não encontrada na equipe.' using errcode = 'P0002';
  end if;
end;
$$;
revoke all on function public.equipe_alterar_papel(uuid, text) from public, anon;
grant execute on function public.equipe_alterar_papel(uuid, text) to authenticated;

create or replace function public.equipe_remover(p_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_club uuid := public.current_club_id();
  v_eu text := public.meu_papel();
  v_alvo text;
begin
  if p_user = auth.uid() then
    raise exception 'Você não pode remover a si mesmo.' using errcode = 'P0001';
  end if;
  select role into v_alvo from public.profiles where id = p_user and club_id = v_club;
  if v_alvo is null then
    raise exception 'Pessoa não encontrada na equipe.' using errcode = 'P0002';
  end if;
  if not (v_eu = 'dono' or (v_eu = 'gerente' and v_alvo = 'caixa')) then
    raise exception 'Sem permissão para remover esta pessoa.' using errcode = '42501';
  end if;
  delete from public.profiles where id = p_user and club_id = v_club;
end;
$$;
revoke all on function public.equipe_remover(uuid) from public, anon;
grant execute on function public.equipe_remover(uuid) to authenticated;

-- 6. Painel do administrador da plataforma --------------------------------------------
create or replace function public.admin_listar_clubes()
returns table (
  id uuid, name text, created_at timestamptz, paid_until date, blocked boolean,
  members bigint, owners text, tables bigint, last_table timestamptz, pending_invites bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Acesso restrito ao administrador.' using errcode = '42501';
  end if;
  return query
  select c.id, c.name, c.created_at, c.paid_until, public.club_bloqueado(c.paid_until),
         (select count(*) from public.profiles p where p.club_id = c.id),
         (select string_agg(coalesce(p.full_name, u.email::text), ', ')
            from public.profiles p join auth.users u on u.id = p.id
           where p.club_id = c.id and p.role = 'dono'),
         (select count(*) from public.tables t where t.club_id = c.id),
         (select max(t.created_at) from public.tables t where t.club_id = c.id),
         (select count(*) from public.club_invites i where i.club_id = c.id and i.used_at is null and i.expires_at > now())
  from public.clubs c
  order by c.created_at desc;
end;
$$;
revoke all on function public.admin_listar_clubes() from public, anon;
grant execute on function public.admin_listar_clubes() to authenticated;

create or replace function public.admin_criar_clube(p_nome text, p_paid_until date default null)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_club uuid;
  v_token text;
begin
  if not public.is_platform_admin() then
    raise exception 'Acesso restrito ao administrador.' using errcode = '42501';
  end if;
  if coalesce(trim(p_nome), '') = '' then
    raise exception 'Informe o nome do clube.' using errcode = '22023';
  end if;
  insert into public.clubs (name, paid_until) values (trim(p_nome), p_paid_until) returning id into v_club;
  insert into public.club_settings (club_id, welcome_message) values (v_club, 'Bem-vindo ao ' || trim(p_nome))
  on conflict do nothing;
  insert into public.club_invites (club_id, role, label, expires_at)
  values (v_club, 'dono', 'Dono', now() + interval '30 days')
  returning token into v_token;
  return json_build_object('club_id', v_club, 'token', v_token);
end;
$$;
revoke all on function public.admin_criar_clube(text, date) from public, anon;
grant execute on function public.admin_criar_clube(text, date) to authenticated;

create or replace function public.admin_novo_convite(p_club uuid, p_role text default 'dono')
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token text;
begin
  if not public.is_platform_admin() then
    raise exception 'Acesso restrito ao administrador.' using errcode = '42501';
  end if;
  insert into public.club_invites (club_id, role, label, expires_at)
  values (p_club, p_role, initcap(p_role), now() + interval '30 days')
  returning token into v_token;
  return v_token;
end;
$$;
revoke all on function public.admin_novo_convite(uuid, text) from public, anon;
grant execute on function public.admin_novo_convite(uuid, text) to authenticated;

create or replace function public.admin_definir_vencimento(p_club uuid, p_paid_until date)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Acesso restrito ao administrador.' using errcode = '42501';
  end if;
  update public.clubs set paid_until = p_paid_until where id = p_club;
end;
$$;
revoke all on function public.admin_definir_vencimento(uuid, date) from public, anon;
grant execute on function public.admin_definir_vencimento(uuid, date) to authenticated;
