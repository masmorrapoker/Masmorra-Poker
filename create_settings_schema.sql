-- Masmorra Manager - SQL Migration for Club Settings
-- Execute estes comandos no SQL Editor do seu painel do Supabase

CREATE TABLE IF NOT EXISTS public.club_settings (
    club_id uuid REFERENCES public.clubs(id) ON DELETE CASCADE PRIMARY KEY,
    email text,
    phone text,
    instagram text,
    address text,
    city text,
    state text,
    opening_time text DEFAULT '20:00',
    closing_time text DEFAULT '04:00',
    business_days text[] DEFAULT ARRAY['segunda', 'terca', 'quinta']::text[],
    default_buyin numeric DEFAULT 200,
    default_rebuy numeric DEFAULT 200,
    currency text DEFAULT 'R$',
    welcome_message text DEFAULT 'Bem-vindo ao Masmorra Manager',
    primary_color text DEFAULT '#3b82f6',
    custom_products jsonb DEFAULT '[]'::jsonb,
    marketing_inactive_days numeric DEFAULT 30,
    marketing_club_name text,
    marketing_templates jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar RLS e configurar políticas permissivas
ALTER TABLE public.club_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all operations for club_settings" ON public.club_settings;
CREATE POLICY "Allow all operations for club_settings" ON public.club_settings FOR ALL USING (true) WITH CHECK (true);

-- Adicionar à publicação realtime se necessário (para atualizações em tempo real)
ALTER PUBLICATION supabase_realtime ADD TABLE public.club_settings;
