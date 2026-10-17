-- Masmorra Manager — Auditoria de lançamentos
-- 2026-10-17
--
-- Toda exclusão ou alteração em transactions fica registrada em
-- transactions_audit: o lançamento original, quem fez e quando.
-- Ninguém pelo app consegue apagar ou editar o registro de auditoria;
-- o operador só consegue ler a auditoria do próprio clube.
-- Rollback: supabase/rollback/20261017200000_auditoria_lancamentos.down.sql

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

-- security definer: grava a auditoria mesmo sem o operador ter permissão
-- de escrita nessa tabela.
create or replace function public.transactions_registrar_auditoria()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
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
$$;

revoke all on function public.transactions_registrar_auditoria() from public, anon, authenticated;

drop trigger if exists transactions_registrar_auditoria on public.transactions;
create trigger transactions_registrar_auditoria
  after update or delete on public.transactions
  for each row execute function public.transactions_registrar_auditoria();
