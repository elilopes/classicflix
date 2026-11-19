
-- ===============================================================
-- SETUP COMPLETO PARA CLASSICFLIX (SUPABASE)
-- ===============================================================
-- Execute este script no SQL Editor do seu projeto Supabase.

-- 1. Tabela de Filmes (Suporta produções oficiais e independentes)
CREATE TABLE IF NOT EXISTS public.movies (
    id TEXT PRIMARY KEY,
    wikidataid TEXT UNIQUE, -- Pode ser NULL para produções independentes
    title TEXT NOT NULL,
    titlept TEXT,
    originaltitle TEXT,
    year INTEGER,
    language TEXT,
    hassubtitles BOOLEAN DEFAULT FALSE,
    subtitleurl TEXT,
    posterurl TEXT,
    videourl TEXT,
    trailerurl TEXT,
    description TEXT,
    descriptionpt TEXT,
    duration TEXT,
    genres TEXT[],
    director TEXT,
    type TEXT DEFAULT 'Movie',
    rating TEXT,
    castmembers TEXT[],
    cinematographers TEXT[],
    composers TEXT[],
    themes TEXT[],
    awards TEXT[],
    popularity INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Tabela de Usuários (Para vincular com o Auth do Supabase)
CREATE TABLE IF NOT EXISTS public.users (
    userid UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    senha TEXT, -- Armazenado apenas para compatibilidade legada, use auth.users para login real
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Tabela de Listas de Usuários (Watchlist, Favoritos e Progresso)
CREATE TABLE IF NOT EXISTS public.userlists (
    userid UUID REFERENCES public.users(userid) ON DELETE CASCADE,
    wikidataid TEXT NOT NULL, -- ID do filme ou Wikidata ID
    iswatched BOOLEAN DEFAULT FALSE,
    isfavorite BOOLEAN DEFAULT FALSE,
    progress_seconds INTEGER DEFAULT 0,
    lastupdated TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (userid, wikidataid)
);

-- 4. Tabela de Ranking do Quiz
CREATE TABLE IF NOT EXISTS public.quizranking (
    userid UUID PRIMARY KEY REFERENCES public.users(userid) ON DELETE CASCADE,
    email TEXT NOT NULL,
    score INTEGER DEFAULT 0,
    title TEXT, -- Título do filme do quiz
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Tabela de Resenhas (Reviews)
CREATE TABLE IF NOT EXISTS public.moviereviews (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    wikidataid TEXT NOT NULL, -- Referência ao ID do filme
    userid UUID NOT NULL REFERENCES public.users(userid) ON DELETE CASCADE,
    email TEXT NOT NULL,
    rating INTEGER CHECK (rating >= 1 AND rating <= 10),
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Tabela de Comentários (Threads)
CREATE TABLE IF NOT EXISTS public.moviecomments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    reviewid UUID NOT NULL REFERENCES public.moviereviews(id) ON DELETE CASCADE,
    wikidataid TEXT NOT NULL,
    userid UUID NOT NULL REFERENCES public.users(userid) ON DELETE CASCADE,
    email TEXT NOT NULL,
    content TEXT NOT NULL,
    parent_id UUID REFERENCES public.moviecomments(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Função RPC para Popularidade
CREATE OR REPLACE FUNCTION increment_popularity(movie_id text)
RETURNS void AS $$
BEGIN
  UPDATE public.movies
  SET popularity = popularity + 1
  WHERE id = movie_id;
END;
$$ LANGUAGE plpgsql;

-- 8. Habilitar RLS (Row Level Security)
ALTER TABLE public.movies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.userlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quizranking ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moviereviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moviecomments ENABLE ROW LEVEL SECURITY;

-- 9. Políticas de Segurança (POLICIES)

-- Filmes: Leitura pública, escrita autenticada
CREATE POLICY "Public Read Movies" ON public.movies FOR SELECT USING (true);
CREATE POLICY "Auth Insert Movies" ON public.movies FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Usuários: Apenas o próprio usuário pode ver seus dados
CREATE POLICY "Users Self Read" ON public.users FOR SELECT USING (auth.uid() = userid);

-- Listas: Controle total pelo dono
CREATE POLICY "Userlists Owner Access" ON public.userlists FOR ALL USING (auth.uid() = userid);

-- Ranking: Leitura pública, escrita pelo dono
CREATE POLICY "Ranking Public Read" ON public.quizranking FOR SELECT USING (true);
CREATE POLICY "Ranking Owner Update" ON public.quizranking FOR ALL USING (auth.uid() = userid);

-- Resenhas: Leitura pública, escrita pelo dono
CREATE POLICY "Reviews Public Read" ON public.moviereviews FOR SELECT USING (true);
CREATE POLICY "Reviews Owner Insert" ON public.moviereviews FOR INSERT WITH CHECK (auth.uid() = userid);
CREATE POLICY "Reviews Owner Delete" ON public.moviereviews FOR DELETE USING (auth.uid() = userid);

-- Comentários: Leitura pública, escrita pelo dono
CREATE POLICY "Comments Public Read" ON public.moviecomments FOR SELECT USING (true);
CREATE POLICY "Comments Owner Insert" ON public.moviecomments FOR INSERT WITH CHECK (auth.uid() = userid);
CREATE POLICY "Comments Owner Delete" ON public.moviecomments FOR DELETE USING (auth.uid() = userid);

-- 10. Trigger para Sincronização de Usuários (Opcional mas recomendado)
-- Este trigger cria automaticamente uma entrada na tabela public.users quando um novo usuário se cadastra no Auth
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.users (userid, email)
  VALUES (new.id, new.email);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- 11. Tabelas complementares utilizadas pelo importador Wikidata.
-- A criação é não destrutiva: tabelas e dados existentes são preservados.
CREATE TABLE IF NOT EXISTS public.description (
    wikidataid TEXT PRIMARY KEY REFERENCES public.movies(wikidataid) ON DELETE CASCADE,
    id TEXT,
    title TEXT,
    descriptionen TEXT,
    descriptionpt TEXT,
    descriptionhi TEXT,
    descriptionru TEXT,
    descriptionit TEXT
);

CREATE TABLE IF NOT EXISTS public.technicaldetails (
    wikidataid TEXT PRIMARY KEY REFERENCES public.movies(wikidataid) ON DELETE CASCADE,
    id TEXT,
    title TEXT,
    duration TEXT,
    genres TEXT,
    director TEXT,
    sourcelabel TEXT,
    castmembers TEXT,
    cinematographers TEXT,
    composers TEXT,
    themes TEXT,
    rating TEXT
);

CREATE TABLE IF NOT EXISTS public.identifiers (
    wikidataid TEXT PRIMARY KEY REFERENCES public.movies(wikidataid) ON DELETE CASCADE,
    archiveid TEXT,
    imdbid TEXT,
    omdbid TEXT,
    openmdbid TEXT,
    googleknowid TEXT,
    ofdbid TEXT,
    commons TEXT,
    youtube TEXT,
    updatedat TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.description ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.technicaldetails ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.identifiers ENABLE ROW LEVEL SECURITY;

DO $policies$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='description' AND policyname='ClassicFlix public read descriptions') THEN
        CREATE POLICY "ClassicFlix public read descriptions" ON public.description FOR SELECT TO public USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='technicaldetails' AND policyname='ClassicFlix public read technical details') THEN
        CREATE POLICY "ClassicFlix public read technical details" ON public.technicaldetails FOR SELECT TO public USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='identifiers' AND policyname='ClassicFlix public read identifiers') THEN
        CREATE POLICY "ClassicFlix public read identifiers" ON public.identifiers FOR SELECT TO public USING (true);
    END IF;
END;
$policies$;

-- A função de importação é instalada pela migration
-- supabase/migrations/20261119000100_atomic_wikidata_movie_import.sql.


-- 12. RPC atômica usada pelo importador Wikidata.
-- Em instalações novas, execute também a migration versionada em supabase/migrations.
CREATE OR REPLACE FUNCTION public.classicflix_import_movie_atomic(p_movie jsonb, p_description jsonb, p_technicaldetails jsonb, p_identifiers jsonb DEFAULT '{}'::jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE v_qid text;
BEGIN
  IF auth.uid() IS NULL OR COALESCE(auth.jwt() ->> 'email', '') <> 'liclopes@gmail.com' THEN
    RAISE EXCEPTION 'Apenas o administrador do ClassicFlix pode importar produções.' USING ERRCODE = '42501';
  END IF;
  v_qid := NULLIF(BTRIM(p_movie ->> 'wikidataid'), '');
  IF v_qid IS NULL THEN RAISE EXCEPTION 'wikidataid é obrigatório.' USING ERRCODE = '22023'; END IF;

  INSERT INTO public.movies AS current_movie (
    id, wikidataid, title, titlept, originaltitle, year, language, hassubtitles,
    posterurl, videourl, trailerurl, subtitleurl, description, type, awards, popularity
  ) VALUES (
    COALESCE(NULLIF(p_movie ->> 'id', ''), substr(md5(v_qid), 1, 12)), v_qid,
    COALESCE(NULLIF(p_movie ->> 'title', ''), v_qid), NULLIF(p_movie ->> 'titlept', ''),
    NULLIF(p_movie ->> 'originaltitle', ''), NULLIF(p_movie ->> 'year', '')::integer,
    NULLIF(p_movie ->> 'language', ''), COALESCE(NULLIF(p_movie ->> 'hassubtitles', '')::boolean, false),
    NULLIF(p_movie ->> 'posterurl', ''), NULLIF(p_movie ->> 'videourl', ''),
    NULLIF(p_movie ->> 'trailerurl', ''), NULLIF(p_movie ->> 'subtitleurl', ''),
    NULLIF(p_movie ->> 'description', ''), COALESCE(NULLIF(p_movie ->> 'type', ''), 'film'),
    NULLIF(p_movie ->> 'awards', ''), COALESCE(NULLIF(p_movie ->> 'popularity', '')::integer, 0)
  )
  ON CONFLICT (wikidataid) DO UPDATE SET
    id = current_movie.id,
    title = COALESCE(current_movie.title, EXCLUDED.title),
    titlept = COALESCE(current_movie.titlept, EXCLUDED.titlept),
    originaltitle = COALESCE(current_movie.originaltitle, EXCLUDED.originaltitle),
    year = COALESCE(current_movie.year, EXCLUDED.year),
    language = COALESCE(current_movie.language, EXCLUDED.language),
    hassubtitles = COALESCE(NULLIF(p_movie ->> 'hassubtitles', '')::boolean, current_movie.hassubtitles),
    posterurl = COALESCE(current_movie.posterurl, EXCLUDED.posterurl),
    videourl = COALESCE(current_movie.videourl, EXCLUDED.videourl),
    trailerurl = COALESCE(current_movie.trailerurl, EXCLUDED.trailerurl),
    subtitleurl = COALESCE(current_movie.subtitleurl, EXCLUDED.subtitleurl),
    description = COALESCE(current_movie.description, EXCLUDED.description),
    type = COALESCE(current_movie.type, EXCLUDED.type),
    awards = COALESCE(current_movie.awards, EXCLUDED.awards),
    popularity = GREATEST(COALESCE(current_movie.popularity, 0), COALESCE(EXCLUDED.popularity, 0));

  INSERT INTO public.description AS current_description (
    wikidataid, id, title, descriptionen, descriptionpt, descriptionhi, descriptionru, descriptionit
  ) VALUES (
    v_qid, NULLIF(p_description ->> 'id', ''), NULLIF(p_description ->> 'title', ''),
    NULLIF(p_description ->> 'descriptionen', ''), NULLIF(p_description ->> 'descriptionpt', ''),
    NULLIF(p_description ->> 'descriptionhi', ''), NULLIF(p_description ->> 'descriptionru', ''),
    NULLIF(p_description ->> 'descriptionit', '')
  )
  ON CONFLICT (wikidataid) DO UPDATE SET
    id = COALESCE(current_description.id, EXCLUDED.id),
    title = COALESCE(current_description.title, EXCLUDED.title),
    descriptionen = COALESCE(current_description.descriptionen, EXCLUDED.descriptionen),
    descriptionpt = COALESCE(current_description.descriptionpt, EXCLUDED.descriptionpt),
    descriptionhi = COALESCE(current_description.descriptionhi, EXCLUDED.descriptionhi),
    descriptionru = COALESCE(current_description.descriptionru, EXCLUDED.descriptionru),
    descriptionit = COALESCE(current_description.descriptionit, EXCLUDED.descriptionit);

  INSERT INTO public.technicaldetails AS current_technicaldetails (
    wikidataid, id, title, duration, genres, director, sourcelabel,
    castmembers, cinematographers, composers, themes, rating
  ) VALUES (
    v_qid, NULLIF(p_technicaldetails ->> 'id', ''), NULLIF(p_technicaldetails ->> 'title', ''),
    NULLIF(p_technicaldetails ->> 'duration', ''), NULLIF(p_technicaldetails ->> 'genres', ''),
    NULLIF(p_technicaldetails ->> 'director', ''), NULLIF(p_technicaldetails ->> 'sourcelabel', ''),
    NULLIF(p_technicaldetails ->> 'castmembers', ''), NULLIF(p_technicaldetails ->> 'cinematographers', ''),
    NULLIF(p_technicaldetails ->> 'composers', ''), NULLIF(p_technicaldetails ->> 'themes', ''),
    NULLIF(p_technicaldetails ->> 'rating', '')
  )
  ON CONFLICT (wikidataid) DO UPDATE SET
    id = COALESCE(current_technicaldetails.id, EXCLUDED.id),
    title = COALESCE(current_technicaldetails.title, EXCLUDED.title),
    duration = COALESCE(current_technicaldetails.duration, EXCLUDED.duration),
    genres = COALESCE(current_technicaldetails.genres, EXCLUDED.genres),
    director = COALESCE(current_technicaldetails.director, EXCLUDED.director),
    sourcelabel = COALESCE(current_technicaldetails.sourcelabel, EXCLUDED.sourcelabel),
    castmembers = COALESCE(current_technicaldetails.castmembers, EXCLUDED.castmembers),
    cinematographers = COALESCE(current_technicaldetails.cinematographers, EXCLUDED.cinematographers),
    composers = COALESCE(current_technicaldetails.composers, EXCLUDED.composers),
    themes = COALESCE(current_technicaldetails.themes, EXCLUDED.themes),
    rating = COALESCE(current_technicaldetails.rating, EXCLUDED.rating);

  IF jsonb_strip_nulls(COALESCE(p_identifiers, '{}'::jsonb)) <> '{}'::jsonb THEN
    INSERT INTO public.identifiers AS current_identifiers (
      wikidataid, archiveid, imdbid, omdbid, openmdbid, googleknowid, ofdbid, commons, youtube, updatedat
    ) VALUES (
      v_qid, NULLIF(p_identifiers ->> 'archiveid', ''), NULLIF(p_identifiers ->> 'imdbid', ''),
      NULLIF(p_identifiers ->> 'omdbid', ''), NULLIF(p_identifiers ->> 'openmdbid', ''),
      NULLIF(p_identifiers ->> 'googleknowid', ''), NULLIF(p_identifiers ->> 'ofdbid', ''),
      NULLIF(p_identifiers ->> 'commons', ''), NULLIF(p_identifiers ->> 'youtube', ''), now()
    )
    ON CONFLICT (wikidataid) DO UPDATE SET
      archiveid = COALESCE(current_identifiers.archiveid, EXCLUDED.archiveid),
      imdbid = COALESCE(current_identifiers.imdbid, EXCLUDED.imdbid),
      omdbid = COALESCE(current_identifiers.omdbid, EXCLUDED.omdbid),
      openmdbid = COALESCE(current_identifiers.openmdbid, EXCLUDED.openmdbid),
      googleknowid = COALESCE(current_identifiers.googleknowid, EXCLUDED.googleknowid),
      ofdbid = COALESCE(current_identifiers.ofdbid, EXCLUDED.ofdbid),
      commons = COALESCE(current_identifiers.commons, EXCLUDED.commons),
      youtube = COALESCE(current_identifiers.youtube, EXCLUDED.youtube),
      updatedat = now();
  END IF;
END;
$function$

REVOKE ALL ON FUNCTION public.classicflix_import_movie_atomic(jsonb,jsonb,jsonb,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.classicflix_import_movie_atomic(jsonb,jsonb,jsonb,jsonb) TO authenticated;
