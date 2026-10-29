
-- ==============================================================================
-- RUN THIS SCRIPT IN SUPABASE SQL EDITOR
-- ==============================================================================

-- Adds a column to store the URL of the external subtitle file (SRT, VTT, etc.)
ALTER TABLE public.movies ADD COLUMN IF NOT EXISTS "subtitleurl" text;

-- Update the view/sink if necessary (Trigger fn_insert_movie_split handles the insert logic)
-- Verify the column is accessible
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'movies' AND column_name = 'subtitleurl';
