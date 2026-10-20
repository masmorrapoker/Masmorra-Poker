-- SIMULAÇÃO: migração acerto_na_saida, com testes.
-- Seguro: desfaz tudo no final (o erro vermelho é proposital e traz o resultado).

do $test$
declare r text := ''; n bigint; v text; antes numeric;
begin

alter table public.transactions
  add column if not exists fiado_amount numeric not null default 0;

alter table public.transactions
  drop constraint if exists transactions_fiado_amount_valido;
alter table public.transactions
  add constraint transactions_fiado_amount_valido
  check (fiado_amount >= 0 and (fiado_amount = 0 or type = 'cash_out'));

create or replace function public.validar_fiado_do_acerto()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  devendo numeric;
begin
  if new.type <> 'cash_out' or coalesce(new.fiado_amount, 0) = 0 then
    return new;
  end if;

  select coalesce(sum(case when type in ('buy_in', 'consumo') then amount else -amount end), 0)
    into devendo
  from public.transactions
  where player_id = new.player_id
    and id is distinct from new.id;

  devendo := devendo - new.amount;

  if new.fiado_amount > greatest(devendo, 0) then
    raise exception 'Fiado (%) maior que o valor devido pelo jogador na mesa (%).',
      new.fiado_amount, greatest(devendo, 0)
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists transactions_validar_fiado_do_acerto on public.transactions;
create trigger transactions_validar_fiado_do_acerto
  before insert or update of amount, fiado_amount, type on public.transactions
  for each row execute function public.validar_fiado_do_acerto();

alter table public.debt_settlements
  add column if not exists transaction_id uuid
  references public.transactions(id) on delete cascade;

create index if not exists debt_settlements_transaction_idx
  on public.debt_settlements (transaction_id) where transaction_id is not null;

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
  select tp.player_id,
         sum(case when x.type = 'cash_out' then x.fiado_amount else x.amount end) as devido,
         max(x.created_at) as ultimo_fiado
  from public.transactions x
  join public.table_players tp on tp.id = x.player_id
  where (x.payment_method = 'fiado' and x.type in ('buy_in', 'consumo'))
     or (x.type = 'cash_out' and x.fiado_amount > 0)
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
begin execute $q$select count(*)::text from public.transactions where club_id='1c300690-e270-4503-afce-c549fbd14f58'$q$ into v; r:=r||' | lancamentos_do_clube='||coalesce(v,'nulo'); exception when others then r:=r||' | lancamentos_do_clube=ERRO:'||left(sqlerrm,110); end;
begin execute $q$select (count(*) filter (where fiado_amount=0))||'/'||count(*) from public.transactions where club_id='1c300690-e270-4503-afce-c549fbd14f58'$q$ into v; r:=r||' | fiado_amount_todos_zero='||coalesce(v,'nulo'); exception when others then r:=r||' | fiado_amount_todos_zero=ERRO:'||left(sqlerrm,110); end;
perform set_config('request.jwt.claims', json_build_object('sub','920ec72f-ba38-4ff7-82ac-74558707ba26','role','authenticated')::text, true);
perform set_config('request.jwt.claim.sub','920ec72f-ba38-4ff7-82ac-74558707ba26', true);
execute 'set local role authenticated';
execute $q$select coalesce((select saldo from public.fiado_saldos where player_id=(select id from public.players where club_id='1c300690-e270-4503-afce-c549fbd14f58' and lower(name)='jean')),0)::text$q$ into v; antes := v::numeric; r:=r||' | saldo_fiado_jean_antes='||v;
r:=r||' ### NOITE SIMULADA: Jean compra 300, consome 20, sai com 100 (deve 220)';
begin execute $q$insert into public.tables(name,club_id) values ('sim-acerto','1c300690-e270-4503-afce-c549fbd14f58')$q$; get diagnostics n=row_count; r:=r||' | abrir_mesa=ok('||n||')'; exception when others then r:=r||' | abrir_mesa=BLOQUEADO:'||left(sqlerrm,110); end;
begin execute $q$insert into public.table_players(table_id,name,club_id) select id,'Jean','1c300690-e270-4503-afce-c549fbd14f58' from public.tables where name='sim-acerto'$q$; get diagnostics n=row_count; r:=r||' | add_jean=ok('||n||')'; exception when others then r:=r||' | add_jean=BLOQUEADO:'||left(sqlerrm,110); end;
begin execute $q$insert into public.transactions(table_id,player_id,type,amount,club_id) values ((select id from public.tables where name='sim-acerto'),(select id from public.table_players where table_id=(select id from public.tables where name='sim-acerto') and name='Jean'),'buy_in',300,'1c300690-e270-4503-afce-c549fbd14f58')$q$; get diagnostics n=row_count; r:=r||' | buyin_300_sem_forma=ok('||n||')'; exception when others then r:=r||' | buyin_300_sem_forma=BLOQUEADO:'||left(sqlerrm,110); end;
begin execute $q$insert into public.transactions(table_id,player_id,type,amount,club_id,description) values ((select id from public.tables where name='sim-acerto'),(select id from public.table_players where table_id=(select id from public.tables where name='sim-acerto') and name='Jean'),'consumo',20,'1c300690-e270-4503-afce-c549fbd14f58','Cerveja')$q$; get diagnostics n=row_count; r:=r||' | consumo_20=ok('||n||')'; exception when others then r:=r||' | consumo_20=BLOQUEADO:'||left(sqlerrm,110); end;
begin execute $q$insert into public.transactions(table_id,player_id,type,amount,club_id,fiado_amount) values ((select id from public.tables where name='sim-acerto'),(select id from public.table_players where table_id=(select id from public.tables where name='sim-acerto') and name='Jean'),'buy_in',10,'1c300690-e270-4503-afce-c549fbd14f58',10)$q$; get diagnostics n=row_count; r:=r||' | buyin_com_fiado(deve bloquear)=ok('||n||')'; exception when others then r:=r||' | buyin_com_fiado(deve bloquear)=BLOQUEADO:'||left(sqlerrm,110); end;
begin execute $q$insert into public.transactions(table_id,player_id,type,amount,club_id,payment_method,fiado_amount) values ((select id from public.tables where name='sim-acerto'),(select id from public.table_players where table_id=(select id from public.tables where name='sim-acerto') and name='Jean'),'cash_out',100,'1c300690-e270-4503-afce-c549fbd14f58','pix',300)$q$; get diagnostics n=row_count; r:=r||' | cashout_fiado_300_maior_que_divida(deve bloquear)=ok('||n||')'; exception when others then r:=r||' | cashout_fiado_300_maior_que_divida(deve bloquear)=BLOQUEADO:'||left(sqlerrm,110); end;
begin execute $q$insert into public.transactions(table_id,player_id,type,amount,club_id,payment_method,fiado_amount) values ((select id from public.tables where name='sim-acerto'),(select id from public.table_players where table_id=(select id from public.tables where name='sim-acerto') and name='Jean'),'cash_out',100,'1c300690-e270-4503-afce-c549fbd14f58','pix',150)$q$; get diagnostics n=row_count; r:=r||' | cashout_100_paga_70_pix_150_fiado=ok('||n||')'; exception when others then r:=r||' | cashout_100_paga_70_pix_150_fiado=BLOQUEADO:'||left(sqlerrm,110); end;
execute $q$select coalesce((select saldo from public.fiado_saldos where player_id=(select id from public.players where club_id='1c300690-e270-4503-afce-c549fbd14f58' and lower(name)='jean')),0)::text$q$ into v; r:=r||' | fiado_jean_aumentou(esperado 150)='||(v::numeric-antes)::text;
begin execute $q$update public.transactions set fiado_amount=500 where id=(select id from public.transactions where player_id=(select id from public.table_players where table_id=(select id from public.tables where name='sim-acerto') and name='Jean') and type='cash_out' limit 1)$q$; get diagnostics n=row_count; r:=r||' | aumentar_fiado_para_500(deve bloquear)=ok('||n||')'; exception when others then r:=r||' | aumentar_fiado_para_500(deve bloquear)=BLOQUEADO:'||left(sqlerrm,110); end;
begin execute $q$insert into public.debt_settlements(club_id,player_id,amount,method,table_id,transaction_id) values ('1c300690-e270-4503-afce-c549fbd14f58',(select id from public.players where club_id='1c300690-e270-4503-afce-c549fbd14f58' and lower(name)='jean'),50,'abatido_cashout',(select id from public.tables where name='sim-acerto'),(select id from public.transactions where player_id=(select id from public.table_players where table_id=(select id from public.tables where name='sim-acerto') and name='Jean') and type='cash_out' limit 1))$q$; get diagnostics n=row_count; r:=r||' | abatimento_50_preso_ao_cashout=ok('||n||')'; exception when others then r:=r||' | abatimento_50_preso_ao_cashout=BLOQUEADO:'||left(sqlerrm,110); end;
execute $q$select coalesce((select saldo from public.fiado_saldos where player_id=(select id from public.players where club_id='1c300690-e270-4503-afce-c549fbd14f58' and lower(name)='jean')),0)::text$q$ into v; r:=r||' | fiado_jean_aumentou(esperado 100)='||(v::numeric-antes)::text;
begin execute $q$delete from public.transactions where id=(select id from public.transactions where player_id=(select id from public.table_players where table_id=(select id from public.tables where name='sim-acerto') and name='Jean') and type='cash_out' limit 1)$q$; get diagnostics n=row_count; r:=r||' | remover_cashout=ok('||n||')'; exception when others then r:=r||' | remover_cashout=BLOQUEADO:'||left(sqlerrm,110); end;
begin execute $q$select count(*)::text from public.debt_settlements where table_id=(select id from public.tables where name='sim-acerto')$q$ into v; r:=r||' | abatimentos_que_sobraram(esperado 0)='||coalesce(v,'nulo'); exception when others then r:=r||' | abatimentos_que_sobraram(esperado 0)=ERRO:'||left(sqlerrm,110); end;
execute $q$select coalesce((select saldo from public.fiado_saldos where player_id=(select id from public.players where club_id='1c300690-e270-4503-afce-c549fbd14f58' and lower(name)='jean')),0)::text$q$ into v; r:=r||' | fiado_jean_aumentou(esperado 0)='||(v::numeric-antes)::text;
begin execute $q$select count(*)::text from public.fiado_saldos where club_id<>'1c300690-e270-4503-afce-c549fbd14f58'$q$ into v; r:=r||' | ve_fiado_outros_clubes='||coalesce(v,'nulo'); exception when others then r:=r||' | ve_fiado_outros_clubes=ERRO:'||left(sqlerrm,110); end;
execute 'reset role';
begin execute $q$select count(*)::text from public.transactions where club_id='1c300690-e270-4503-afce-c549fbd14f58' and table_id<>(select id from public.tables where name='sim-acerto')$q$ into v; r:=r||' | lancamentos_do_clube_fora_simulacao='||coalesce(v,'nulo'); exception when others then r:=r||' | lancamentos_do_clube_fora_simulacao=ERRO:'||left(sqlerrm,110); end;
raise exception 'SIMULACAO (nada foi gravado): %', r;
end $test$;
