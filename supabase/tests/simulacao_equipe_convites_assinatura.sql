-- SIMULAÇÃO: migração equipe_convites_assinatura, com testes.
-- Seguro: desfaz tudo no final (o erro vermelho é proposital e traz o resultado).
-- Cria usuários de mentira só dentro da simulação (somem no fim).

do $test$
declare r text := ''; n bigint; v text; tk text; tk2 text; tk3 text; cid uuid; j json;
begin

update public.profiles set role = 'dono' where role is null or role not in ('dono', 'gerente', 'caixa');
alter table public.profiles alter column role set default 'caixa';
alter table public.profiles alter column role set not null;
alter table public.profiles drop constraint if exists profiles_role_valido;
alter table public.profiles add constraint profiles_role_valido check (role in ('dono', 'gerente', 'caixa'));

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

alter table public.clubs add column if not exists paid_until date;

revoke update on public.clubs from authenticated;
grant update (name, logo_url, beer_price, energy_price, marketing_inactive_days,
              marketing_message_template, marketing_club_name)
  on public.clubs to authenticated;

create or replace function public.club_bloqueado(p_paid_until date)
returns boolean
language sql
stable
as $$
  select p_paid_until is not null and p_paid_until < (now() at time zone 'America/Sao_Paulo')::date - 3
$$;

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
r:=r||' ### DADOS ATUAIS';
begin execute $q$select string_agg(role||':'||c, ', ') from (select role, count(*) c from public.profiles group by role) x$q$ into v; r:=r||' | papeis='||coalesce(v,'nulo'); exception when others then r:=r||' | papeis=ERRO:'||left(sqlerrm,90); end;
insert into auth.users (id, email) values ('00000000-0000-4000-8000-0000000000d1','dono.sim@exemplo.com'),('00000000-0000-4000-8000-0000000000c1','caixa.sim@exemplo.com'),('00000000-0000-4000-8000-0000000000e1','gerente.sim@exemplo.com');
r:=r||' ### VOCE (admin)';
execute 'reset role'; perform set_config('request.jwt.claims', json_build_object('sub','920ec72f-ba38-4ff7-82ac-74558707ba26','role','authenticated')::text, true); perform set_config('request.jwt.claim.sub','920ec72f-ba38-4ff7-82ac-74558707ba26', true); execute 'set local role authenticated';
begin execute $q$select (meu_acesso()->>'role')||' admin='||(meu_acesso()->>'is_admin')$q$ into v; r:=r||' | meu_acesso='||coalesce(v,'nulo'); exception when others then r:=r||' | meu_acesso=ERRO:'||left(sqlerrm,90); end;
begin j := admin_criar_clube('Clube Simulacao'); tk := j->>'token'; cid := (j->>'club_id')::uuid; r:=r||' | criar_clube=ok'; exception when others then r:=r||' | criar_clube=ERRO:'||left(sqlerrm,90); end;
begin execute $q$select count(*)::text from admin_listar_clubes()$q$ into v; r:=r||' | listar_clubes='||coalesce(v,'nulo'); exception when others then r:=r||' | listar_clubes=ERRO:'||left(sqlerrm,90); end;
begin execute $q$select count(*)::text from public.tables$q$ into v; r:=r||' | mesas_masmorra_que_voce_ve='||coalesce(v,'nulo'); exception when others then r:=r||' | mesas_masmorra_que_voce_ve=ERRO:'||left(sqlerrm,90); end;
r:=r||' ### CONVITE DO DONO';
execute 'reset role'; execute 'set local role anon';
begin v := ver_convite(tk)::text; r:=r||' | ver_convite_sem_login='||v; exception when others then r:=r||' | ver_convite_sem_login=ERRO:'||left(sqlerrm,90); end;
execute 'reset role'; perform set_config('request.jwt.claims', json_build_object('sub','00000000-0000-4000-8000-0000000000d1','role','authenticated')::text, true); perform set_config('request.jwt.claim.sub','00000000-0000-4000-8000-0000000000d1', true); execute 'set local role authenticated';
begin perform aceitar_convite(tk, 'Dono Teste'); r:=r||' | dono_aceitou=ok'; exception when others then r:=r||' | dono_aceitou=ERRO:'||left(sqlerrm,90); end;
begin execute $q$select (meu_acesso()->>'club_name')||' / '||(meu_acesso()->>'role')$q$ into v; r:=r||' | dono_meu_acesso='||coalesce(v,'nulo'); exception when others then r:=r||' | dono_meu_acesso=ERRO:'||left(sqlerrm,90); end;
begin execute $q$select count(*)::text from public.tables where club_id='1c300690-e270-4503-afce-c549fbd14f58'$q$ into v; r:=r||' | dono_ve_mesas_masmorra='||coalesce(v,'nulo'); exception when others then r:=r||' | dono_ve_mesas_masmorra=ERRO:'||left(sqlerrm,90); end;
begin execute $q$insert into public.tables(name, club_id) values ('Mesa sim', (select id from public.clubs where name='Clube Simulacao'))$q$; get diagnostics n=row_count; r:=r||' | dono_abre_mesa=ok('||n||')'; exception when others then r:=r||' | dono_abre_mesa=BLOQUEADO:'||left(sqlerrm,90); end;
begin execute $q$update public.clubs set paid_until = '2099-01-01'$q$; get diagnostics n=row_count; r:=r||' | dono_muda_proprio_vencimento(deve bloquear)=ok('||n||')'; exception when others then r:=r||' | dono_muda_proprio_vencimento(deve bloquear)=BLOQUEADO:'||left(sqlerrm,90); end;
begin execute $q$select admin_listar_clubes()$q$; get diagnostics n=row_count; r:=r||' | dono_usa_admin(deve bloquear)=ok('||n||')'; exception when others then r:=r||' | dono_usa_admin(deve bloquear)=BLOQUEADO:'||left(sqlerrm,90); end;
begin insert into public.club_invites(club_id, role, label) values (cid, 'caixa', 'Caixa') returning token into tk2; r:=r||' | dono_convida_caixa=ok'; exception when others then r:=r||' | dono_convida_caixa=ERRO:'||left(sqlerrm,90); end;
begin insert into public.club_invites(club_id, role, label) values (cid, 'gerente', 'Gerente') returning token into tk3; r:=r||' | dono_convida_gerente=ok'; exception when others then r:=r||' | dono_convida_gerente=ERRO:'||left(sqlerrm,90); end;
begin execute $q$insert into public.club_invites(club_id, role) values ('1c300690-e270-4503-afce-c549fbd14f58', 'dono')$q$; get diagnostics n=row_count; r:=r||' | convidar_para_masmorra(deve bloquear)=ok('||n||')'; exception when others then r:=r||' | convidar_para_masmorra(deve bloquear)=BLOQUEADO:'||left(sqlerrm,90); end;
r:=r||' ### CAIXA E GERENTE';
execute 'reset role'; perform set_config('request.jwt.claims', json_build_object('sub','00000000-0000-4000-8000-0000000000c1','role','authenticated')::text, true); perform set_config('request.jwt.claim.sub','00000000-0000-4000-8000-0000000000c1', true); execute 'set local role authenticated';
begin perform aceitar_convite(tk2, 'Caixa Teste'); r:=r||' | caixa_aceitou=ok'; exception when others then r:=r||' | caixa_aceitou=ERRO:'||left(sqlerrm,90); end;
begin perform aceitar_convite(tk2, 'De novo'); r:=r||' | reusar_convite=ok'; exception when others then r:=r||' | reusar_convite(deve bloquear)=BLOQUEADO:'||left(sqlerrm,60); end;
begin execute $q$select meu_papel()$q$ into v; r:=r||' | caixa_papel='||coalesce(v,'nulo'); exception when others then r:=r||' | caixa_papel=ERRO:'||left(sqlerrm,90); end;
begin execute $q$select count(*)::text from public.tables$q$ into v; r:=r||' | caixa_ve_mesas_do_clube='||coalesce(v,'nulo'); exception when others then r:=r||' | caixa_ve_mesas_do_clube=ERRO:'||left(sqlerrm,90); end;
begin execute $q$insert into public.club_invites(club_id, role) values ((select id from public.clubs where name='Clube Simulacao'), 'caixa')$q$; get diagnostics n=row_count; r:=r||' | caixa_convida(deve bloquear)=ok('||n||')'; exception when others then r:=r||' | caixa_convida(deve bloquear)=BLOQUEADO:'||left(sqlerrm,90); end;
begin perform equipe_remover('00000000-0000-4000-8000-0000000000d1'); r:=r||' | caixa_remove_dono=ok'; exception when others then r:=r||' | caixa_remove_dono(deve bloquear)=BLOQUEADO:'||left(sqlerrm,60); end;
execute 'reset role'; perform set_config('request.jwt.claims', json_build_object('sub','00000000-0000-4000-8000-0000000000e1','role','authenticated')::text, true); perform set_config('request.jwt.claim.sub','00000000-0000-4000-8000-0000000000e1', true); execute 'set local role authenticated';
begin perform aceitar_convite(tk3, 'Gerente Teste'); r:=r||' | gerente_aceitou=ok'; exception when others then r:=r||' | gerente_aceitou=ERRO:'||left(sqlerrm,90); end;
begin execute $q$insert into public.club_invites(club_id, role) values ((select id from public.clubs where name='Clube Simulacao'), 'dono')$q$; get diagnostics n=row_count; r:=r||' | gerente_convida_dono(deve bloquear)=ok('||n||')'; exception when others then r:=r||' | gerente_convida_dono(deve bloquear)=BLOQUEADO:'||left(sqlerrm,90); end;
begin perform equipe_alterar_papel('00000000-0000-4000-8000-0000000000c1', 'gerente'); r:=r||' | gerente_muda_papel=ok'; exception when others then r:=r||' | gerente_muda_papel(deve bloquear)=BLOQUEADO:'||left(sqlerrm,60); end;
execute 'reset role'; perform set_config('request.jwt.claims', json_build_object('sub','00000000-0000-4000-8000-0000000000d1','role','authenticated')::text, true); perform set_config('request.jwt.claim.sub','00000000-0000-4000-8000-0000000000d1', true); execute 'set local role authenticated';
begin execute $q$select string_agg(role, ',') from equipe_listar()$q$ into v; r:=r||' | dono_lista_equipe='||coalesce(v,'nulo'); exception when others then r:=r||' | dono_lista_equipe=ERRO:'||left(sqlerrm,90); end;
begin perform equipe_alterar_papel('00000000-0000-4000-8000-0000000000c1', 'gerente'); r:=r||' | dono_promove_caixa=ok'; exception when others then r:=r||' | dono_promove_caixa=ERRO:'||left(sqlerrm,90); end;
begin perform equipe_alterar_papel('00000000-0000-4000-8000-0000000000d1', 'caixa'); r:=r||' | ultimo_dono_se_rebaixa=ok'; exception when others then r:=r||' | ultimo_dono_se_rebaixa(deve bloquear)=BLOQUEADO:'||left(sqlerrm,60); end;
begin perform equipe_remover('00000000-0000-4000-8000-0000000000e1'); r:=r||' | dono_remove_gerente=ok'; exception when others then r:=r||' | dono_remove_gerente=ERRO:'||left(sqlerrm,90); end;
r:=r||' ### VENCIMENTO';
execute 'reset role'; perform set_config('request.jwt.claims', json_build_object('sub','920ec72f-ba38-4ff7-82ac-74558707ba26','role','authenticated')::text, true); perform set_config('request.jwt.claim.sub','920ec72f-ba38-4ff7-82ac-74558707ba26', true); execute 'set local role authenticated';
begin perform admin_definir_vencimento(cid, current_date - 10); r:=r||' | vencer_ha_10_dias=ok'; exception when others then r:=r||' | vencer_ha_10_dias=ERRO:'||left(sqlerrm,90); end;
execute 'reset role'; perform set_config('request.jwt.claims', json_build_object('sub','00000000-0000-4000-8000-0000000000d1','role','authenticated')::text, true); perform set_config('request.jwt.claim.sub','00000000-0000-4000-8000-0000000000d1', true); execute 'set local role authenticated';
begin execute $q$select meu_acesso()->>'blocked'$q$ into v; r:=r||' | bloqueado='||coalesce(v,'nulo'); exception when others then r:=r||' | bloqueado=ERRO:'||left(sqlerrm,90); end;
begin execute $q$select count(*)::text from public.tables$q$ into v; r:=r||' | dono_ve_mesas_bloqueado(esperado 0)='||coalesce(v,'nulo'); exception when others then r:=r||' | dono_ve_mesas_bloqueado(esperado 0)=ERRO:'||left(sqlerrm,90); end;
begin execute $q$insert into public.tables(name, club_id) values ('Mesa sim 2', (select id from public.clubs where name='Clube Simulacao'))$q$; get diagnostics n=row_count; r:=r||' | dono_abre_mesa_bloqueado(deve bloquear)=ok('||n||')'; exception when others then r:=r||' | dono_abre_mesa_bloqueado(deve bloquear)=BLOQUEADO:'||left(sqlerrm,90); end;
execute 'reset role'; perform set_config('request.jwt.claims', json_build_object('sub','920ec72f-ba38-4ff7-82ac-74558707ba26','role','authenticated')::text, true); perform set_config('request.jwt.claim.sub','920ec72f-ba38-4ff7-82ac-74558707ba26', true); execute 'set local role authenticated';
perform admin_definir_vencimento(cid, current_date - 2);
execute 'reset role'; perform set_config('request.jwt.claims', json_build_object('sub','00000000-0000-4000-8000-0000000000d1','role','authenticated')::text, true); perform set_config('request.jwt.claim.sub','00000000-0000-4000-8000-0000000000d1', true); execute 'set local role authenticated';
begin execute $q$select count(*)::text from public.tables$q$ into v; r:=r||' | vencido_ha_2_dias_ainda_acessa(esperado 1)='||coalesce(v,'nulo'); exception when others then r:=r||' | vencido_ha_2_dias_ainda_acessa(esperado 1)=ERRO:'||left(sqlerrm,90); end;
execute 'reset role'; perform set_config('request.jwt.claims', json_build_object('sub','920ec72f-ba38-4ff7-82ac-74558707ba26','role','authenticated')::text, true); perform set_config('request.jwt.claim.sub','920ec72f-ba38-4ff7-82ac-74558707ba26', true); execute 'set local role authenticated';
begin execute $q$select count(*)::text from public.tables$q$ into v; r:=r||' | masmorra_continua(esperado 9)='||coalesce(v,'nulo'); exception when others then r:=r||' | masmorra_continua(esperado 9)=ERRO:'||left(sqlerrm,90); end;
execute 'reset role';
begin execute $q$select count(*)::text from public.transactions where club_id='1c300690-e270-4503-afce-c549fbd14f58'$q$ into v; r:=r||' | lancamentos_masmorra='||coalesce(v,'nulo'); exception when others then r:=r||' | lancamentos_masmorra=ERRO:'||left(sqlerrm,90); end;
raise exception 'SIMULACAO (nada foi gravado): %', r;
end $test$;
