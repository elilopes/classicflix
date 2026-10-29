
-- 1. LIMPEZA TOTAL
DROP TRIGGER IF EXISTS tr_split_movie_insert ON public.legacy_movies_sink;
DROP FUNCTION IF EXISTS public.fn_insert_movie_split() CASCADE;
DROP VIEW IF EXISTS public.legacy_movies_sink;

-- 2. CRIAÇÃO DAS TABELAS COM NOVOS NOMES DE COLUNA
CREATE TABLE IF NOT EXISTS public.movies (
    "id" text PRIMARY KEY,
    "wikidataid" text UNIQUE,
    "title" text NOT NULL,
    "titlept" text,
    "originaltitle" text,
    "year" integer,
    "language" text,
    "hassubtitles" boolean,
    "posterurl" text,
    "videourl" text,
    "trailerurl" text,
    "subtitleurl" text,
    "awards" text[],
    "cinematographers" text[],
    "composers" text[],
    "themes" text[],
    "popularity" integer DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.description (
    "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    "wikidataid" text REFERENCES public.movies("wikidataid") ON DELETE CASCADE,
    "title" text,
    "descriptionen" text,
    "descriptionpt" text,
    "descriptionhi" text,
    "descriptionru" text,
    "descriptionit" text,
    CONSTRAINT uniq_desc_wiki UNIQUE("wikidataid")
);

CREATE TABLE IF NOT EXISTS public.technicaldetails (
    "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    "wikidataid" text REFERENCES public.movies("wikidataid") ON DELETE CASCADE,
    "title" text,
    "duration" text,
    "genres" text[],
    "director" text,
    "type" text,
    "sourcelabel" text,
    "castmembers" text[],
    "cinematographers" text[],
    "composers" text[],
    "themes" text[],
    "rating" text,
    CONSTRAINT uniq_tech_wiki UNIQUE("wikidataid")
);

CREATE TABLE IF NOT EXISTS public.identifiers (
    "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    "wikidataid" text REFERENCES public.movies("wikidataid") ON DELETE CASCADE,
    "archiveid" text,
    "imdbid" text,
    "omdbid" text,
    "googleknowid" text,
    "ofdbid" text,
    "openmdbid" text,
    CONSTRAINT uniq_ident_wiki UNIQUE("wikidataid")
);

CREATE TABLE IF NOT EXISTS public.users (
    "userid" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    "email" text UNIQUE NOT NULL,
    "senha" text NOT NULL
);

CREATE TABLE IF NOT EXISTS public.userlists (
    "userid" uuid REFERENCES public.users("userid") NOT NULL,
    "wikidataid" text REFERENCES public.movies("wikidataid") ON DELETE CASCADE,
    "iswatched" boolean DEFAULT false,
    "isfavorite" boolean DEFAULT false,
    "progress_seconds" integer DEFAULT 0,
    "lastupdated" timestamp with time zone DEFAULT now(),
    PRIMARY KEY ("userid", "wikidataid")
);

-- FUNÇÃO RPC PARA INCREMENTAR POPULARIDADE
CREATE OR REPLACE FUNCTION increment_popularity(movie_id text)
RETURNS void AS $$
BEGIN
  UPDATE public.movies
  SET popularity = popularity + 1
  WHERE id = movie_id;
END;
$$ LANGUAGE plpgsql;

-- 3. VIEW DE COMPATIBILIDADE
CREATE OR REPLACE VIEW public.legacy_movies_sink AS
SELECT
    m."id", 
    m."wikidataid" AS "wikidataid", 
    m."title", 
    m."titlept" AS "titlept", 
    m."originaltitle" AS "originaltitle",
    d."descriptionen" AS "description", 
    d."descriptionpt" AS "descriptionpt", 
    d."descriptionhi" AS "descriptionhi", 
    d."descriptionru" AS "descriptionru", 
    d."descriptionit" AS "descriptionit",
    t."genres", 
    m."year", 
    m."language", 
    m."hassubtitles" AS "hassubtitles", 
    m."posterurl" AS "posterurl", 
    m."videourl" AS "videourl", 
    m."trailerurl" AS "trailerurl",
    m."subtitleurl" AS "subtitleurl",
    t."rating", 
    t."duration", 
    t."director", 
    t."type", 
    t."sourcelabel" AS "sourcelabel", 
    t."castmembers" AS "cast_members", 
    m."awards",
    t."cinematographers", 
    t."composers", 
    t."themes",
    m."popularity"
FROM public.movies m
LEFT JOIN public.description d ON m."wikidataid" = d."wikidataid"
LEFT JOIN public.technicaldetails t ON m."wikidataid" = t."wikidataid";

-- 4. PERMISSÕES EXPLÍCITAS (Essencial para resolver o erro de schema cache)
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
ALTER VIEW public.legacy_movies_sink OWNER TO postgres;
GRANT SELECT ON public.legacy_movies_sink TO anon, authenticated;

-- 5. FUNÇÃO DO TRIGGER CORRIGIDA
CREATE OR REPLACE FUNCTION public.fn_insert_movie_split()
RETURNS TRIGGER AS $$
DECLARE
    w_id text;
BEGIN
    w_id := COALESCE(NEW.wikidataid, NEW.id);

    INSERT INTO public.movies (
        "id", "wikidataid", "title", "titlept", "originaltitle", 
        "year", "language", "hassubtitles", "posterurl", "videourl", "trailerurl", "subtitleurl", "awards",
        "cinematographers", "composers", "themes", "popularity"
    ) VALUES (
        NEW.id, w_id, NEW.title, NEW.titlept, NEW.originaltitle, 
        NEW.year, NEW.language, NEW.hassubtitles, NEW.posterurl, NEW.videourl, NEW.trailerurl, NEW.subtitleurl, NEW.awards,
        NEW.cinematographers, NEW.composers, NEW.themes, COALESCE(NEW.popularity, 0)
    ) ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title";

    INSERT INTO public.description (
        "wikidataid", "title", "descriptionen", "descriptionpt", "descriptionhi", "descriptionru", "descriptionit"
    ) VALUES (
        w_id, NEW.title, NEW.description, NEW.descriptionpt, NEW.descriptionhi, NEW.descriptionru, NEW.descriptionit
    ) ON CONFLICT ("wikidataid") DO NOTHING;

    INSERT INTO public.technicaldetails (
        "wikidataid", "title", "duration", "genres", "director", "type", "sourcelabel", 
        "castmembers", "cinematographers", "composers", "themes", "rating"
    ) VALUES (
        w_id, NEW.title, NEW.duration, NEW.genres, NEW.director, NEW.type, NEW.sourcelabel, 
        NEW.cast_members, NEW.cinematographers, NEW.composers, NEW.themes, NEW.rating
    ) ON CONFLICT ("wikidataid") DO NOTHING;
    
    INSERT INTO public.identifiers ("wikidataid") VALUES (w_id)
    ON CONFLICT ("wikidataid") DO NOTHING;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 6. APLICAÇÃO DO TRIGGER NA VIEW
CREATE TRIGGER tr_split_movie_insert
INSTEAD OF INSERT ON public.legacy_movies_sink
FOR EACH ROW EXECUTE FUNCTION public.fn_insert_movie_split();
