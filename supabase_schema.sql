-- Masmorra Manager - Supabase SQL Schema

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- DROP EXISTING TABLES (para recriar o banco limpo)
drop table if exists public.transactions cascade;
drop table if exists public.table_players cascade;
drop table if exists public.tables cascade;
drop table if exists public.players cascade;

-- TABLES
create table public.tables (
    id uuid default uuid_generate_v4() primary key,
    name text not null,
    status text not null default 'active' check (status in ('active', 'closed')),
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    closed_at timestamp with time zone
);

-- PLAYERS (Global Registry)
create table public.players (
    id uuid default uuid_generate_v4() primary key,
    name text not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- TABLE PLAYERS
create table public.table_players (
    id uuid default uuid_generate_v4() primary key,
    table_id uuid references public.tables(id) on delete cascade not null,
    name text not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- TRANSACTIONS
create table public.transactions (
    id uuid default uuid_generate_v4() primary key,
    table_id uuid references public.tables(id) on delete cascade not null,
    player_id uuid references public.table_players(id) on delete cascade not null,
    type text not null check (type in ('buy_in', 'cash_out', 'consumo')),
    amount numeric not null check (amount >= 0),
    description text,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- RLS (Row Level Security) - For this MVP, we will allow anonymous access 
-- since we do not have a login module, but we should enable RLS with a permissive policy
-- to ensure the app works correctly over the API.

alter table public.tables enable row level security;
alter table public.players enable row level security;
alter table public.table_players enable row level security;
alter table public.transactions enable row level security;

-- Permissive policies for MVP (No Auth)
create policy "Allow all operations for tables" on public.tables for all using (true) with check (true);
create policy "Allow all operations for players" on public.players for all using (true) with check (true);
create policy "Allow all operations for table_players" on public.table_players for all using (true) with check (true);
create policy "Allow all operations for transactions" on public.transactions for all using (true) with check (true);

-- Realtime subscriptions
alter publication supabase_realtime add table public.tables;
alter publication supabase_realtime add table public.players;
alter publication supabase_realtime add table public.table_players;
alter publication supabase_realtime add table public.transactions;
