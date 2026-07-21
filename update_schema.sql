-- Masmorra Manager - SQL Migration Update Schema
-- Execute estes comandos no SQL Editor do seu painel do Supabase

-- 1. Adicionar novas colunas de configuração na tabela de Clubes
ALTER TABLE public.clubs ADD COLUMN IF NOT EXISTS logo_url text;
ALTER TABLE public.clubs ADD COLUMN IF NOT EXISTS beer_price numeric DEFAULT 5.0;
ALTER TABLE public.clubs ADD COLUMN IF NOT EXISTS energy_price numeric DEFAULT 8.0;

-- 2. Adicionar novas colunas de informações no perfil do Operador
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS full_name text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role text DEFAULT 'operator';

-- 3. Habilitar RLS e configurar políticas permissivas para as tabelas de Clubes e Perfis
ALTER TABLE public.clubs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all operations for clubs" ON public.clubs;
CREATE POLICY "Allow all operations for clubs" ON public.clubs FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all operations for profiles" ON public.profiles;
CREATE POLICY "Allow all operations for profiles" ON public.profiles FOR ALL USING (true) WITH CHECK (true);

