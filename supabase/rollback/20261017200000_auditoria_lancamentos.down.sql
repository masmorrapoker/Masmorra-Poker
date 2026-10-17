-- ROLLBACK de 20261017200000_auditoria_lancamentos.sql
-- ATENÇÃO: apaga o histórico de auditoria. Exporte a tabela antes, se precisar.

drop trigger if exists transactions_registrar_auditoria on public.transactions;
drop function if exists public.transactions_registrar_auditoria();
drop table if exists public.transactions_audit;
