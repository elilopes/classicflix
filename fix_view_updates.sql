-- ==============================================================================
-- FIX FINAL: REMOÇÃO TOTAL DE DESCRIÇÕES E ID DA VIEW E TRIGGERS
-- ==============================================================================

-- 1. Recriar a View incluindo todas as colunas necessárias para o frontend
DROP VIEW IF EXISTS public.legacy_movies_sink CASCADE;

CREATE OR REPLACE VIEW public.legacy_movies_sink AS
SELECT
    m."id",
    m."wikidataid" AS "wikidataid", 
    m."title", 
    m."titlept" AS "titlept",
    m."originaltitle" AS "originaltitle",
    d."descriptionen" AS "description",
    d."descriptionpt" AS "descriptionpt",
    t."genres", 
    m."year", 
    m."language", 
    m."hassubtitles" AS "hassubtitles",
    m."subtitleurl" AS "subtitleurl",
    m."posterurl" AS "posterurl",
    m."videourl" AS "videourl",
    m."trailerurl" AS "trailerurl",
    t."rating",
    t."duration", 
    t."director", 
    t."type",
    t."castmembers" AS "cast_members",
    m."awards",
    t."cinematographers", 
    t."composers", 
    t."themes",
    m."popularity"
FROM public.movies m
LEFT JOIN public.technicaldetails t ON m."wikidataid" = t."wikidataid"
LEFT JOIN public.description d ON m."wikidataid" = d."wikidataid";

-- 2. Atualizar a função de INSERT para incluir todas as colunas
CREATE OR REPLACE FUNCTION public.fn_insert_movie_split()
RETURNS TRIGGER AS $$
DECLARE
    w_id text;
BEGIN
    w_id := NEW.wikidataid;

    -- Insere na tabela movies
    INSERT INTO public.movies (
        "wikidataid", "title", "titlept", "originaltitle", "year", "language", 
        "hassubtitles", "subtitleurl", "posterurl", "videourl", "trailerurl", 
        "awards", "popularity"
    ) VALUES (
        w_id, NEW.title, NEW.titlept, NEW.originaltitle, NEW.year, NEW.language, 
        NEW.hassubtitles, NEW.subtitleurl, NEW.posterurl, NEW.videourl, NEW.trailerurl, 
        NEW.awards, COALESCE(NEW.popularity, 0)
    ) ON CONFLICT ("wikidataid") DO UPDATE SET 
        "title" = EXCLUDED."title",
        "titlept" = EXCLUDED."titlept",
        "originaltitle" = EXCLUDED."originaltitle",
        "year" = EXCLUDED."year",
        "language" = EXCLUDED."language",
        "hassubtitles" = EXCLUDED."hassubtitles",
        "subtitleurl" = EXCLUDED."subtitleurl",
        "posterurl" = EXCLUDED."posterurl",
        "videourl" = EXCLUDED."videourl",
        "trailerurl" = EXCLUDED."trailerurl",
        "awards" = EXCLUDED."awards";

    -- Insere na tabela description
    INSERT INTO public.description (
        "wikidataid", "title", "descriptionen", "descriptionpt"
    ) VALUES (
        w_id, NEW.title, NEW.description, NEW.descriptionpt
    ) ON CONFLICT ("wikidataid") DO UPDATE SET
        "descriptionen" = EXCLUDED."descriptionen",
        "descriptionpt" = EXCLUDED."descriptionpt";

    -- Insere na tabela technicaldetails
    INSERT INTO public.technicaldetails (
        "wikidataid", "title", "duration", "genres", "director", "type",
        "castmembers", "cinematographers", "composers", "themes", "rating"
    ) VALUES (
        w_id, NEW.title, NEW.duration, 
        NEW.genres, 
        NEW.director, 
        NEW.type,
        NEW.cast_members,
        NEW.cinematographers, 
        NEW.composers, 
        NEW.themes,
        NEW.rating
    ) ON CONFLICT ("wikidataid") DO UPDATE SET
        "duration" = EXCLUDED."duration",
        "genres" = EXCLUDED."genres",
        "director" = EXCLUDED."director",
        "type" = EXCLUDED."type",
        "castmembers" = EXCLUDED."castmembers",
        "cinematographers" = EXCLUDED."cinematographers",
        "composers" = EXCLUDED."composers",
        "themes" = EXCLUDED."themes",
        "rating" = EXCLUDED."rating";
    
    INSERT INTO public.identifiers ("wikidataid") VALUES (w_id)
    ON CONFLICT ("wikidataid") DO NOTHING;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Atualizar a função de UPDATE para incluir todas as colunas
CREATE OR REPLACE FUNCTION public.fn_update_movie_split()
RETURNS TRIGGER AS $$
BEGIN
    -- Atualiza a tabela 'movies'
    UPDATE public.movies SET
        "title" = COALESCE(NEW.title, OLD.title),
        "titlept" = NEW.titlept,
        "originaltitle" = NEW.originaltitle,
        "year" = NEW.year,
        "language" = NEW.language,
        "hassubtitles" = NEW.hassubtitles,
        "subtitleurl" = NEW.subtitleurl,
        "posterurl" = NEW.posterurl,
        "videourl" = NEW.videourl,
        "trailerurl" = NEW.trailerurl,
        "awards" = NEW.awards,
        "popularity" = COALESCE(NEW.popularity, OLD.popularity)
    WHERE "wikidataid" = OLD.wikidataid;

    -- Atualiza a tabela 'description'
    INSERT INTO public.description ("wikidataid", "title", "descriptionen", "descriptionpt")
    VALUES (OLD.wikidataid, NEW.title, NEW.description, NEW.descriptionpt)
    ON CONFLICT ("wikidataid") DO UPDATE SET
        "descriptionen" = EXCLUDED."descriptionen",
        "descriptionpt" = EXCLUDED."descriptionpt";

    -- Atualiza a tabela 'technicaldetails'
    INSERT INTO public.technicaldetails (
        "wikidataid", "title", "duration", "genres", "director", "type",
        "castmembers", "cinematographers", "composers", "themes", "rating"
    ) VALUES (
        OLD.wikidataid, NEW.title, NEW.duration, 
        NEW.genres, 
        NEW.director, 
        NEW.type,
        NEW.cast_members,
        NEW.cinematographers, 
        NEW.composers, 
        NEW.themes,
        NEW.rating
    ) ON CONFLICT ("wikidataid") DO UPDATE SET
        "director" = EXCLUDED."director",
        "genres" = EXCLUDED."genres",
        "duration" = EXCLUDED."duration",
        "type" = EXCLUDED."type",
        "castmembers" = EXCLUDED."castmembers",
        "cinematographers" = EXCLUDED."cinematographers",
        "composers" = EXCLUDED."composers",
        "themes" = EXCLUDED."themes",
        "rating" = EXCLUDED."rating";

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Recriar os Triggers
DROP TRIGGER IF EXISTS tr_split_movie_insert ON public.legacy_movies_sink;
CREATE TRIGGER tr_split_movie_insert
INSTEAD OF INSERT ON public.legacy_movies_sink
FOR EACH ROW EXECUTE FUNCTION public.fn_insert_movie_split();

DROP TRIGGER IF EXISTS tr_split_movie_update ON public.legacy_movies_sink;
CREATE TRIGGER tr_split_movie_update
INSTEAD OF UPDATE ON public.legacy_movies_sink
FOR EACH ROW EXECUTE FUNCTION public.fn_update_movie_split();

-- 5. Recarregar o cache do schema
NOTIFY pgrst, 'reload schema';
