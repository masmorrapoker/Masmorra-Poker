-- Masmorra Manager — Histórico completo da mesa (linha do tempo)
-- 2026-10-17
--
-- Cria table_events: tudo o que acontece numa mesa vira um evento, gravado
-- pelo próprio banco (gatilhos), com data/hora e quem fez:
--   mesa_aberta, mesa_encerrada, jogador_entrou, jogador_removido,
--   buy_in, cash_out, consumo, lancamento_removido, lancamento_alterado
-- O operador só lê os eventos do próprio clube; ninguém edita ou apaga pelo app.
--
-- Também permite remover um jogador da mesa por engano, desde que ele não
-- tenha nenhum lançamento e a mesa esteja aberta.
--
-- Preenche o histórico das mesas existentes a partir dos dados atuais.
-- Rollback: supabase/rollback/20261017220000_historico_da_mesa.down.sql

-- 1. Tabela de eventos ---------------------------------------------------------
create table if not exists public.table_events (
  id bigint generated always as identity primary key,
  club_id uuid not null references public.clubs(id) on delete cascade,
  table_id uuid not null references public.tables(id) on delete cascade,
  event_type text not null check (event_type in (
    'mesa_aberta', 'mesa_encerrada', 'jogador_entrou', 'jogador_removido',
    'buy_in', 'cash_out', 'consumo', 'lancamento_removido', 'lancamento_alterado'
  )),
  player_name text,
  amount numeric,
  description text,
  ref_id uuid,            -- id do lançamento (transactions) ou do jogador na mesa (table_players)
  created_by uuid,
  created_at timestamptz not null default now()
);

create index if not exists table_events_mesa_idx
  on public.table_events (table_id, created_at desc, id desc);

alter table public.table_events enable row level security;

revoke all on public.table_events from anon;
revoke insert, update, delete, truncate, trigger, references
  on public.table_events from authenticated;
grant select on public.table_events to authenticated;

drop policy if exists "table_events: ler do proprio clube" on public.table_events;
create policy "table_events: ler do proprio clube" on public.table_events
  for select to authenticated
  using (club_id = (select public.current_club_id()));

-- 2. Função única de registro --------------------------------------------------
create or replace function public.registrar_evento_mesa()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_table_id uuid;
  v_club_id uuid;
  v_player text;
begin
  if tg_table_name = 'tables' then
    if tg_op = 'INSERT' then
      insert into table_events (club_id, table_id, event_type, description, created_by, created_at)
      values (new.club_id, new.id, 'mesa_aberta', new.name, auth.uid(), new.created_at);
    elsif tg_op = 'UPDATE' and new.status = 'closed' and old.status is distinct from 'closed' then
      insert into table_events (club_id, table_id, event_type, description, created_by, created_at)
      values (new.club_id, new.id, 'mesa_encerrada', new.name, auth.uid(), coalesce(new.closed_at, now()));
    end if;
    return null;
  end if;

  v_table_id := coalesce(new.table_id, old.table_id);
  -- Mesa sendo apagada (cascade): não registra nada.
  if not exists (select 1 from tables where id = v_table_id) then
    return null;
  end if;
  v_club_id := coalesce(new.club_id, old.club_id);

  if tg_table_name = 'table_players' then
    insert into table_events (club_id, table_id, event_type, player_name, ref_id, created_by)
    values (
      v_club_id, v_table_id,
      case when tg_op = 'INSERT' then 'jogador_entrou' else 'jogador_removido' end,
      coalesce(new.name, old.name), coalesce(new.id, old.id), auth.uid()
    );
    return null;
  end if;

  -- transactions
  select name into v_player from table_players where id = coalesce(new.player_id, old.player_id);

  if tg_op = 'INSERT' then
    insert into table_events (club_id, table_id, event_type, player_name, amount, description, ref_id, created_by, created_at)
    values (v_club_id, v_table_id, new.type, v_player, new.amount, new.description, new.id, auth.uid(), new.created_at);
  elsif tg_op = 'DELETE' then
    insert into table_events (club_id, table_id, event_type, player_name, amount, description, ref_id, created_by)
    values (v_club_id, v_table_id, 'lancamento_removido', v_player, old.amount, old.type, old.id, auth.uid());
  elsif tg_op = 'UPDATE' then
    insert into table_events (club_id, table_id, event_type, player_name, amount, description, ref_id, created_by)
    values (v_club_id, v_table_id, 'lancamento_alterado', v_player, new.amount,
            old.type || ' ' || old.amount || ' -> ' || new.type || ' ' || new.amount, new.id, auth.uid());
  end if;
  return null;
end
$$;

revoke all on function public.registrar_evento_mesa() from public, anon, authenticated;

drop trigger if exists registrar_evento_mesa on public.tables;
create trigger registrar_evento_mesa
  after insert or update of status on public.tables
  for each row execute function public.registrar_evento_mesa();

drop trigger if exists registrar_evento_mesa on public.table_players;
create trigger registrar_evento_mesa
  after insert or delete on public.table_players
  for each row execute function public.registrar_evento_mesa();

drop trigger if exists registrar_evento_mesa on public.transactions;
create trigger registrar_evento_mesa
  after insert or update or delete on public.transactions
  for each row execute function public.registrar_evento_mesa();

-- 3. Remover jogador da mesa: só sem lançamentos e com a mesa aberta ----------
create or replace function public.table_players_validar_remocao()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_status text;
begin
  select status into v_status from public.tables where id = old.table_id;
  if v_status is null then
    return old; -- a própria mesa está sendo apagada (cascade)
  end if;
  if v_status = 'closed' then
    raise exception 'Mesa encerrada: não é possível remover jogadores.' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.transactions where player_id = old.id) then
    raise exception 'Jogador tem lançamentos: remova os lançamentos antes.' using errcode = 'P0001';
  end if;
  return old;
end
$$;

drop trigger if exists table_players_validar_remocao on public.table_players;
create trigger table_players_validar_remocao
  before delete on public.table_players
  for each row execute function public.table_players_validar_remocao();

-- 4. Tempo real para a linha do tempo -----------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'table_events'
  ) then
    alter publication supabase_realtime add table public.table_events;
  end if;
end
$$;

-- 5. Histórico das mesas que já existem ---------------------------------------
insert into public.table_events (club_id, table_id, event_type, description, created_at)
select t.club_id, t.id, 'mesa_aberta', t.name, t.created_at
from public.tables t
where t.club_id is not null
  and not exists (select 1 from public.table_events e where e.table_id = t.id and e.event_type = 'mesa_aberta');

insert into public.table_events (club_id, table_id, event_type, description, created_at)
select t.club_id, t.id, 'mesa_encerrada', t.name, t.closed_at
from public.tables t
where t.club_id is not null and t.status = 'closed' and t.closed_at is not null
  and not exists (select 1 from public.table_events e where e.table_id = t.id and e.event_type = 'mesa_encerrada');

insert into public.table_events (club_id, table_id, event_type, player_name, ref_id, created_at)
select tp.club_id, tp.table_id, 'jogador_entrou', tp.name, tp.id, tp.created_at
from public.table_players tp
join public.tables t on t.id = tp.table_id
where tp.club_id is not null
  and not exists (select 1 from public.table_events e where e.ref_id = tp.id and e.event_type = 'jogador_entrou');

insert into public.table_events (club_id, table_id, event_type, player_name, amount, description, ref_id, created_at)
select x.club_id, x.table_id, x.type, tp.name, x.amount, x.description, x.id, x.created_at
from public.transactions x
join public.tables t on t.id = x.table_id
left join public.table_players tp on tp.id = x.player_id
where x.club_id is not null
  and not exists (select 1 from public.table_events e where e.ref_id = x.id and e.event_type = x.type);

insert into public.table_events (club_id, table_id, event_type, player_name, amount, description, ref_id, created_by, created_at)
select a.club_id, a.table_id, 'lancamento_removido', tp.name,
       (a.old_data->>'amount')::numeric, a.old_data->>'type', a.transaction_id, a.changed_by, a.changed_at
from public.transactions_audit a
join public.tables t on t.id = a.table_id
left join public.table_players tp on tp.id = (a.old_data->>'player_id')::uuid
where a.action = 'DELETE' and a.club_id is not null
  and not exists (select 1 from public.table_events e where e.ref_id = a.transaction_id and e.event_type = 'lancamento_removido');
