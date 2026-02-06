
-- ==============================================================================
-- RUN THIS SCRIPT IN SUPABASE SQL EDITOR TO FIX UPLOAD ERRORS
-- ==============================================================================

-- This adds the missing columns to the 'movies' table if they don't exist.
-- This fixes the "Could not find the 'cinematographers' column" error.

ALTER TABLE public.movies ADD COLUMN IF NOT EXISTS "cinematographers" text[];
ALTER TABLE public.movies ADD COLUMN IF NOT EXISTS "composers" text[];
ALTER TABLE public.movies ADD COLUMN IF NOT EXISTS "themes" text[];

-- Verify the columns are there
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'movies';
