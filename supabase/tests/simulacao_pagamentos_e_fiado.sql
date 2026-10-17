-- SIMULAÇÃO: migração pagamentos_e_fiado, com testes.
-- Seguro: desfaz tudo no final (o erro vermelho é proposital e traz o resultado).

do $test$
declare r text := ''; n bigint; v text;
begin

alter table public.transactions
  add column if not exists payment_method text
  check (payment_method in ('dinheiro', 'pix', 'cartao', 'fiado'));

alter table public.transactions
  drop constraint if exists transactions_cashout_sem_fiado;
alter table public.transactions
  add constraint transactions_cashout_sem_fiado
  check (not (type = 'cash_out' and payment_method = 'fiado'));

create table if not exists public.debt_settlements (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete restrict,
  amount numeric not null check (amount > 0),
  method text not null check (method in ('dinheiro', 'pix', 'cartao', 'abatido_cashout')),
  note text,
  table_id uuid references public.tables(id) on delete set null,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);

create index if not exists debt_settlements_player_idx
  on public.debt_settlements (club_id, player_id, created_at desc);

alter table public.debt_settlements enable row level security;

revoke all on public.debt_settlements from anon;
revoke update, truncate, trigger, references on public.debt_settlements from authenticated;
grant select, insert, delete on public.debt_settlements to authenticated;

drop policy if exists "debt_settlements: ler do proprio clube" on public.debt_settlements;
create policy "debt_settlements: ler do proprio clube" on public.debt_settlements
  for select to authenticated
  using (club_id = (select public.current_club_id()));

drop policy if exists "debt_settlements: registrar no proprio clube" on public.debt_settlements;
create policy "debt_settlements: registrar no proprio clube" on public.debt_settlements
  for insert to authenticated
  with check (
    club_id = (select public.current_club_id())
    and exists (
      select 1 from public.players p
      where p.id = debt_settlements.player_id and p.club_id = debt_settlements.club_id
    )
  );

drop policy if exists "debt_settlements: desfazer em 24h" on public.debt_settlements;
create policy "debt_settlements: desfazer em 24h" on public.debt_settlements
  for delete to authenticated
  using (
    club_id = (select public.current_club_id())
    and created_at > now() - interval '24 hours'
  );

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
  select tp.player_id, sum(x.amount) as devido, max(x.created_at) as ultimo_fiado
  from public.transactions x
  join public.table_players tp on tp.id = x.player_id
  where x.payment_method = 'fiado' and x.type in ('buy_in', 'consumo')
  group by tp.player_id
) d on d.player_id = p.id
left join (
  select player_id, sum(amount) as pago, max(created_at) as ultimo_pagamento
  from public.debt_settlements
  group by player_id
) s on s.player_id = p.id
where coalesce(d.devido, 0) > 0 or coalesce(s.pago, 0) > 0;

revoke all on public.fiado_saldos from anon;
grant select on public.fiado_saldos to authenticated;
r:=r||' ### DADOS ATUAIS';
begin execute $q$select count(*) filter (where payment_method is null)||'/'||count(*) from public.transactions where club_id='1c300690-e270-4503-afce-c549fbd14f58'$q$ into v; r:=r||' | lancamentos_sem_forma(=todos)='||coalesce(v,'nulo'); exception when others then r:=r||' | lancamentos_sem_forma(=todos)=ERRO:'||left(sqlerrm,90); end;
perform set_config('request.jwt.claims', json_build_object('sub','920ec72f-ba38-4ff7-82ac-74558707ba26','role','authenticated')::text, true);
perform set_config('request.jwt.claim.sub','920ec72f-ba38-4ff7-82ac-74558707ba26', true);
execute 'set local role authenticated';
r:=r||' ### NOITE SIMULADA (seu operador)';
begin execute $q$insert into public.tables(name,club_id) values ('sim-fiado','1c300690-e270-4503-afce-c549fbd14f58')$q$; get diagnostics n=row_count; r:=r||' | abrir_mesa=ok('||n||')'; exception when others then r:=r||' | abrir_mesa=BLOQUEADO:'||left(sqlerrm,80); end;
begin execute $q$insert into public.table_players(table_id,name,club_id) select id,'Jean','1c300690-e270-4503-afce-c549fbd14f58' from public.tables where name='sim-fiado'$q$; get diagnostics n=row_count; r:=r||' | add_jean=ok('||n||')'; exception when others then r:=r||' | add_jean=BLOQUEADO:'||left(sqlerrm,80); end;
begin execute $q$insert into public.transactions(table_id,player_id,type,amount,club_id,payment_method) select (select id from public.tables where name='sim-fiado'),(select id from public.table_players where table_id=(select id from public.tables where name='sim-fiado') and name='Jean'),'buy_in',300,'1c300690-e270-4503-afce-c549fbd14f58','fiado'$q$; get diagnostics n=row_count; r:=r||' | buyin_300_fiado=ok('||n||')'; exception when others then r:=r||' | buyin_300_fiado=BLOQUEADO:'||left(sqlerrm,80); end;
begin execute $q$insert into public.transactions(table_id,player_id,type,amount,club_id,payment_method) select (select id from public.tables where name='sim-fiado'),(select id from public.table_players where table_id=(select id from public.tables where name='sim-fiado') and name='Jean'),'buy_in',100,'1c300690-e270-4503-afce-c549fbd14f58','pix'$q$; get diagnostics n=row_count; r:=r||' | buyin_100_pix=ok('||n||')'; exception when others then r:=r||' | buyin_100_pix=BLOQUEADO:'||left(sqlerrm,80); end;
begin execute $q$insert into public.transactions(table_id,player_id,type,amount,club_id,payment_method) select (select id from public.tables where name='sim-fiado'),(select id from public.table_players where table_id=(select id from public.tables where name='sim-fiado') and name='Jean'),'cash_out',50,'1c300690-e270-4503-afce-c549fbd14f58','fiado'$q$; get diagnostics n=row_count; r:=r||' | cashout_no_fiado=ok('||n||')'; exception when others then r:=r||' | cashout_no_fiado=BLOQUEADO:'||left(sqlerrm,80); end;
begin execute $q$insert into public.transactions(table_id,player_id,type,amount,club_id,payment_method) select (select id from public.tables where name='sim-fiado'),(select id from public.table_players where table_id=(select id from public.tables where name='sim-fiado') and name='Jean'),'buy_in',10,'1c300690-e270-4503-afce-c549fbd14f58','cheque'$q$; get diagnostics n=row_count; r:=r||' | forma_invalida=ok('||n||')'; exception when others then r:=r||' | forma_invalida=BLOQUEADO:'||left(sqlerrm,80); end;
begin execute $q$select saldo::text from public.fiado_saldos where player_id=(select id from public.players where club_id='1c300690-e270-4503-afce-c549fbd14f58' and lower(name)='jean')$q$ into v; r:=r||' | saldo_jean(esperado 300)='||coalesce(v,'nulo'); exception when others then r:=r||' | saldo_jean(esperado 300)=ERRO:'||left(sqlerrm,90); end;
begin execute $q$insert into public.debt_settlements(club_id,player_id,amount,method) values ('1c300690-e270-4503-afce-c549fbd14f58',(select id from public.players where club_id='1c300690-e270-4503-afce-c549fbd14f58' and lower(name)='jean'),100,'pix')$q$; get diagnostics n=row_count; r:=r||' | pagamento_100_pix=ok('||n||')'; exception when others then r:=r||' | pagamento_100_pix=BLOQUEADO:'||left(sqlerrm,80); end;
begin execute $q$insert into public.debt_settlements(club_id,player_id,amount,method,table_id) values ('1c300690-e270-4503-afce-c549fbd14f58',(select id from public.players where club_id='1c300690-e270-4503-afce-c549fbd14f58' and lower(name)='jean'),50,'abatido_cashout',(select id from public.tables where name='sim-fiado'))$q$; get diagnostics n=row_count; r:=r||' | abatido_no_cashout_50=ok('||n||')'; exception when others then r:=r||' | abatido_no_cashout_50=BLOQUEADO:'||left(sqlerrm,80); end;
begin execute $q$select saldo::text from public.fiado_saldos where player_id=(select id from public.players where club_id='1c300690-e270-4503-afce-c549fbd14f58' and lower(name)='jean')$q$ into v; r:=r||' | saldo_jean(esperado 150)='||coalesce(v,'nulo'); exception when others then r:=r||' | saldo_jean(esperado 150)=ERRO:'||left(sqlerrm,90); end;
begin execute $q$insert into public.debt_settlements(club_id,player_id,amount,method) values ('1c300690-e270-4503-afce-c549fbd14f58',(select id from public.players where club_id='1c300690-e270-4503-afce-c549fbd14f58' and lower(name)='jean'),0,'pix')$q$; get diagnostics n=row_count; r:=r||' | pagamento_valor_zero=ok('||n||')'; exception when others then r:=r||' | pagamento_valor_zero=BLOQUEADO:'||left(sqlerrm,80); end;
begin execute $q$insert into public.debt_settlements(club_id,player_id,amount,method) select '1c300690-e270-4503-afce-c549fbd14f58',p.id,10,'pix' from public.players p where p.club_id='1aefa5fe-6baf-42ee-a4ec-444ea53904aa' limit 1$q$; get diagnostics n=row_count; r:=r||' | pagamento_jogador_outro_clube=ok('||n||')'; exception when others then r:=r||' | pagamento_jogador_outro_clube=BLOQUEADO:'||left(sqlerrm,80); end;
begin execute $q$update public.debt_settlements set amount=1 where player_id=(select id from public.players where club_id='1c300690-e270-4503-afce-c549fbd14f58' and lower(name)='jean')$q$; get diagnostics n=row_count; r:=r||' | alterar_pagamento=ok('||n||')'; exception when others then r:=r||' | alterar_pagamento=BLOQUEADO:'||left(sqlerrm,80); end;
begin execute $q$delete from public.debt_settlements where player_id=(select id from public.players where club_id='1c300690-e270-4503-afce-c549fbd14f58' and lower(name)='jean') and method='pix'$q$; get diagnostics n=row_count; r:=r||' | desfazer_pagamento_recente=ok('||n||')'; exception when others then r:=r||' | desfazer_pagamento_recente=BLOQUEADO:'||left(sqlerrm,80); end;
begin execute $q$select saldo::text from public.fiado_saldos where player_id=(select id from public.players where club_id='1c300690-e270-4503-afce-c549fbd14f58' and lower(name)='jean')$q$ into v; r:=r||' | saldo_jean_apos_desfazer(esperado 250)='||coalesce(v,'nulo'); exception when others then r:=r||' | saldo_jean_apos_desfazer(esperado 250)=ERRO:'||left(sqlerrm,90); end;
begin execute $q$select count(*)::text from public.fiado_saldos where club_id<>'1c300690-e270-4503-afce-c549fbd14f58'$q$ into v; r:=r||' | ve_fiado_outros_clubes='||coalesce(v,'nulo'); exception when others then r:=r||' | ve_fiado_outros_clubes=ERRO:'||left(sqlerrm,90); end;
begin execute $q$select string_agg(event_type||':'||coalesce(amount::text,''),' > ' order by id) from public.table_events where table_id=(select id from public.tables where name='sim-fiado')$q$ into v; r:=r||' | historico_registrou='||coalesce(v,'nulo'); exception when others then r:=r||' | historico_registrou=ERRO:'||left(sqlerrm,90); end;
execute 'reset role';
begin execute $q$select count(*)::text from public.transactions where club_id='1c300690-e270-4503-afce-c549fbd14f58' and table_id<>(select id from public.tables where name='sim-fiado')$q$ into v; r:=r||' | lancamentos_do_clube_fora_simulacao='||coalesce(v,'nulo'); exception when others then r:=r||' | lancamentos_do_clube_fora_simulacao=ERRO:'||left(sqlerrm,90); end;

raise exception 'SIMULACAO (nada foi gravado): %', r;
end $test$;