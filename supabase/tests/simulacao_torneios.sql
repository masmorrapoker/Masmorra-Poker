-- SIMULAÇÃO: migração torneios, com testes. Seguro: desfaz tudo no final (o erro vermelho é proposital).

do $test$
declare r text := ''; n bigint; v text; tid uuid; eid uuid; tok text; antes numeric;
begin

create table if not exists public.tournaments (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  status text not null default 'agendado' check (status in ('agendado', 'em_andamento', 'encerrado')),
  scheduled_at timestamptz,
  started_at timestamptz,
  finished_at timestamptz,
  config jsonb not null default '{}'::jsonb,
  clock_level int not null default 0 check (clock_level >= 0),
  clock_running boolean not null default false,
  clock_ends_at timestamptz,
  clock_remaining int check (clock_remaining is null or clock_remaining >= 0),
  tv_token text not null unique default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists tournaments_club_idx on public.tournaments (club_id, created_at desc);

create table if not exists public.tournament_entries (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  club_id uuid not null references public.clubs(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete restrict,
  name text not null,
  created_at timestamptz not null default now(),
  eliminated_at timestamptz,
  position int check (position is null or position > 0),
  constraint tournament_entries_um_por_jogador unique (tournament_id, player_id)
);
create index if not exists tournament_entries_t_idx on public.tournament_entries (tournament_id);

create table if not exists public.tournament_movements (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  club_id uuid not null references public.clubs(id) on delete cascade,
  entry_id uuid not null references public.tournament_entries(id) on delete cascade,
  kind text not null check (kind in ('buyin', 'rebuy', 'addon', 'bonus', 'premio', 'extra')),
  label text,
  amount numeric not null default 0 check (amount >= 0),
  to_prize numeric not null default 0 check (to_prize >= 0),
  chips int not null default 0 check (chips >= 0),
  payment_method text check (payment_method in ('dinheiro', 'pix', 'cartao', 'fiado')),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  constraint tournament_movements_premio_sem_fiado check (not (kind in ('premio', 'extra') and payment_method = 'fiado')),
  constraint tournament_movements_premio_nao_vai_ao_prize check (kind in ('buyin', 'rebuy', 'addon') or to_prize = 0),
  constraint tournament_movements_parte_do_premio check (to_prize <= amount)
);
create index if not exists tournament_movements_t_idx on public.tournament_movements (tournament_id, created_at desc);

alter table public.tournaments enable row level security;
alter table public.tournament_entries enable row level security;
alter table public.tournament_movements enable row level security;

revoke all on public.tournaments, public.tournament_entries, public.tournament_movements from anon;
revoke all on public.tournaments, public.tournament_entries, public.tournament_movements from authenticated;
grant select, insert, update, delete on public.tournaments to authenticated;
grant select, insert, update, delete on public.tournament_entries to authenticated;
grant select, insert, delete on public.tournament_movements to authenticated;
revoke update on public.tournaments from authenticated;
grant update (name, status, scheduled_at, started_at, finished_at, config) on public.tournaments to authenticated;

drop policy if exists "tournaments: do proprio clube" on public.tournaments;
create policy "tournaments: do proprio clube" on public.tournaments
  for all to authenticated
  using (club_id = (select public.current_club_id()))
  with check (club_id = (select public.current_club_id()));

drop policy if exists "tournament_entries: do proprio clube" on public.tournament_entries;
create policy "tournament_entries: do proprio clube" on public.tournament_entries
  for all to authenticated
  using (club_id = (select public.current_club_id()))
  with check (
    club_id = (select public.current_club_id())
    and exists (select 1 from public.tournaments t where t.id = tournament_entries.tournament_id and t.club_id = tournament_entries.club_id)
    and exists (select 1 from public.players p where p.id = tournament_entries.player_id and p.club_id = tournament_entries.club_id)
  );

drop policy if exists "tournament_movements: do proprio clube" on public.tournament_movements;
create policy "tournament_movements: do proprio clube" on public.tournament_movements
  for all to authenticated
  using (club_id = (select public.current_club_id()))
  with check (
    club_id = (select public.current_club_id())
    and exists (
      select 1 from public.tournament_entries e
      where e.id = tournament_movements.entry_id
        and e.tournament_id = tournament_movements.tournament_id
        and e.club_id = tournament_movements.club_id
    )
  );

create or replace function public.torneio_relogio(p_tournament uuid, p_level int, p_running boolean, p_remaining int)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_level < 0 or p_remaining < 0 then
    raise exception 'Relógio inválido.' using errcode = '22023';
  end if;
  update public.tournaments
     set clock_level = p_level,
         clock_running = p_running,
         clock_remaining = case when p_running then null else p_remaining end,
         clock_ends_at = case when p_running then now() + make_interval(secs => p_remaining) else null end,
         status = case when status = 'agendado' and p_running then 'em_andamento' else status end,
         started_at = case when started_at is null and p_running then now() else started_at end
   where id = p_tournament
     and club_id = public.current_club_id();
  if not found then
    raise exception 'Torneio não encontrado.' using errcode = 'P0002';
  end if;
  return now();
end;
$$;
revoke all on function public.torneio_relogio(uuid, int, boolean, int) from public, anon;
grant execute on function public.torneio_relogio(uuid, int, boolean, int) to authenticated;

create or replace function public.agora()
returns timestamptz
language sql
stable
as $$ select now() $$;
grant execute on function public.agora() to anon, authenticated;

create or replace function public.torneio_tv(p_token text)
returns json
language sql
stable
security definer
set search_path = public
as $$
  select json_build_object(
    'now', now(),
    'club', json_build_object('name', c.name, 'logo_url', c.logo_url),
    'tournament', json_build_object(
      'id', t.id, 'name', t.name, 'status', t.status, 'config', t.config,
      'clock_level', t.clock_level, 'clock_running', t.clock_running,
      'clock_ends_at', t.clock_ends_at, 'clock_remaining', t.clock_remaining,
      'started_at', t.started_at, 'scheduled_at', t.scheduled_at
    ),
    'entries', coalesce((
      select json_agg(json_build_object('id', e.id, 'name', e.name, 'eliminated_at', e.eliminated_at, 'position', e.position) order by e.created_at)
      from public.tournament_entries e where e.tournament_id = t.id
    ), '[]'::json),
    'movements', coalesce((
      select json_agg(json_build_object('id', m.id, 'entry_id', m.entry_id, 'kind', m.kind, 'label', m.label,
                                        'amount', m.amount, 'to_prize', m.to_prize, 'chips', m.chips, 'created_at', m.created_at)
                      order by m.created_at)
      from public.tournament_movements m where m.tournament_id = t.id
    ), '[]'::json)
  )
  from public.tournaments t
  join public.clubs c on c.id = t.club_id
  where t.tv_token = p_token
    and not public.club_bloqueado(c.paid_until)
$$;
revoke all on function public.torneio_tv(text) from public;
grant execute on function public.torneio_tv(text) to anon, authenticated;

create or replace view public.fiado_saldos
with (security_invoker = true) as
select
  p.club_id,
  p.id as player_id,
  p.name,
  p.phone,
  coalesce(d.devido, 0) as devido,
  coalesce(s.pago, 0) as pago,
  coalesce(d.devido, 0) - coalesce(s.pago, 0) as saldo,
  greatest(d.ultimo_fiado, s.ultimo_pagamento) as ultima_movimentacao
from public.players p
left join (
  select player_id, sum(valor) as devido, max(quando) as ultimo_fiado
  from (
    select tp.player_id,
           case when x.type = 'cash_out' then x.fiado_amount else x.amount end as valor,
           x.created_at as quando
    from public.transactions x
    join public.table_players tp on tp.id = x.player_id
    where (x.payment_method = 'fiado' and x.type in ('buy_in', 'consumo'))
       or (x.type = 'cash_out' and x.fiado_amount > 0)
    union all
    select e.player_id, m.amount, m.created_at
    from public.tournament_movements m
    join public.tournament_entries e on e.id = m.entry_id
    where m.payment_method = 'fiado' and m.kind in ('buyin', 'rebuy', 'addon')
  ) f
  group by player_id
) d on d.player_id = p.id
left join (
  select player_id, sum(amount) as pago, max(created_at) as ultimo_pagamento
  from public.debt_settlements
  group by player_id
) s on s.player_id = p.id
where coalesce(d.devido, 0) > 0 or coalesce(s.pago, 0) > 0;

revoke all on public.fiado_saldos from anon;
grant select on public.fiado_saldos to authenticated;

do $$
begin
  alter publication supabase_realtime add table public.tournaments, public.tournament_entries, public.tournament_movements;
exception when others then
  raise notice 'Realtime não configurado: %', sqlerrm;
end $$;
execute 'reset role'; perform set_config('request.jwt.claims', json_build_object('sub','920ec72f-ba38-4ff7-82ac-74558707ba26','role','authenticated')::text, true); perform set_config('request.jwt.claim.sub','920ec72f-ba38-4ff7-82ac-74558707ba26', true); execute 'set local role authenticated';
execute $q$select coalesce((select saldo from public.fiado_saldos where player_id=(select id from public.players where club_id='1c300690-e270-4503-afce-c549fbd14f58' order by created_at limit 1)),0)::text$q$ into v; antes := v::numeric;
r:=r||' ### TORNEIO SIMULADO (seu operador)';
begin insert into public.tournaments(club_id, name, config) values ('1c300690-e270-4503-afce-c549fbd14f58', 'Torneio Sim', '{"gtd": 8000}') returning id, tv_token into tid, tok; r:=r||' | criar_torneio=ok'; exception when others then r:=r||' | criar_torneio=ERRO:'||left(sqlerrm,80); end;
begin insert into public.tournament_entries(tournament_id, club_id, player_id, name) select tid, '1c300690-e270-4503-afce-c549fbd14f58', id, name from public.players where id=(select id from public.players where club_id='1c300690-e270-4503-afce-c549fbd14f58' order by created_at limit 1) returning id into eid; r:=r||' | inscrever_jogador=ok'; exception when others then r:=r||' | inscrever_jogador=ERRO:'||left(sqlerrm,80); end;
begin insert into public.tournament_entries(tournament_id, club_id, player_id, name) select tid, '1c300690-e270-4503-afce-c549fbd14f58', id, name from public.players where id=(select id from public.players where club_id='1c300690-e270-4503-afce-c549fbd14f58' order by created_at limit 1); r:=r||' | inscrever_de_novo=ok'; exception when others then r:=r||' | inscrever_de_novo(deve bloquear)=BLOQUEADO'; end;
begin insert into public.tournament_movements(tournament_id, club_id, entry_id, kind, label, amount, to_prize, chips, payment_method) values (tid, '1c300690-e270-4503-afce-c549fbd14f58', eid, 'buyin', 'Buy-in', 120, 90, 15000, 'fiado'); r:=r||' | buyin_120_fiado=ok'; exception when others then r:=r||' | buyin_120_fiado=ERRO:'||left(sqlerrm,80); end;
begin insert into public.tournament_movements(tournament_id, club_id, entry_id, kind, label, amount, to_prize, chips, payment_method) values (tid, '1c300690-e270-4503-afce-c549fbd14f58', eid, 'rebuy', 'Rebuy duplo', 150, 150, 30000, 'pix'); r:=r||' | rebuy_duplo_pix=ok'; exception when others then r:=r||' | rebuy_duplo_pix=ERRO:'||left(sqlerrm,80); end;
begin insert into public.tournament_movements(tournament_id, club_id, entry_id, kind, label, chips) values (tid, '1c300690-e270-4503-afce-c549fbd14f58', eid, 'bonus', 'Pontualidade', 5000); r:=r||' | bonus_fichas=ok'; exception when others then r:=r||' | bonus_fichas=ERRO:'||left(sqlerrm,80); end;
execute $q$select coalesce((select saldo from public.fiado_saldos where player_id=(select id from public.players where club_id='1c300690-e270-4503-afce-c549fbd14f58' order by created_at limit 1)),0)::text$q$ into v; r:=r||' | fiado_jogador_aumentou(esperado 120)='||(v::numeric-antes)::text;
begin insert into public.tournament_movements(tournament_id, club_id, entry_id, kind, amount, payment_method) values (tid, '1c300690-e270-4503-afce-c549fbd14f58', eid, 'premio', 500, 'fiado'); r:=r||' | premio_fiado=ok'; exception when others then r:=r||' | premio_no_fiado(deve bloquear)=BLOQUEADO'; end;
begin insert into public.tournament_movements(tournament_id, club_id, entry_id, kind, amount, to_prize) values (tid, '1c300690-e270-4503-afce-c549fbd14f58', eid, 'rebuy', 50, 90); r:=r||' | premio_maior_que_valor=ok'; exception when others then r:=r||' | parte_premio_maior_que_valor(deve bloquear)=BLOQUEADO'; end;
begin perform torneio_relogio(tid, 0, true, 1500); r:=r||' | iniciar_relogio=ok'; exception when others then r:=r||' | iniciar_relogio=ERRO:'||left(sqlerrm,80); end;
begin select status||' / termina_em_'||round(extract(epoch from clock_ends_at - now()))::text into v from public.tournaments where id=tid; r:=r||' | estado(esperado em_andamento / 1500)='||coalesce(v,'nulo'); end;
begin update public.tournaments set tv_token='x' where id=tid; r:=r||' | trocar_token_tv=ok'; exception when others then r:=r||' | trocar_token_tv(deve bloquear)=BLOQUEADO'; end;
r:=r||' ### TV SEM LOGIN';
execute 'reset role'; execute 'set local role anon';
begin select (torneio_tv(tok)->'tournament'->>'name')||' / inscritos='||json_array_length(torneio_tv(tok)->'entries')||' / movimentos='||json_array_length(torneio_tv(tok)->'movements') into v; r:=r||' | tv_pelo_link='||coalesce(v,'nulo'); exception when others then r:=r||' | tv_pelo_link=ERRO:'||left(sqlerrm,80); end;
begin v := coalesce(torneio_tv('token-errado')::text, 'nada'); r:=r||' | tv_link_errado(esperado nada)='||v; exception when others then r:=r||' | tv_link_errado=ERRO:'||left(sqlerrm,80); end;
begin execute $q$select count(*) from public.tournaments$q$; get diagnostics n=row_count; r:=r||' | tv_le_tabela_direto(deve bloquear)=ok('||n||')'; exception when others then r:=r||' | tv_le_tabela_direto(deve bloquear)=BLOQUEADO:'||left(sqlerrm,80); end;
r:=r||' ### OUTRO CLUBE';
execute 'reset role'; perform set_config('request.jwt.claims', json_build_object('sub','c31107ee-c2c5-416f-b64f-1defdad28fbd','role','authenticated')::text, true); perform set_config('request.jwt.claim.sub','c31107ee-c2c5-416f-b64f-1defdad28fbd', true); execute 'set local role authenticated';
begin execute $q$select count(*)::text from public.tournaments$q$ into v; r:=r||' | outro_clube_ve_torneios(esperado 0)='||coalesce(v,'nulo'); exception when others then r:=r||' | outro_clube_ve_torneios(esperado 0)=ERRO:'||left(sqlerrm,80); end;
begin perform torneio_relogio(tid, 3, false, 10); r:=r||' | outro_clube_mexe_relogio=ok'; exception when others then r:=r||' | outro_clube_mexe_relogio(deve bloquear)=BLOQUEADO'; end;
begin insert into public.tournament_movements(tournament_id, club_id, entry_id, kind, amount) values (tid, '1c300690-e270-4503-afce-c549fbd14f58', eid, 'rebuy', 10); r:=r||' | outro_clube_lanca=ok'; exception when others then r:=r||' | outro_clube_lanca(deve bloquear)=BLOQUEADO'; end;
execute 'reset role'; perform set_config('request.jwt.claims', json_build_object('sub','920ec72f-ba38-4ff7-82ac-74558707ba26','role','authenticated')::text, true); perform set_config('request.jwt.claim.sub','920ec72f-ba38-4ff7-82ac-74558707ba26', true); execute 'set local role authenticated';
begin delete from public.tournaments where id=tid; get diagnostics n=row_count; r:=r||' | apagar_torneio=ok('||n||')'; exception when others then r:=r||' | apagar_torneio=ERRO:'||left(sqlerrm,80); end;
execute $q$select coalesce((select saldo from public.fiado_saldos where player_id=(select id from public.players where club_id='1c300690-e270-4503-afce-c549fbd14f58' order by created_at limit 1)),0)::text$q$ into v; r:=r||' | fiado_volta_ao_original(esperado 0)='||(v::numeric-antes)::text;
execute 'reset role';
begin execute $q$select count(*)::text from public.transactions where club_id='1c300690-e270-4503-afce-c549fbd14f58'$q$ into v; r:=r||' | lancamentos_masmorra='||coalesce(v,'nulo'); exception when others then r:=r||' | lancamentos_masmorra=ERRO:'||left(sqlerrm,80); end;
raise exception 'SIMULACAO (nada foi gravado): %', r;
end $test$;
