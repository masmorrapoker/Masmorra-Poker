-- Masmorra Manager — Jogador da mesa ligado ao cadastro por ID
-- 2026-10-17
--
-- Antes: table_players guardava só o NOME do jogador. Renomear o cadastro
-- "apagava" o histórico; homônimos se misturavam; toque duplo criava
-- cadastros repetidos; era possível lançar em mesa já encerrada.
--
-- Depois:
--   * table_players.player_id aponta para players.id (vínculo permanente);
--   * renomear o cadastro atualiza o nome nas mesas automaticamente;
--   * não existem dois cadastros com o mesmo nome no mesmo clube;
--   * mesa encerrada não aceita novos jogadores nem alteração de lançamentos.
--
-- Compatível com a versão atual do app (que ainda envia só o nome):
-- o banco preenche o player_id sozinho.
-- Rollback: supabase/rollback/20261017180000_jogador_por_id.down.sql

-- 1. Coluna de vínculo --------------------------------------------------------
alter table public.table_players
  add column if not exists player_id uuid references public.players(id) on delete restrict;

create index if not exists table_players_player_id_idx on public.table_players(player_id);

-- 2. Preenche o vínculo dos registros existentes (só quando o nome bate com
--    exatamente um cadastro do mesmo clube) ---------------------------------
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

-- 3. Cadastro único por nome dentro do clube ----------------------------------
create unique index if not exists players_club_nome_unico
  on public.players (club_id, lower(trim(name)));

-- 4. Ao inserir jogador na mesa: completa/valida o vínculo ---------------------
create or replace function public.table_players_vincular_cadastro()
returns trigger
language plpgsql
set search_path = public
as $$
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
$$;

drop trigger if exists table_players_vincular_cadastro on public.table_players;
create trigger table_players_vincular_cadastro
  before insert on public.table_players
  for each row execute function public.table_players_vincular_cadastro();

-- 5. Renomear o cadastro atualiza o nome nas mesas -----------------------------
create or replace function public.players_propagar_nome()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.name is distinct from old.name then
    update public.table_players set name = new.name where player_id = new.id;
  end if;
  return new;
end
$$;

drop trigger if exists players_propagar_nome on public.players;
create trigger players_propagar_nome
  after update of name on public.players
  for each row execute function public.players_propagar_nome();

-- 6. Mesa encerrada não aceita alteração de lançamentos ------------------------
create or replace function public.transactions_bloquear_mesa_encerrada()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_status text;
begin
  select status into v_status
  from public.tables
  where id = coalesce(new.table_id, old.table_id);

  -- v_status nulo = a própria mesa está sendo apagada (cascade): permitido.
  if v_status = 'closed' then
    raise exception 'Mesa encerrada: não é possível alterar lançamentos.'
      using errcode = 'P0001';
  end if;

  return coalesce(new, old);
end
$$;

drop trigger if exists transactions_bloquear_mesa_encerrada on public.transactions;
create trigger transactions_bloquear_mesa_encerrada
  before insert or update or delete on public.transactions
  for each row execute function public.transactions_bloquear_mesa_encerrada();
