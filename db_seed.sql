
-- ============================================================
-- SUPABASE SCHEMA - 3-TABLE STRUCTURE
-- ============================================================

-- 1. CLEANUP
DROP TRIGGER IF EXISTS tr_split_movie_insert ON public.legacy_movies_sink;
DROP FUNCTION IF EXISTS public.fn_insert_movie_split();
DROP VIEW IF EXISTS public.legacy_movies_sink;
-- Be careful dropping tables that might contain user data if running in production
-- DROP TABLE IF EXISTS public.movies CASCADE;
-- DROP TABLE IF EXISTS public.description CASCADE;
-- DROP TABLE IF EXISTS public.technicaldetails CASCADE;

-- 2. CREATE TABLES

-- Table 1: Core Assets & Identifiers
CREATE TABLE IF NOT EXISTS public.movies (
    "id" text PRIMARY KEY,
    "wikidataId" text UNIQUE, -- Ensure unique for joining
    "title" text NOT NULL,
    "titlePt" text,
    "originalTitle" text,
    "year" integer,
    "language" text,
    "hasSubtitles" boolean,
    "posterUrl" text,
    "videoUrl" text,
    "trailerUrl" text,
    "awards" text[]
);

-- Table 2: Text Content (Multilingual Descriptions)
CREATE TABLE IF NOT EXISTS public.description (
    "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    "wikidataId" text REFERENCES public.movies("wikidataId") ON DELETE CASCADE,
    "title" text,
    "description" text,
    "descriptionPt" text,
    "descriptionHi" text,
    "descriptionRu" text,
    "descriptionIt" text,
    CONSTRAINT uniq_desc_wiki UNIQUE("wikidataId")
);

-- Table 3: Technical Metadata
CREATE TABLE IF NOT EXISTS public.technicaldetails (
    "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    "wikidataId" text REFERENCES public.movies("wikidataId") ON DELETE CASCADE,
    "title" text,
    "duration" text,
    "genres" text[],
    "director" text,
    "type" text,
    "sourceLabel" text,
    "cast_members" text[],
    "cinematographers" text[],
    "composers" text[],
    "themes" text[],
    "rating" text,
    CONSTRAINT uniq_tech_wiki UNIQUE("wikidataId")
);

-- 3. SECURITY POLICIES (RLS)
ALTER TABLE public.movies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.description ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.technicaldetails ENABLE ROW LEVEL SECURITY;

-- Allow public read access (Drops existing policies first to avoid errors on re-run)
DROP POLICY IF EXISTS "Public read movies" ON public.movies;
CREATE POLICY "Public read movies" ON public.movies FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public read description" ON public.description;
CREATE POLICY "Public read description" ON public.description FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public read technicaldetails" ON public.technicaldetails;
CREATE POLICY "Public read technicaldetails" ON public.technicaldetails FOR SELECT USING (true);

-- Allow full access for anon/service (for seeding/demo purposes)
DROP POLICY IF EXISTS "Public all movies" ON public.movies;
CREATE POLICY "Public all movies" ON public.movies FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public all description" ON public.description;
CREATE POLICY "Public all description" ON public.description FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public all technicaldetails" ON public.technicaldetails;
CREATE POLICY "Public all technicaldetails" ON public.technicaldetails FOR ALL USING (true) WITH CHECK (true);


-- ============================================================
-- 4. LEGACY SEED COMPATIBILITY LAYER
-- ============================================================
-- This View + Trigger allows inserting "Old Schema" data (flat)
-- and automatically distributes it to the 3 new tables.

CREATE OR REPLACE VIEW public.legacy_movies_sink AS
SELECT
    m.id,
    m.wikidataId,
    m.title,
    m.titlePt,
    m.originalTitle,
    d.description,
    d.descriptionPt,
    d.descriptionHi,
    d.descriptionRu,
    d.descriptionIt,
    t.genres,
    m.year,
    m.language,
    m.hasSubtitles,
    m.posterUrl,
    m.videoUrl,
    m.trailerUrl,
    t.rating,
    t.duration,
    t.director,
    t.type,
    t.sourceLabel,
    t.cast_members,
    m.awards,
    t.cinematographers,
    t.composers,
    t.themes
FROM public.movies m
LEFT JOIN public.description d ON m.wikidataId = d.wikidataId
LEFT JOIN public.technicaldetails t ON m.wikidataId = t.wikidataId;

-- Trigger Function to handle the split logic
CREATE OR REPLACE FUNCTION public.fn_insert_movie_split()
RETURNS TRIGGER AS $$
DECLARE
    w_id text;
BEGIN
    -- If wikidataId is provided, use it. Otherwise, fallback to ID.
    w_id := COALESCE(NEW."wikidataId", NEW."id");

    -- 1. Insert into Movies (Upsert)
    INSERT INTO public.movies (
        "id", "wikidataId", "title", "titlePt", "originalTitle",
        "year", "language", "hasSubtitles", "posterUrl", "videoUrl", "trailerUrl", "awards"
    ) VALUES (
        NEW."id", w_id, NEW."title", NEW."titlePt", NEW."originalTitle",
        NEW."year", NEW."language", NEW."hasSubtitles", NEW."posterUrl", NEW."videoUrl", NEW."trailerUrl", NEW."awards"
    ) ON CONFLICT ("id") DO UPDATE SET
        "wikidataId" = EXCLUDED."wikidataId",
        "title" = EXCLUDED."title",
        "titlePt" = EXCLUDED."titlePt",
        "originalTitle" = EXCLUDED."originalTitle",
        "year" = EXCLUDED."year",
        "language" = EXCLUDED."language",
        "hasSubtitles" = EXCLUDED."hasSubtitles",
        "posterUrl" = EXCLUDED."posterUrl",
        "videoUrl" = EXCLUDED."videoUrl",
        "trailerUrl" = EXCLUDED."trailerUrl",
        "awards" = EXCLUDED."awards";

    -- 2. Insert into Description (Upsert)
    INSERT INTO public.description (
        "wikidataId", "title", "description", "descriptionPt", "descriptionHi", "descriptionRu", "descriptionIt"
    ) VALUES (
        w_id, NEW."title", NEW."description", NEW."descriptionPt", NEW."descriptionHi", NEW."descriptionRu", NEW."descriptionIt"
    ) ON CONFLICT ("wikidataId") DO UPDATE SET
        "description" = EXCLUDED."description",
        "descriptionPt" = EXCLUDED."descriptionPt",
        "descriptionHi" = EXCLUDED."descriptionHi",
        "descriptionRu" = EXCLUDED."descriptionRu",
        "descriptionIt" = EXCLUDED."descriptionIt";

    -- 3. Insert into TechnicalDetails (Upsert)
    INSERT INTO public.technicaldetails (
        "wikidataId", "title", "duration", "genres", "director", "type", "sourceLabel",
        "cast_members", "cinematographers", "composers", "themes", "rating"
    ) VALUES (
        w_id, NEW."title", NEW."duration", NEW."genres", NEW."director", NEW."type", NEW."sourceLabel",
        NEW."cast_members", NEW."cinematographers", NEW."composers", NEW."themes", NEW."rating"
    ) ON CONFLICT ("wikidataId") DO UPDATE SET
        "duration" = EXCLUDED."duration",
        "genres" = EXCLUDED."genres",
        "director" = EXCLUDED."director",
        "type" = EXCLUDED."type",
        "sourceLabel" = EXCLUDED."sourceLabel",
        "cast_members" = EXCLUDED."cast_members",
        "cinematographers" = EXCLUDED."cinematographers",
        "composers" = EXCLUDED."composers",
        "themes" = EXCLUDED."themes",
        "rating" = EXCLUDED."rating";

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply Trigger
CREATE TRIGGER tr_split_movie_insert
INSTEAD OF INSERT ON public.legacy_movies_sink
FOR EACH ROW EXECUTE FUNCTION public.fn_insert_movie_split();


-- ============================================================
-- 5. USER INTERACTIONS (Favorites, Watchlist, History)
-- ============================================================
-- This table stores user specific data linked to auth.users

CREATE TABLE IF NOT EXISTS public.user_movie_interactions (
    "user_id" uuid REFERENCES auth.users NOT NULL,
    "movie_id" text NOT NULL,
    "is_favorite" boolean DEFAULT false,
    "is_watched" boolean DEFAULT false,
    "watch_later" boolean DEFAULT false,
    "progress_seconds" integer DEFAULT 0,
    "last_updated_at" timestamptz DEFAULT now(),
    PRIMARY KEY ("user_id", "movie_id")
);

-- Enable RLS
ALTER TABLE public.user_movie_interactions ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own data
DROP POLICY IF EXISTS "Users view own interactions" ON public.user_movie_interactions;
CREATE POLICY "Users view own interactions" 
ON public.user_movie_interactions FOR SELECT 
USING (auth.uid() = user_id);

-- Policy: Users can insert/update their own data
DROP POLICY IF EXISTS "Users update own interactions" ON public.user_movie_interactions;
CREATE POLICY "Users update own interactions" 
ON public.user_movie_interactions FOR ALL 
USING (auth.uid() = user_id);
