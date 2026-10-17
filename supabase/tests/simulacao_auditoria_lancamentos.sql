-- SIMULAÇÃO: migração auditoria_lancamentos, com testes.
-- Seguro: desfaz tudo no final (o erro vermelho é proposital e traz o resultado).

do $test$
declare r text := ''; n bigint; v text;
begin

create table if not exists public.transactions_audit (
  id bigint generated always as identity primary key,
  action text not null check (action in ('DELETE', 'UPDATE')),
  transaction_id uuid not null,
  club_id uuid references public.clubs(id) on delete cascade,
  table_id uuid,
  old_data jsonb not null,
  new_data jsonb,
  changed_by uuid,
  changed_at timestamptz not null default now()
);

create index if not exists transactions_audit_table_idx
  on public.transactions_audit (club_id, table_id, changed_at desc);

alter table public.transactions_audit enable row level security;

revoke all on public.transactions_audit from anon;
revoke insert, update, delete, truncate, trigger, references
  on public.transactions_audit from authenticated;
grant select on public.transactions_audit to authenticated;

drop policy if exists "transactions_audit: ler do proprio clube" on public.transactions_audit;
create policy "transactions_audit: ler do proprio clube" on public.transactions_audit
  for select to authenticated
  using (club_id = (select public.current_club_id()));

create or replace function public.transactions_registrar_auditoria()
returns trigger
language plpgsql
security definer
set search_path = public
as $f$
begin
  insert into public.transactions_audit
    (action, transaction_id, club_id, table_id, old_data, new_data, changed_by)
  values (
    tg_op,
    old.id,
    old.club_id,
    old.table_id,
    to_jsonb(old),
    case when tg_op = 'UPDATE' then to_jsonb(new) else null end,
    auth.uid()
  );
  return coalesce(new, old);
end
$f$;

revoke all on function public.transactions_registrar_auditoria() from public, anon, authenticated;

drop trigger if exists transactions_registrar_auditoria on public.transactions;
create trigger transactions_registrar_auditoria
  after update or delete on public.transactions
  for each row execute function public.transactions_registrar_auditoria();
perform set_config('request.jwt.claims', json_build_object('sub','920ec72f-ba38-4ff7-82ac-74558707ba26','role','authenticated')::text, true);
perform set_config('request.jwt.claim.sub','920ec72f-ba38-4ff7-82ac-74558707ba26', true);
execute 'set local role authenticated';
r:=r||' ### COMO SEU OPERADOR';
begin execute $q$insert into public.tables(name,club_id) values ('sim-auditoria','1c300690-e270-4503-afce-c549fbd14f58')$q$; get diagnostics n=row_count; r:=r||' | criar_mesa=ok('||n||')'; exception when others then r:=r||' | criar_mesa=BLOQUEADO:'||left(sqlerrm,70); end;
begin execute $q$insert into public.table_players(table_id,name,club_id) select id,'Jean','1c300690-e270-4503-afce-c549fbd14f58' from public.tables where name='sim-auditoria'$q$; get diagnostics n=row_count; r:=r||' | add_jogador=ok('||n||')'; exception when others then r:=r||' | add_jogador=BLOQUEADO:'||left(sqlerrm,70); end;
begin execute $q$insert into public.transactions(table_id,player_id,type,amount,club_id) select tp.table_id,tp.id,'buy_in',150,'1c300690-e270-4503-afce-c549fbd14f58' from public.table_players tp join public.tables t on t.id=tp.table_id where t.name='sim-auditoria'$q$; get diagnostics n=row_count; r:=r||' | lancar_buyin=ok('||n||')'; exception when others then r:=r||' | lancar_buyin=BLOQUEADO:'||left(sqlerrm,70); end;
begin execute $q$delete from public.transactions where table_id in (select id from public.tables where name='sim-auditoria')$q$; get diagnostics n=row_count; r:=r||' | remover_buyin=ok('||n||')'; exception when others then r:=r||' | remover_buyin=BLOQUEADO:'||left(sqlerrm,70); end;
begin execute $q$select count(*)||' registro(s), valor='||max((old_data->>'amount'))||', por_mim='||bool_and(changed_by='920ec72f-ba38-4ff7-82ac-74558707ba26') from public.transactions_audit where table_id in (select id from public.tables where name='sim-auditoria')$q$ into v; r:=r||' | auditoria_registrou='||coalesce(v,'nulo'); exception when others then r:=r||' | auditoria_registrou=ERRO:'||left(sqlerrm,80); end;
begin execute $q$delete from public.transactions_audit$q$; get diagnostics n=row_count; r:=r||' | apagar_auditoria=ok('||n||')'; exception when others then r:=r||' | apagar_auditoria=BLOQUEADO:'||left(sqlerrm,70); end;
begin execute $q$update public.transactions_audit set old_data='{}'::jsonb$q$; get diagnostics n=row_count; r:=r||' | editar_auditoria=ok('||n||')'; exception when others then r:=r||' | editar_auditoria=BLOQUEADO:'||left(sqlerrm,70); end;
begin execute $q$insert into public.transactions_audit(action,transaction_id,club_id,old_data) values ('DELETE',gen_random_uuid(),'1c300690-e270-4503-afce-c549fbd14f58','{}'::jsonb)$q$; get diagnostics n=row_count; r:=r||' | inserir_auditoria_falsa=ok('||n||')'; exception when others then r:=r||' | inserir_auditoria_falsa=BLOQUEADO:'||left(sqlerrm,70); end;
begin execute $q$select count(*)::text from public.transactions_audit where club_id<>'1c300690-e270-4503-afce-c549fbd14f58'$q$ into v; r:=r||' | ver_auditoria_outros_clubes='||coalesce(v,'nulo'); exception when others then r:=r||' | ver_auditoria_outros_clubes=ERRO:'||left(sqlerrm,80); end;
execute 'reset role';
begin execute $q$select count(*)::text from public.transactions where club_id='1c300690-e270-4503-afce-c549fbd14f58'$q$ into v; r:=r||' | lancamentos_do_clube_intactos(esperado 373)='||coalesce(v,'nulo'); exception when others then r:=r||' | lancamentos_do_clube_intactos(esperado 373)=ERRO:'||left(sqlerrm,80); end;

raise exception 'SIMULACAO (nada foi gravado): %', r;
end $test$;