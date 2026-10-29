
-- ==============================================================================
-- RUN THIS SCRIPT IN SUPABASE SQL EDITOR
-- ==============================================================================

-- Adiciona a coluna iswatchlist para suportar o recurso 'Ver Depois'
ALTER TABLE public.userlists ADD COLUMN IF NOT EXISTS "iswatchlist" boolean DEFAULT false;

-- Verifica se a coluna foi adicionada com sucesso
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'userlists' AND column_name = 'iswatchlist';
