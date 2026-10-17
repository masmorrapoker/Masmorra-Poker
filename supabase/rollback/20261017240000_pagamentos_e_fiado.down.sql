-- ROLLBACK de 20261017240000_pagamentos_e_fiado.sql
-- ATENÇÃO: apaga os pagamentos de fiado registrados e a forma de pagamento dos lançamentos.

drop view if exists public.fiado_saldos;
drop table if exists public.debt_settlements;
alter table public.transactions drop constraint if exists transactions_cashout_sem_fiado;
alter table public.transactions drop column if exists payment_method;
