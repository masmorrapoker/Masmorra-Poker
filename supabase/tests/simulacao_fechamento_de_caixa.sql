-- SIMULAÇÃO: migração fechamento_de_caixa, com testes.
-- Seguro: desfaz tudo no final (o erro vermelho é proposital e traz o resultado).

do $test$
declare r text := ''; n bigint; v text;
begin

create table if not exists public.cash_closings (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  night date not null,
  opening_cash numeric not null default 0 check (opening_cash >= 0),
  expected_cash numeric not null,
  counted_cash numeric not null check (counted_cash >= 0),
  difference numeric generated always as (counted_cash - expected_cash) stored,
  summary jsonb not null default '{}'::jsonb,
  note text,
  closed_by_name text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  constraint cash_closings_uma_por_noite unique (club_id, night)
);

alter table public.cash_closings enable row level security;

revoke all on public.cash_closings from anon;
revoke update, truncate, trigger, references on public.cash_closings from authenticated;
grant select, insert, delete on public.cash_closings to authenticated;

drop policy if exists "cash_closings: ler do proprio clube" on public.cash_closings;
create policy "cash_closings: ler do proprio clube" on public.cash_closings
  for select to authenticated
  using (club_id = (select public.current_club_id()));

drop policy if exists "cash_closings: fechar no proprio clube" on public.cash_closings;
create policy "cash_closings: fechar no proprio clube" on public.cash_closings
  for insert to authenticated
  with check (club_id = (select public.current_club_id()));

drop policy if exists "cash_closings: desfazer em 24h" on public.cash_closings;
create policy "cash_closings: desfazer em 24h" on public.cash_closings
  for delete to authenticated
  using (
    club_id = (select public.current_club_id())
    and created_at > now() - interval '24 hours'
  );
perform set_config('request.jwt.claims', json_build_object('sub','920ec72f-ba38-4ff7-82ac-74558707ba26','role','authenticated')::text, true);
perform set_config('request.jwt.claim.sub','920ec72f-ba38-4ff7-82ac-74558707ba26', true);
execute 'set local role authenticated';
r:=r||' ### FECHAMENTO SIMULADO (seu operador)';
begin execute $q$insert into public.cash_closings(club_id,night,opening_cash,expected_cash,counted_cash,closed_by_name) values ('1c300690-e270-4503-afce-c549fbd14f58','2026-10-19',200,1450,1430,'teste')$q$; get diagnostics n=row_count; r:=r||' | fechar_noite_1910=ok('||n||')'; exception when others then r:=r||' | fechar_noite_1910=BLOQUEADO:'||left(sqlerrm,100); end;
begin execute $q$select difference::text from public.cash_closings where club_id='1c300690-e270-4503-afce-c549fbd14f58' and night='2026-10-19'$q$ into v; r:=r||' | diferenca(esperado -20)='||coalesce(v,'nulo'); exception when others then r:=r||' | diferenca(esperado -20)=ERRO:'||left(sqlerrm,100); end;
begin execute $q$insert into public.cash_closings(club_id,night,expected_cash,counted_cash) values ('1c300690-e270-4503-afce-c549fbd14f58','2026-10-19',1,1)$q$; get diagnostics n=row_count; r:=r||' | fechar_mesma_noite_de_novo(deve bloquear)=ok('||n||')'; exception when others then r:=r||' | fechar_mesma_noite_de_novo(deve bloquear)=BLOQUEADO:'||left(sqlerrm,100); end;
begin execute $q$insert into public.cash_closings(club_id,night,expected_cash,counted_cash) values ('1c300690-e270-4503-afce-c549fbd14f58','2026-10-18',1,-5)$q$; get diagnostics n=row_count; r:=r||' | contado_negativo(deve bloquear)=ok('||n||')'; exception when others then r:=r||' | contado_negativo(deve bloquear)=BLOQUEADO:'||left(sqlerrm,100); end;
begin execute $q$insert into public.cash_closings(club_id,night,expected_cash,counted_cash) values ('1aefa5fe-6baf-42ee-a4ec-444ea53904aa','2026-10-19',1,1)$q$; get diagnostics n=row_count; r:=r||' | fechar_por_outro_clube(deve bloquear)=ok('||n||')'; exception when others then r:=r||' | fechar_por_outro_clube(deve bloquear)=BLOQUEADO:'||left(sqlerrm,100); end;
begin execute $q$update public.cash_closings set counted_cash=1450 where club_id='1c300690-e270-4503-afce-c549fbd14f58'$q$; get diagnostics n=row_count; r:=r||' | alterar_fechamento(deve bloquear)=ok('||n||')'; exception when others then r:=r||' | alterar_fechamento(deve bloquear)=BLOQUEADO:'||left(sqlerrm,100); end;
begin execute $q$delete from public.cash_closings where club_id='1c300690-e270-4503-afce-c549fbd14f58' and night='2026-10-19'$q$; get diagnostics n=row_count; r:=r||' | desfazer_recente=ok('||n||')'; exception when others then r:=r||' | desfazer_recente=BLOQUEADO:'||left(sqlerrm,100); end;
begin execute $q$select count(*)::text from public.cash_closings where club_id<>'1c300690-e270-4503-afce-c549fbd14f58'$q$ into v; r:=r||' | ve_fechamento_outros_clubes='||coalesce(v,'nulo'); exception when others then r:=r||' | ve_fechamento_outros_clubes=ERRO:'||left(sqlerrm,100); end;
execute 'reset role';
begin execute $q$select count(*)::text from public.transactions where club_id='1c300690-e270-4503-afce-c549fbd14f58'$q$ into v; r:=r||' | lancamentos_do_clube='||coalesce(v,'nulo'); exception when others then r:=r||' | lancamentos_do_clube=ERRO:'||left(sqlerrm,100); end;
raise exception 'SIMULACAO (nada foi gravado): %', r;
end $test$;
