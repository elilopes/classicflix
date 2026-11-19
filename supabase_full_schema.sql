
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
-- supabase/migrations/20261119210000_atomic_wikidata_movie_import.sql.


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


-- 13. Revisão seletiva, fontes complementares e histórico detalhado do importador Wikidata.
-- Este bloco é aditivo e preserva os dados das tabelas já existentes.
-- ClassicFlix: revisão seletiva, enriquecimento de fontes e auditoria.
-- Migração aditiva: não remove nem reescreve registros existentes.
ALTER TABLE public.identifiers ADD COLUMN IF NOT EXISTS tmdbid text;

CREATE TABLE IF NOT EXISTS public.import_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL DEFAULT 'wikidata',
  action text NOT NULL CHECK (action IN ('insert','update')),
  requested_by uuid,
  requested_email text NOT NULL,
  status text NOT NULL DEFAULT 'completed',
  item_count integer NOT NULL DEFAULT 1,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.metadata_history (
  id bigserial PRIMARY KEY,
  import_job_id uuid NOT NULL REFERENCES public.import_jobs(id) ON DELETE CASCADE,
  wikidataid text NOT NULL REFERENCES public.movies(wikidataid) ON DELETE CASCADE,
  field_name text NOT NULL,
  old_value jsonb,
  new_value jsonb,
  source text NOT NULL DEFAULT 'wikidata',
  source_url text,
  actor_id uuid,
  actor_email text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.movie_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wikidataid text NOT NULL REFERENCES public.movies(wikidataid) ON DELETE CASCADE,
  media_type text NOT NULL CHECK (media_type IN ('poster','still','video','trailer')),
  source text NOT NULL CHECK (source IN ('wikidata','commons','archive','tmdb','youtube')),
  source_id text NOT NULL,
  url text NOT NULL,
  page_url text,
  license text,
  attribution text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (wikidataid, source, source_id)
);

CREATE INDEX IF NOT EXISTS idx_metadata_history_qid_created
  ON public.metadata_history (wikidataid, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_import_jobs_created
  ON public.import_jobs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_movie_media_qid_type
  ON public.movie_media (wikidataid, media_type);

ALTER TABLE public.import_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.metadata_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.movie_media ENABLE ROW LEVEL SECURITY;

DO $policies$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='import_jobs' AND policyname='ClassicFlix admin reads import jobs') THEN
    CREATE POLICY "ClassicFlix admin reads import jobs" ON public.import_jobs
      FOR SELECT TO authenticated USING ((auth.jwt() ->> 'email') = 'liclopes@gmail.com');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='metadata_history' AND policyname='ClassicFlix admin reads metadata history') THEN
    CREATE POLICY "ClassicFlix admin reads metadata history" ON public.metadata_history
      FOR SELECT TO authenticated USING ((auth.jwt() ->> 'email') = 'liclopes@gmail.com');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='movie_media' AND policyname='ClassicFlix admin reads movie media') THEN
    CREATE POLICY "ClassicFlix admin reads movie media" ON public.movie_media
      FOR SELECT TO authenticated USING ((auth.jwt() ->> 'email') = 'liclopes@gmail.com');
  END IF;
END;
$policies$;

GRANT SELECT ON public.import_jobs, public.metadata_history, public.movie_media TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.metadata_history_id_seq TO authenticated;

CREATE OR REPLACE FUNCTION public.classicflix_import_movie_with_history(
  p_action text,
  p_movie jsonb,
  p_description jsonb,
  p_technicaldetails jsonb,
  p_identifiers jsonb,
  p_selected_fields text[],
  p_sources jsonb DEFAULT '{}'::jsonb,
  p_media jsonb DEFAULT '[]'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_qid text;
  v_job_id uuid;
  v_email text;
  v_old_movie jsonb := '{}'::jsonb;
  v_old_description jsonb := '{}'::jsonb;
  v_old_technical jsonb := '{}'::jsonb;
  v_old_identifiers jsonb := '{}'::jsonb;
  v_new_movie jsonb := '{}'::jsonb;
  v_new_description jsonb := '{}'::jsonb;
  v_new_technical jsonb := '{}'::jsonb;
  v_new_identifiers jsonb := '{}'::jsonb;
  v_field text;
  v_old jsonb;
  v_new jsonb;
  v_source text;
  v_source_url text;
  v_media jsonb;
  v_source_id text;
BEGIN
  v_email := COALESCE(auth.jwt() ->> 'email', '');
  IF auth.uid() IS NULL OR v_email <> 'liclopes@gmail.com' THEN
    RAISE EXCEPTION 'Apenas o administrador do ClassicFlix pode importar ou atualizar produções.' USING ERRCODE = '42501';
  END IF;

  v_qid := upper(NULLIF(btrim(p_movie ->> 'wikidataid'), ''));
  IF v_qid IS NULL OR v_qid !~ '^Q[0-9]+$' THEN
    RAISE EXCEPTION 'QID do Wikidata inválido ou ausente.' USING ERRCODE = '22023';
  END IF;
  IF p_action NOT IN ('insert','update') THEN
    RAISE EXCEPTION 'Ação de importação inválida.' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1 FROM unnest(COALESCE(p_selected_fields, ARRAY[]::text[])) f
    WHERE f NOT IN ('title','titlePt','originalTitle','year','language','posterUrl','videoUrl','trailerUrl',
                    'descriptionEn','descriptionPt','director','duration','genres','themes','license','identifiers')
  ) THEN
    RAISE EXCEPTION 'A seleção contém campos não permitidos.' USING ERRCODE = '22023';
  END IF;

  SELECT to_jsonb(m) INTO v_old_movie
  FROM public.movies m WHERE upper(m.wikidataid) = v_qid FOR UPDATE;

  IF p_action = 'insert' AND v_old_movie IS NOT NULL THEN
    RAISE EXCEPTION 'A produção % já existe. Abra a revisão seletiva para atualizar.', v_qid USING ERRCODE = '23505';
  ELSIF p_action = 'update' AND v_old_movie IS NULL THEN
    RAISE EXCEPTION 'A produção % não existe no catálogo; use a importação de nova produção.', v_qid USING ERRCODE = 'P0002';
  END IF;

  SELECT to_jsonb(d) INTO v_old_description FROM public.description d WHERE upper(d.wikidataid) = v_qid;
  SELECT to_jsonb(t) INTO v_old_technical FROM public.technicaldetails t WHERE upper(t.wikidataid) = v_qid;
  SELECT to_jsonb(i) INTO v_old_identifiers FROM public.identifiers i WHERE upper(i.wikidataid) = v_qid;

  INSERT INTO public.import_jobs (source, action, requested_by, requested_email, status, item_count, details)
  VALUES ('wikidata', p_action, auth.uid(), v_email, 'completed', 1,
          jsonb_build_object('wikidataid', v_qid, 'selected_fields', COALESCE(p_selected_fields, ARRAY[]::text[])))
  RETURNING id INTO v_job_id;

  IF p_action = 'insert' THEN
    PERFORM public.classicflix_import_movie_atomic(
      p_movie, p_description, p_technicaldetails, COALESCE(p_identifiers, '{}'::jsonb)
    );
  ELSE
    UPDATE public.movies SET
      title = CASE WHEN 'title' = ANY(p_selected_fields) THEN COALESCE(NULLIF(p_movie ->> 'title',''), title) ELSE title END,
      titlept = CASE WHEN 'titlePt' = ANY(p_selected_fields) THEN COALESCE(NULLIF(p_movie ->> 'titlept',''), titlept) ELSE titlept END,
      originaltitle = CASE WHEN 'originalTitle' = ANY(p_selected_fields) THEN COALESCE(NULLIF(p_movie ->> 'originaltitle',''), originaltitle) ELSE originaltitle END,
      year = CASE WHEN 'year' = ANY(p_selected_fields) THEN COALESCE(NULLIF(p_movie ->> 'year','')::integer, year) ELSE year END,
      language = CASE WHEN 'language' = ANY(p_selected_fields) THEN COALESCE(NULLIF(p_movie ->> 'language',''), language) ELSE language END,
      posterurl = CASE WHEN 'posterUrl' = ANY(p_selected_fields) THEN COALESCE(NULLIF(p_movie ->> 'posterurl',''), posterurl) ELSE posterurl END,
      videourl = CASE WHEN 'videoUrl' = ANY(p_selected_fields) THEN COALESCE(NULLIF(p_movie ->> 'videourl',''), videourl) ELSE videourl END,
      trailerurl = CASE WHEN 'trailerUrl' = ANY(p_selected_fields) THEN COALESCE(NULLIF(p_movie ->> 'trailerurl',''), trailerurl) ELSE trailerurl END,
      description = CASE WHEN 'descriptionEn' = ANY(p_selected_fields) THEN COALESCE(NULLIF(p_movie ->> 'description',''), description) ELSE description END
    WHERE upper(wikidataid) = v_qid;

    IF p_selected_fields && ARRAY['descriptionEn','descriptionPt']::text[] THEN
      INSERT INTO public.description (wikidataid, id, title, descriptionen, descriptionpt, descriptionhi, descriptionru, descriptionit)
      VALUES (v_qid, NULLIF(p_description ->> 'id',''), NULLIF(p_description ->> 'title',''),
              CASE WHEN 'descriptionEn' = ANY(p_selected_fields) THEN NULLIF(p_description ->> 'descriptionen','') END,
              CASE WHEN 'descriptionPt' = ANY(p_selected_fields) THEN NULLIF(p_description ->> 'descriptionpt','') END,
              NULL, NULL, NULL)
      ON CONFLICT (wikidataid) DO UPDATE SET
        descriptionen = CASE WHEN 'descriptionEn' = ANY(p_selected_fields) THEN COALESCE(EXCLUDED.descriptionen, description.descriptionen) ELSE description.descriptionen END,
        descriptionpt = CASE WHEN 'descriptionPt' = ANY(p_selected_fields) THEN COALESCE(EXCLUDED.descriptionpt, description.descriptionpt) ELSE description.descriptionpt END;
    END IF;

    IF p_selected_fields && ARRAY['director','duration','genres','themes','license']::text[] THEN
      INSERT INTO public.technicaldetails (wikidataid, id, title, duration, genres, director, sourcelabel, themes)
      VALUES (v_qid, NULLIF(p_technicaldetails ->> 'id',''), NULLIF(p_technicaldetails ->> 'title',''),
              CASE WHEN 'duration' = ANY(p_selected_fields) THEN NULLIF(p_technicaldetails ->> 'duration','') END,
              CASE WHEN 'genres' = ANY(p_selected_fields) THEN NULLIF(p_technicaldetails ->> 'genres','') END,
              CASE WHEN 'director' = ANY(p_selected_fields) THEN NULLIF(p_technicaldetails ->> 'director','') END,
              CASE WHEN 'license' = ANY(p_selected_fields) THEN NULLIF(p_technicaldetails ->> 'sourcelabel','') END,
              CASE WHEN 'themes' = ANY(p_selected_fields) THEN NULLIF(p_technicaldetails ->> 'themes','') END)
      ON CONFLICT (wikidataid) DO UPDATE SET
        duration = CASE WHEN 'duration' = ANY(p_selected_fields) THEN COALESCE(EXCLUDED.duration, technicaldetails.duration) ELSE technicaldetails.duration END,
        genres = CASE WHEN 'genres' = ANY(p_selected_fields) THEN COALESCE(EXCLUDED.genres, technicaldetails.genres) ELSE technicaldetails.genres END,
        director = CASE WHEN 'director' = ANY(p_selected_fields) THEN COALESCE(EXCLUDED.director, technicaldetails.director) ELSE technicaldetails.director END,
        sourcelabel = CASE WHEN 'license' = ANY(p_selected_fields) THEN COALESCE(EXCLUDED.sourcelabel, technicaldetails.sourcelabel) ELSE technicaldetails.sourcelabel END,
        themes = CASE WHEN 'themes' = ANY(p_selected_fields) THEN COALESCE(EXCLUDED.themes, technicaldetails.themes) ELSE technicaldetails.themes END;
    END IF;

    IF 'identifiers' = ANY(p_selected_fields) THEN
      INSERT INTO public.identifiers (wikidataid, archiveid, imdbid, omdbid, openmdbid, googleknowid, ofdbid, commons, youtube, tmdbid, updatedat)
      VALUES (v_qid, NULLIF(p_identifiers ->> 'archiveid',''), NULLIF(p_identifiers ->> 'imdbid',''),
              NULLIF(p_identifiers ->> 'omdbid',''), NULLIF(p_identifiers ->> 'openmdbid',''),
              NULLIF(p_identifiers ->> 'googleknowid',''), NULLIF(p_identifiers ->> 'ofdbid',''),
              NULLIF(p_identifiers ->> 'commons',''), NULLIF(p_identifiers ->> 'youtube',''),
              NULLIF(p_identifiers ->> 'tmdbid',''), now())
      ON CONFLICT (wikidataid) DO UPDATE SET
        archiveid = COALESCE(EXCLUDED.archiveid, identifiers.archiveid),
        imdbid = COALESCE(EXCLUDED.imdbid, identifiers.imdbid),
        omdbid = COALESCE(EXCLUDED.omdbid, identifiers.omdbid),
        openmdbid = COALESCE(EXCLUDED.openmdbid, identifiers.openmdbid),
        googleknowid = COALESCE(EXCLUDED.googleknowid, identifiers.googleknowid),
        ofdbid = COALESCE(EXCLUDED.ofdbid, identifiers.ofdbid),
        commons = COALESCE(EXCLUDED.commons, identifiers.commons),
        youtube = COALESCE(EXCLUDED.youtube, identifiers.youtube),
        tmdbid = COALESCE(EXCLUDED.tmdbid, identifiers.tmdbid),
        updatedat = now();
    END IF;
  END IF;

  IF 'identifiers' = ANY(p_selected_fields) AND p_action = 'insert' AND NULLIF(p_identifiers ->> 'tmdbid','') IS NOT NULL THEN
    UPDATE public.identifiers SET tmdbid = p_identifiers ->> 'tmdbid' WHERE wikidataid = v_qid;
  END IF;

  SELECT to_jsonb(m) INTO v_new_movie FROM public.movies m WHERE upper(m.wikidataid) = v_qid;
  SELECT to_jsonb(d) INTO v_new_description FROM public.description d WHERE upper(d.wikidataid) = v_qid;
  SELECT to_jsonb(t) INTO v_new_technical FROM public.technicaldetails t WHERE upper(t.wikidataid) = v_qid;
  SELECT to_jsonb(i) INTO v_new_identifiers FROM public.identifiers i WHERE upper(i.wikidataid) = v_qid;

  FOREACH v_field IN ARRAY COALESCE(p_selected_fields, ARRAY[]::text[]) LOOP
    v_old := CASE v_field
      WHEN 'title' THEN v_old_movie -> 'title'
      WHEN 'titlePt' THEN v_old_movie -> 'titlept'
      WHEN 'originalTitle' THEN v_old_movie -> 'originaltitle'
      WHEN 'year' THEN v_old_movie -> 'year'
      WHEN 'language' THEN v_old_movie -> 'language'
      WHEN 'posterUrl' THEN v_old_movie -> 'posterurl'
      WHEN 'videoUrl' THEN v_old_movie -> 'videourl'
      WHEN 'trailerUrl' THEN v_old_movie -> 'trailerurl'
      WHEN 'descriptionEn' THEN COALESCE(v_old_description -> 'descriptionen', v_old_movie -> 'description')
      WHEN 'descriptionPt' THEN v_old_description -> 'descriptionpt'
      WHEN 'director' THEN v_old_technical -> 'director'
      WHEN 'duration' THEN v_old_technical -> 'duration'
      WHEN 'genres' THEN v_old_technical -> 'genres'
      WHEN 'themes' THEN v_old_technical -> 'themes'
      WHEN 'license' THEN v_old_technical -> 'sourcelabel'
      WHEN 'identifiers' THEN v_old_identifiers
    END;
    v_new := CASE v_field
      WHEN 'title' THEN v_new_movie -> 'title'
      WHEN 'titlePt' THEN v_new_movie -> 'titlept'
      WHEN 'originalTitle' THEN v_new_movie -> 'originaltitle'
      WHEN 'year' THEN v_new_movie -> 'year'
      WHEN 'language' THEN v_new_movie -> 'language'
      WHEN 'posterUrl' THEN v_new_movie -> 'posterurl'
      WHEN 'videoUrl' THEN v_new_movie -> 'videourl'
      WHEN 'trailerUrl' THEN v_new_movie -> 'trailerurl'
      WHEN 'descriptionEn' THEN COALESCE(v_new_description -> 'descriptionen', v_new_movie -> 'description')
      WHEN 'descriptionPt' THEN v_new_description -> 'descriptionpt'
      WHEN 'director' THEN v_new_technical -> 'director'
      WHEN 'duration' THEN v_new_technical -> 'duration'
      WHEN 'genres' THEN v_new_technical -> 'genres'
      WHEN 'themes' THEN v_new_technical -> 'themes'
      WHEN 'license' THEN v_new_technical -> 'sourcelabel'
      WHEN 'identifiers' THEN v_new_identifiers
    END;
    IF v_old IS DISTINCT FROM v_new THEN
      v_source := COALESCE(p_sources -> v_field ->> 'source', 'wikidata');
      v_source_url := p_sources -> v_field ->> 'url';
      INSERT INTO public.metadata_history
        (import_job_id, wikidataid, field_name, old_value, new_value, source, source_url, actor_id, actor_email)
      VALUES
        (v_job_id, v_qid, v_field, v_old, v_new, v_source, v_source_url, auth.uid(), v_email);
    END IF;
  END LOOP;

  FOR v_media IN SELECT value FROM jsonb_array_elements(COALESCE(p_media, '[]'::jsonb))
  LOOP
    v_source_id := COALESCE(NULLIF(v_media ->> 'source_id',''), NULLIF(v_media ->> 'url',''));
    IF v_source_id IS NOT NULL AND NULLIF(v_media ->> 'url','') IS NOT NULL THEN
      INSERT INTO public.movie_media
        (wikidataid, media_type, source, source_id, url, page_url, license, attribution, metadata)
      VALUES
        (v_qid, COALESCE(v_media ->> 'media_type','poster'), COALESCE(v_media ->> 'source','wikidata'),
         v_source_id, v_media ->> 'url', NULLIF(v_media ->> 'page_url',''),
         NULLIF(v_media ->> 'license',''), NULLIF(v_media ->> 'attribution',''),
         COALESCE(v_media -> 'metadata','{}'::jsonb))
      ON CONFLICT (wikidataid, source, source_id) DO NOTHING;
    END IF;
  END LOOP;

  RETURN v_job_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.classicflix_import_movie_with_history(text,jsonb,jsonb,jsonb,jsonb,text[],jsonb,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.classicflix_import_movie_with_history(text,jsonb,jsonb,jsonb,jsonb,text[],jsonb,jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.classicflix_get_import_history(p_limit integer DEFAULT 50)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE v_result jsonb;
BEGIN
  IF auth.uid() IS NULL OR COALESCE(auth.jwt() ->> 'email','') <> 'liclopes@gmail.com' THEN
    RAISE EXCEPTION 'Apenas o administrador do ClassicFlix pode consultar o histórico.' USING ERRCODE = '42501';
  END IF;
  SELECT COALESCE(jsonb_agg(entry ORDER BY created_at DESC), '[]'::jsonb)
  INTO v_result
  FROM (
    SELECT j.created_at,
      jsonb_build_object(
        'id', j.id,
        'source', j.source,
        'action', j.action,
        'status', j.status,
        'requested_email', j.requested_email,
        'created_at', j.created_at,
        'details', j.details,
        'changes', COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'field_name', h.field_name,
            'old_value', h.old_value,
            'new_value', h.new_value,
            'source', h.source,
            'source_url', h.source_url,
            'created_at', h.created_at
          ) ORDER BY h.id)
          FROM public.metadata_history h WHERE h.import_job_id = j.id
        ), '[]'::jsonb)
      ) AS entry
    FROM public.import_jobs j
    ORDER BY j.created_at DESC
    LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 50), 200))
  ) entries;
  RETURN v_result;
END;
$function$;
REVOKE ALL ON FUNCTION public.classicflix_get_import_history(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.classicflix_get_import_history(integer) TO authenticated;



-- 14. Restringir leitura das tabelas de auditoria do importador.
-- Restringe as tabelas de auditoria e mídias ao contexto autenticado.
-- O histórico continua acessível pela RPC administrativa com validação de e-mail.
REVOKE ALL ON TABLE public.import_jobs, public.metadata_history, public.movie_media FROM PUBLIC, anon;
GRANT SELECT ON TABLE public.import_jobs, public.metadata_history, public.movie_media TO authenticated;
REVOKE ALL ON FUNCTION public.classicflix_get_import_history(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.classicflix_get_import_history(integer) TO authenticated;



-- 15. Vincular materiais importados às execuções e registrar falhas.
-- Vincula mídias ao trabalho e registra falhas fora da transação revertida.
ALTER TABLE public.movie_media
  ADD COLUMN IF NOT EXISTS import_job_id uuid REFERENCES public.import_jobs(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_movie_media_import_job ON public.movie_media(import_job_id);

CREATE OR REPLACE FUNCTION public.classicflix_import_movie_with_history(
  p_action text,
  p_movie jsonb,
  p_description jsonb,
  p_technicaldetails jsonb,
  p_identifiers jsonb,
  p_selected_fields text[],
  p_sources jsonb DEFAULT '{}'::jsonb,
  p_media jsonb DEFAULT '[]'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_qid text;
  v_job_id uuid;
  v_email text;
  v_old_movie jsonb := '{}'::jsonb;
  v_old_description jsonb := '{}'::jsonb;
  v_old_technical jsonb := '{}'::jsonb;
  v_old_identifiers jsonb := '{}'::jsonb;
  v_new_movie jsonb := '{}'::jsonb;
  v_new_description jsonb := '{}'::jsonb;
  v_new_technical jsonb := '{}'::jsonb;
  v_new_identifiers jsonb := '{}'::jsonb;
  v_field text;
  v_old jsonb;
  v_new jsonb;
  v_source text;
  v_source_url text;
  v_media jsonb;
  v_source_id text;
BEGIN
  v_email := COALESCE(auth.jwt() ->> 'email', '');
  IF auth.uid() IS NULL OR v_email <> 'liclopes@gmail.com' THEN
    RAISE EXCEPTION 'Apenas o administrador do ClassicFlix pode importar ou atualizar produções.' USING ERRCODE = '42501';
  END IF;

  v_qid := upper(NULLIF(btrim(p_movie ->> 'wikidataid'), ''));
  IF v_qid IS NULL OR v_qid !~ '^Q[0-9]+$' THEN
    RAISE EXCEPTION 'QID do Wikidata inválido ou ausente.' USING ERRCODE = '22023';
  END IF;
  IF p_action NOT IN ('insert','update') THEN
    RAISE EXCEPTION 'Ação de importação inválida.' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1 FROM unnest(COALESCE(p_selected_fields, ARRAY[]::text[])) f
    WHERE f NOT IN ('title','titlePt','originalTitle','year','language','posterUrl','videoUrl','trailerUrl',
                    'descriptionEn','descriptionPt','director','duration','genres','themes','license','identifiers')
  ) THEN
    RAISE EXCEPTION 'A seleção contém campos não permitidos.' USING ERRCODE = '22023';
  END IF;

  SELECT to_jsonb(m) INTO v_old_movie
  FROM public.movies m WHERE upper(m.wikidataid) = v_qid FOR UPDATE;

  IF p_action = 'insert' AND v_old_movie IS NOT NULL THEN
    RAISE EXCEPTION 'A produção % já existe. Abra a revisão seletiva para atualizar.', v_qid USING ERRCODE = '23505';
  ELSIF p_action = 'update' AND v_old_movie IS NULL THEN
    RAISE EXCEPTION 'A produção % não existe no catálogo; use a importação de nova produção.', v_qid USING ERRCODE = 'P0002';
  END IF;

  SELECT to_jsonb(d) INTO v_old_description FROM public.description d WHERE upper(d.wikidataid) = v_qid;
  SELECT to_jsonb(t) INTO v_old_technical FROM public.technicaldetails t WHERE upper(t.wikidataid) = v_qid;
  SELECT to_jsonb(i) INTO v_old_identifiers FROM public.identifiers i WHERE upper(i.wikidataid) = v_qid;

  INSERT INTO public.import_jobs (source, action, requested_by, requested_email, status, item_count, details)
  VALUES ('wikidata', p_action, auth.uid(), v_email, 'completed', 1,
          jsonb_build_object('wikidataid', v_qid, 'selected_fields', COALESCE(p_selected_fields, ARRAY[]::text[]), 'media_count', jsonb_array_length(COALESCE(p_media, '[]'::jsonb))))
  RETURNING id INTO v_job_id;

  IF p_action = 'insert' THEN
    PERFORM public.classicflix_import_movie_atomic(
      p_movie, p_description, p_technicaldetails, COALESCE(p_identifiers, '{}'::jsonb)
    );
  ELSE
    UPDATE public.movies SET
      title = CASE WHEN 'title' = ANY(p_selected_fields) THEN COALESCE(NULLIF(p_movie ->> 'title',''), title) ELSE title END,
      titlept = CASE WHEN 'titlePt' = ANY(p_selected_fields) THEN COALESCE(NULLIF(p_movie ->> 'titlept',''), titlept) ELSE titlept END,
      originaltitle = CASE WHEN 'originalTitle' = ANY(p_selected_fields) THEN COALESCE(NULLIF(p_movie ->> 'originaltitle',''), originaltitle) ELSE originaltitle END,
      year = CASE WHEN 'year' = ANY(p_selected_fields) THEN COALESCE(NULLIF(p_movie ->> 'year','')::integer, year) ELSE year END,
      language = CASE WHEN 'language' = ANY(p_selected_fields) THEN COALESCE(NULLIF(p_movie ->> 'language',''), language) ELSE language END,
      posterurl = CASE WHEN 'posterUrl' = ANY(p_selected_fields) THEN COALESCE(NULLIF(p_movie ->> 'posterurl',''), posterurl) ELSE posterurl END,
      videourl = CASE WHEN 'videoUrl' = ANY(p_selected_fields) THEN COALESCE(NULLIF(p_movie ->> 'videourl',''), videourl) ELSE videourl END,
      trailerurl = CASE WHEN 'trailerUrl' = ANY(p_selected_fields) THEN COALESCE(NULLIF(p_movie ->> 'trailerurl',''), trailerurl) ELSE trailerurl END,
      description = CASE WHEN 'descriptionEn' = ANY(p_selected_fields) THEN COALESCE(NULLIF(p_movie ->> 'description',''), description) ELSE description END
    WHERE upper(wikidataid) = v_qid;

    IF p_selected_fields && ARRAY['descriptionEn','descriptionPt']::text[] THEN
      INSERT INTO public.description (wikidataid, id, title, descriptionen, descriptionpt, descriptionhi, descriptionru, descriptionit)
      VALUES (v_qid, NULLIF(p_description ->> 'id',''), NULLIF(p_description ->> 'title',''),
              CASE WHEN 'descriptionEn' = ANY(p_selected_fields) THEN NULLIF(p_description ->> 'descriptionen','') END,
              CASE WHEN 'descriptionPt' = ANY(p_selected_fields) THEN NULLIF(p_description ->> 'descriptionpt','') END,
              NULL, NULL, NULL)
      ON CONFLICT (wikidataid) DO UPDATE SET
        descriptionen = CASE WHEN 'descriptionEn' = ANY(p_selected_fields) THEN COALESCE(EXCLUDED.descriptionen, description.descriptionen) ELSE description.descriptionen END,
        descriptionpt = CASE WHEN 'descriptionPt' = ANY(p_selected_fields) THEN COALESCE(EXCLUDED.descriptionpt, description.descriptionpt) ELSE description.descriptionpt END;
    END IF;

    IF p_selected_fields && ARRAY['director','duration','genres','themes','license']::text[] THEN
      INSERT INTO public.technicaldetails (wikidataid, id, title, duration, genres, director, sourcelabel, themes)
      VALUES (v_qid, NULLIF(p_technicaldetails ->> 'id',''), NULLIF(p_technicaldetails ->> 'title',''),
              CASE WHEN 'duration' = ANY(p_selected_fields) THEN NULLIF(p_technicaldetails ->> 'duration','') END,
              CASE WHEN 'genres' = ANY(p_selected_fields) THEN NULLIF(p_technicaldetails ->> 'genres','') END,
              CASE WHEN 'director' = ANY(p_selected_fields) THEN NULLIF(p_technicaldetails ->> 'director','') END,
              CASE WHEN 'license' = ANY(p_selected_fields) THEN NULLIF(p_technicaldetails ->> 'sourcelabel','') END,
              CASE WHEN 'themes' = ANY(p_selected_fields) THEN NULLIF(p_technicaldetails ->> 'themes','') END)
      ON CONFLICT (wikidataid) DO UPDATE SET
        duration = CASE WHEN 'duration' = ANY(p_selected_fields) THEN COALESCE(EXCLUDED.duration, technicaldetails.duration) ELSE technicaldetails.duration END,
        genres = CASE WHEN 'genres' = ANY(p_selected_fields) THEN COALESCE(EXCLUDED.genres, technicaldetails.genres) ELSE technicaldetails.genres END,
        director = CASE WHEN 'director' = ANY(p_selected_fields) THEN COALESCE(EXCLUDED.director, technicaldetails.director) ELSE technicaldetails.director END,
        sourcelabel = CASE WHEN 'license' = ANY(p_selected_fields) THEN COALESCE(EXCLUDED.sourcelabel, technicaldetails.sourcelabel) ELSE technicaldetails.sourcelabel END,
        themes = CASE WHEN 'themes' = ANY(p_selected_fields) THEN COALESCE(EXCLUDED.themes, technicaldetails.themes) ELSE technicaldetails.themes END;
    END IF;

    IF 'identifiers' = ANY(p_selected_fields) THEN
      INSERT INTO public.identifiers (wikidataid, archiveid, imdbid, omdbid, openmdbid, googleknowid, ofdbid, commons, youtube, tmdbid, updatedat)
      VALUES (v_qid, NULLIF(p_identifiers ->> 'archiveid',''), NULLIF(p_identifiers ->> 'imdbid',''),
              NULLIF(p_identifiers ->> 'omdbid',''), NULLIF(p_identifiers ->> 'openmdbid',''),
              NULLIF(p_identifiers ->> 'googleknowid',''), NULLIF(p_identifiers ->> 'ofdbid',''),
              NULLIF(p_identifiers ->> 'commons',''), NULLIF(p_identifiers ->> 'youtube',''),
              NULLIF(p_identifiers ->> 'tmdbid',''), now())
      ON CONFLICT (wikidataid) DO UPDATE SET
        archiveid = COALESCE(EXCLUDED.archiveid, identifiers.archiveid),
        imdbid = COALESCE(EXCLUDED.imdbid, identifiers.imdbid),
        omdbid = COALESCE(EXCLUDED.omdbid, identifiers.omdbid),
        openmdbid = COALESCE(EXCLUDED.openmdbid, identifiers.openmdbid),
        googleknowid = COALESCE(EXCLUDED.googleknowid, identifiers.googleknowid),
        ofdbid = COALESCE(EXCLUDED.ofdbid, identifiers.ofdbid),
        commons = COALESCE(EXCLUDED.commons, identifiers.commons),
        youtube = COALESCE(EXCLUDED.youtube, identifiers.youtube),
        tmdbid = COALESCE(EXCLUDED.tmdbid, identifiers.tmdbid),
        updatedat = now();
    END IF;
  END IF;

  IF 'identifiers' = ANY(p_selected_fields) AND p_action = 'insert' AND NULLIF(p_identifiers ->> 'tmdbid','') IS NOT NULL THEN
    UPDATE public.identifiers SET tmdbid = p_identifiers ->> 'tmdbid' WHERE wikidataid = v_qid;
  END IF;

  SELECT to_jsonb(m) INTO v_new_movie FROM public.movies m WHERE upper(m.wikidataid) = v_qid;
  SELECT to_jsonb(d) INTO v_new_description FROM public.description d WHERE upper(d.wikidataid) = v_qid;
  SELECT to_jsonb(t) INTO v_new_technical FROM public.technicaldetails t WHERE upper(t.wikidataid) = v_qid;
  SELECT to_jsonb(i) INTO v_new_identifiers FROM public.identifiers i WHERE upper(i.wikidataid) = v_qid;

  FOREACH v_field IN ARRAY COALESCE(p_selected_fields, ARRAY[]::text[]) LOOP
    v_old := CASE v_field
      WHEN 'title' THEN v_old_movie -> 'title'
      WHEN 'titlePt' THEN v_old_movie -> 'titlept'
      WHEN 'originalTitle' THEN v_old_movie -> 'originaltitle'
      WHEN 'year' THEN v_old_movie -> 'year'
      WHEN 'language' THEN v_old_movie -> 'language'
      WHEN 'posterUrl' THEN v_old_movie -> 'posterurl'
      WHEN 'videoUrl' THEN v_old_movie -> 'videourl'
      WHEN 'trailerUrl' THEN v_old_movie -> 'trailerurl'
      WHEN 'descriptionEn' THEN COALESCE(v_old_description -> 'descriptionen', v_old_movie -> 'description')
      WHEN 'descriptionPt' THEN v_old_description -> 'descriptionpt'
      WHEN 'director' THEN v_old_technical -> 'director'
      WHEN 'duration' THEN v_old_technical -> 'duration'
      WHEN 'genres' THEN v_old_technical -> 'genres'
      WHEN 'themes' THEN v_old_technical -> 'themes'
      WHEN 'license' THEN v_old_technical -> 'sourcelabel'
      WHEN 'identifiers' THEN v_old_identifiers
    END;
    v_new := CASE v_field
      WHEN 'title' THEN v_new_movie -> 'title'
      WHEN 'titlePt' THEN v_new_movie -> 'titlept'
      WHEN 'originalTitle' THEN v_new_movie -> 'originaltitle'
      WHEN 'year' THEN v_new_movie -> 'year'
      WHEN 'language' THEN v_new_movie -> 'language'
      WHEN 'posterUrl' THEN v_new_movie -> 'posterurl'
      WHEN 'videoUrl' THEN v_new_movie -> 'videourl'
      WHEN 'trailerUrl' THEN v_new_movie -> 'trailerurl'
      WHEN 'descriptionEn' THEN COALESCE(v_new_description -> 'descriptionen', v_new_movie -> 'description')
      WHEN 'descriptionPt' THEN v_new_description -> 'descriptionpt'
      WHEN 'director' THEN v_new_technical -> 'director'
      WHEN 'duration' THEN v_new_technical -> 'duration'
      WHEN 'genres' THEN v_new_technical -> 'genres'
      WHEN 'themes' THEN v_new_technical -> 'themes'
      WHEN 'license' THEN v_new_technical -> 'sourcelabel'
      WHEN 'identifiers' THEN v_new_identifiers
    END;
    IF v_old IS DISTINCT FROM v_new THEN
      v_source := COALESCE(p_sources -> v_field ->> 'source', 'wikidata');
      v_source_url := p_sources -> v_field ->> 'url';
      INSERT INTO public.metadata_history
        (import_job_id, wikidataid, field_name, old_value, new_value, source, source_url, actor_id, actor_email)
      VALUES
        (v_job_id, v_qid, v_field, v_old, v_new, v_source, v_source_url, auth.uid(), v_email);
    END IF;
  END LOOP;

  FOR v_media IN SELECT value FROM jsonb_array_elements(COALESCE(p_media, '[]'::jsonb))
  LOOP
    v_source_id := COALESCE(NULLIF(v_media ->> 'source_id',''), NULLIF(v_media ->> 'url',''));
    IF v_source_id IS NOT NULL AND NULLIF(v_media ->> 'url','') IS NOT NULL THEN
      INSERT INTO public.movie_media
        (wikidataid, import_job_id, media_type, source, source_id, url, page_url, license, attribution, metadata)
      VALUES
        (v_qid, v_job_id, COALESCE(v_media ->> 'media_type','poster'), COALESCE(v_media ->> 'source','wikidata'),
         v_source_id, v_media ->> 'url', NULLIF(v_media ->> 'page_url',''),
         NULLIF(v_media ->> 'license',''), NULLIF(v_media ->> 'attribution',''),
         COALESCE(v_media -> 'metadata','{}'::jsonb))
      ON CONFLICT (wikidataid, source, source_id) DO NOTHING;
    END IF;
  END LOOP;

  RETURN v_job_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.classicflix_import_movie_with_history(text,jsonb,jsonb,jsonb,jsonb,text[],jsonb,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.classicflix_import_movie_with_history(text,jsonb,jsonb,jsonb,jsonb,text[],jsonb,jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.classicflix_get_import_history(p_limit integer DEFAULT 50)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE v_result jsonb;
BEGIN
  IF auth.uid() IS NULL OR COALESCE(auth.jwt() ->> 'email','') <> 'liclopes@gmail.com' THEN
    RAISE EXCEPTION 'Apenas o administrador do ClassicFlix pode consultar o histórico.' USING ERRCODE = '42501';
  END IF;
  SELECT COALESCE(jsonb_agg(entry ORDER BY created_at DESC), '[]'::jsonb)
  INTO v_result
  FROM (
    SELECT j.created_at,
      jsonb_build_object(
        'id', j.id,
        'source', j.source,
        'action', j.action,
        'status', j.status,
        'requested_email', j.requested_email,
        'created_at', j.created_at,
        'details', j.details,
        'media', COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'media_type', mm.media_type,
            'source', mm.source,
            'source_id', mm.source_id,
            'url', mm.url,
            'page_url', mm.page_url,
            'license', mm.license,
            'attribution', mm.attribution
          ) ORDER BY mm.created_at)
          FROM public.movie_media mm WHERE mm.import_job_id = j.id
        ), '[]'::jsonb),
        'changes', COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'field_name', h.field_name,
            'old_value', h.old_value,
            'new_value', h.new_value,
            'source', h.source,
            'source_url', h.source_url,
            'created_at', h.created_at
          ) ORDER BY h.id)
          FROM public.metadata_history h WHERE h.import_job_id = j.id
        ), '[]'::jsonb)
      ) AS entry
    FROM public.import_jobs j
    ORDER BY j.created_at DESC
    LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 50), 200))
  ) entries;
  RETURN v_result;
END;
$function$;
REVOKE ALL ON FUNCTION public.classicflix_get_import_history(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.classicflix_get_import_history(integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.classicflix_log_import_failure(
  p_qid text,
  p_action text,
  p_error text,
  p_selected_fields text[] DEFAULT ARRAY[]::text[]
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE v_job_id uuid;
DECLARE v_email text;
BEGIN
  v_email := COALESCE(auth.jwt() ->> 'email', '');
  IF auth.uid() IS NULL OR v_email <> 'liclopes@gmail.com' THEN
    RAISE EXCEPTION 'Apenas o administrador do ClassicFlix pode registrar falhas de importação.' USING ERRCODE = '42501';
  END IF;
  INSERT INTO public.import_jobs (source, action, requested_by, requested_email, status, item_count, details)
  VALUES ('wikidata', CASE WHEN p_action = 'update' THEN 'update' ELSE 'insert' END,
          auth.uid(), v_email, 'failed', 1,
          jsonb_build_object('wikidataid', upper(p_qid), 'selected_fields', COALESCE(p_selected_fields, ARRAY[]::text[]), 'error', left(COALESCE(p_error,'Falha sem mensagem'), 2000)))
  RETURNING id INTO v_job_id;
  RETURN v_job_id;
END;
$function$;
REVOKE ALL ON FUNCTION public.classicflix_log_import_failure(text,text,text,text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.classicflix_log_import_failure(text,text,text,text[]) TO authenticated;



-- 16. Elenco e avaliação do TMDb na atualização seletiva.
-- Adiciona elenco e avaliação à atualização seletiva e ao histórico.
CREATE OR REPLACE FUNCTION public.classicflix_import_movie_with_history(
  p_action text,
  p_movie jsonb,
  p_description jsonb,
  p_technicaldetails jsonb,
  p_identifiers jsonb,
  p_selected_fields text[],
  p_sources jsonb DEFAULT '{}'::jsonb,
  p_media jsonb DEFAULT '[]'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_qid text;
  v_job_id uuid;
  v_email text;
  v_old_movie jsonb := '{}'::jsonb;
  v_old_description jsonb := '{}'::jsonb;
  v_old_technical jsonb := '{}'::jsonb;
  v_old_identifiers jsonb := '{}'::jsonb;
  v_new_movie jsonb := '{}'::jsonb;
  v_new_description jsonb := '{}'::jsonb;
  v_new_technical jsonb := '{}'::jsonb;
  v_new_identifiers jsonb := '{}'::jsonb;
  v_field text;
  v_old jsonb;
  v_new jsonb;
  v_source text;
  v_source_url text;
  v_media jsonb;
  v_source_id text;
BEGIN
  v_email := COALESCE(auth.jwt() ->> 'email', '');
  IF auth.uid() IS NULL OR v_email <> 'liclopes@gmail.com' THEN
    RAISE EXCEPTION 'Apenas o administrador do ClassicFlix pode importar ou atualizar produções.' USING ERRCODE = '42501';
  END IF;

  v_qid := upper(NULLIF(btrim(p_movie ->> 'wikidataid'), ''));
  IF v_qid IS NULL OR v_qid !~ '^Q[0-9]+$' THEN
    RAISE EXCEPTION 'QID do Wikidata inválido ou ausente.' USING ERRCODE = '22023';
  END IF;
  IF p_action NOT IN ('insert','update') THEN
    RAISE EXCEPTION 'Ação de importação inválida.' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1 FROM unnest(COALESCE(p_selected_fields, ARRAY[]::text[])) f
    WHERE f NOT IN ('title','titlePt','originalTitle','year','language','posterUrl','videoUrl','trailerUrl',
                    'descriptionEn','descriptionPt','director','duration','genres','themes','cast','rating','license','identifiers')
  ) THEN
    RAISE EXCEPTION 'A seleção contém campos não permitidos.' USING ERRCODE = '22023';
  END IF;

  SELECT to_jsonb(m) INTO v_old_movie
  FROM public.movies m WHERE upper(m.wikidataid) = v_qid FOR UPDATE;

  IF p_action = 'insert' AND v_old_movie IS NOT NULL THEN
    RAISE EXCEPTION 'A produção % já existe. Abra a revisão seletiva para atualizar.', v_qid USING ERRCODE = '23505';
  ELSIF p_action = 'update' AND v_old_movie IS NULL THEN
    RAISE EXCEPTION 'A produção % não existe no catálogo; use a importação de nova produção.', v_qid USING ERRCODE = 'P0002';
  END IF;

  SELECT to_jsonb(d) INTO v_old_description FROM public.description d WHERE upper(d.wikidataid) = v_qid;
  SELECT to_jsonb(t) INTO v_old_technical FROM public.technicaldetails t WHERE upper(t.wikidataid) = v_qid;
  SELECT to_jsonb(i) INTO v_old_identifiers FROM public.identifiers i WHERE upper(i.wikidataid) = v_qid;

  INSERT INTO public.import_jobs (source, action, requested_by, requested_email, status, item_count, details)
  VALUES ('wikidata', p_action, auth.uid(), v_email, 'completed', 1,
          jsonb_build_object('wikidataid', v_qid, 'selected_fields', COALESCE(p_selected_fields, ARRAY[]::text[]), 'media_count', jsonb_array_length(COALESCE(p_media, '[]'::jsonb))))
  RETURNING id INTO v_job_id;

  IF p_action = 'insert' THEN
    PERFORM public.classicflix_import_movie_atomic(
      p_movie, p_description, p_technicaldetails, COALESCE(p_identifiers, '{}'::jsonb)
    );
  ELSE
    UPDATE public.movies SET
      title = CASE WHEN 'title' = ANY(p_selected_fields) THEN COALESCE(NULLIF(p_movie ->> 'title',''), title) ELSE title END,
      titlept = CASE WHEN 'titlePt' = ANY(p_selected_fields) THEN COALESCE(NULLIF(p_movie ->> 'titlept',''), titlept) ELSE titlept END,
      originaltitle = CASE WHEN 'originalTitle' = ANY(p_selected_fields) THEN COALESCE(NULLIF(p_movie ->> 'originaltitle',''), originaltitle) ELSE originaltitle END,
      year = CASE WHEN 'year' = ANY(p_selected_fields) THEN COALESCE(NULLIF(p_movie ->> 'year','')::integer, year) ELSE year END,
      language = CASE WHEN 'language' = ANY(p_selected_fields) THEN COALESCE(NULLIF(p_movie ->> 'language',''), language) ELSE language END,
      posterurl = CASE WHEN 'posterUrl' = ANY(p_selected_fields) THEN COALESCE(NULLIF(p_movie ->> 'posterurl',''), posterurl) ELSE posterurl END,
      videourl = CASE WHEN 'videoUrl' = ANY(p_selected_fields) THEN COALESCE(NULLIF(p_movie ->> 'videourl',''), videourl) ELSE videourl END,
      trailerurl = CASE WHEN 'trailerUrl' = ANY(p_selected_fields) THEN COALESCE(NULLIF(p_movie ->> 'trailerurl',''), trailerurl) ELSE trailerurl END,
      description = CASE WHEN 'descriptionEn' = ANY(p_selected_fields) THEN COALESCE(NULLIF(p_movie ->> 'description',''), description) ELSE description END
    WHERE upper(wikidataid) = v_qid;

    IF p_selected_fields && ARRAY['descriptionEn','descriptionPt']::text[] THEN
      INSERT INTO public.description (wikidataid, id, title, descriptionen, descriptionpt, descriptionhi, descriptionru, descriptionit)
      VALUES (v_qid, NULLIF(p_description ->> 'id',''), NULLIF(p_description ->> 'title',''),
              CASE WHEN 'descriptionEn' = ANY(p_selected_fields) THEN NULLIF(p_description ->> 'descriptionen','') END,
              CASE WHEN 'descriptionPt' = ANY(p_selected_fields) THEN NULLIF(p_description ->> 'descriptionpt','') END,
              NULL, NULL, NULL)
      ON CONFLICT (wikidataid) DO UPDATE SET
        descriptionen = CASE WHEN 'descriptionEn' = ANY(p_selected_fields) THEN COALESCE(EXCLUDED.descriptionen, description.descriptionen) ELSE description.descriptionen END,
        descriptionpt = CASE WHEN 'descriptionPt' = ANY(p_selected_fields) THEN COALESCE(EXCLUDED.descriptionpt, description.descriptionpt) ELSE description.descriptionpt END;
    END IF;

    IF p_selected_fields && ARRAY['director','duration','genres','themes','cast','rating','license']::text[] THEN
      INSERT INTO public.technicaldetails (wikidataid, id, title, duration, genres, director, sourcelabel, themes, castmembers, rating)
      VALUES (v_qid, NULLIF(p_technicaldetails ->> 'id',''), NULLIF(p_technicaldetails ->> 'title',''),
              CASE WHEN 'duration' = ANY(p_selected_fields) THEN NULLIF(p_technicaldetails ->> 'duration','') END,
              CASE WHEN 'genres' = ANY(p_selected_fields) THEN NULLIF(p_technicaldetails ->> 'genres','') END,
              CASE WHEN 'director' = ANY(p_selected_fields) THEN NULLIF(p_technicaldetails ->> 'director','') END,
              CASE WHEN 'license' = ANY(p_selected_fields) THEN NULLIF(p_technicaldetails ->> 'sourcelabel','') END,
              CASE WHEN 'themes' = ANY(p_selected_fields) THEN NULLIF(p_technicaldetails ->> 'themes','') END,
              CASE WHEN 'cast' = ANY(p_selected_fields) THEN NULLIF(p_technicaldetails ->> 'castmembers','') END,
              CASE WHEN 'rating' = ANY(p_selected_fields) THEN NULLIF(p_technicaldetails ->> 'rating','') END)
      ON CONFLICT (wikidataid) DO UPDATE SET
        duration = CASE WHEN 'duration' = ANY(p_selected_fields) THEN COALESCE(EXCLUDED.duration, technicaldetails.duration) ELSE technicaldetails.duration END,
        genres = CASE WHEN 'genres' = ANY(p_selected_fields) THEN COALESCE(EXCLUDED.genres, technicaldetails.genres) ELSE technicaldetails.genres END,
        director = CASE WHEN 'director' = ANY(p_selected_fields) THEN COALESCE(EXCLUDED.director, technicaldetails.director) ELSE technicaldetails.director END,
        sourcelabel = CASE WHEN 'license' = ANY(p_selected_fields) THEN COALESCE(EXCLUDED.sourcelabel, technicaldetails.sourcelabel) ELSE technicaldetails.sourcelabel END,
        themes = CASE WHEN 'themes' = ANY(p_selected_fields) THEN COALESCE(EXCLUDED.themes, technicaldetails.themes) ELSE technicaldetails.themes END,
        castmembers = CASE WHEN 'cast' = ANY(p_selected_fields) THEN COALESCE(EXCLUDED.castmembers, technicaldetails.castmembers) ELSE technicaldetails.castmembers END,
        rating = CASE WHEN 'rating' = ANY(p_selected_fields) THEN COALESCE(EXCLUDED.rating, technicaldetails.rating) ELSE technicaldetails.rating END;
    END IF;

    IF 'identifiers' = ANY(p_selected_fields) THEN
      INSERT INTO public.identifiers (wikidataid, archiveid, imdbid, omdbid, openmdbid, googleknowid, ofdbid, commons, youtube, tmdbid, updatedat)
      VALUES (v_qid, NULLIF(p_identifiers ->> 'archiveid',''), NULLIF(p_identifiers ->> 'imdbid',''),
              NULLIF(p_identifiers ->> 'omdbid',''), NULLIF(p_identifiers ->> 'openmdbid',''),
              NULLIF(p_identifiers ->> 'googleknowid',''), NULLIF(p_identifiers ->> 'ofdbid',''),
              NULLIF(p_identifiers ->> 'commons',''), NULLIF(p_identifiers ->> 'youtube',''),
              NULLIF(p_identifiers ->> 'tmdbid',''), now())
      ON CONFLICT (wikidataid) DO UPDATE SET
        archiveid = COALESCE(EXCLUDED.archiveid, identifiers.archiveid),
        imdbid = COALESCE(EXCLUDED.imdbid, identifiers.imdbid),
        omdbid = COALESCE(EXCLUDED.omdbid, identifiers.omdbid),
        openmdbid = COALESCE(EXCLUDED.openmdbid, identifiers.openmdbid),
        googleknowid = COALESCE(EXCLUDED.googleknowid, identifiers.googleknowid),
        ofdbid = COALESCE(EXCLUDED.ofdbid, identifiers.ofdbid),
        commons = COALESCE(EXCLUDED.commons, identifiers.commons),
        youtube = COALESCE(EXCLUDED.youtube, identifiers.youtube),
        tmdbid = COALESCE(EXCLUDED.tmdbid, identifiers.tmdbid),
        updatedat = now();
    END IF;
  END IF;

  IF 'identifiers' = ANY(p_selected_fields) AND p_action = 'insert' AND NULLIF(p_identifiers ->> 'tmdbid','') IS NOT NULL THEN
    UPDATE public.identifiers SET tmdbid = p_identifiers ->> 'tmdbid' WHERE wikidataid = v_qid;
  END IF;

  SELECT to_jsonb(m) INTO v_new_movie FROM public.movies m WHERE upper(m.wikidataid) = v_qid;
  SELECT to_jsonb(d) INTO v_new_description FROM public.description d WHERE upper(d.wikidataid) = v_qid;
  SELECT to_jsonb(t) INTO v_new_technical FROM public.technicaldetails t WHERE upper(t.wikidataid) = v_qid;
  SELECT to_jsonb(i) INTO v_new_identifiers FROM public.identifiers i WHERE upper(i.wikidataid) = v_qid;

  FOREACH v_field IN ARRAY COALESCE(p_selected_fields, ARRAY[]::text[]) LOOP
    v_old := CASE v_field
      WHEN 'title' THEN v_old_movie -> 'title'
      WHEN 'titlePt' THEN v_old_movie -> 'titlept'
      WHEN 'originalTitle' THEN v_old_movie -> 'originaltitle'
      WHEN 'year' THEN v_old_movie -> 'year'
      WHEN 'language' THEN v_old_movie -> 'language'
      WHEN 'posterUrl' THEN v_old_movie -> 'posterurl'
      WHEN 'videoUrl' THEN v_old_movie -> 'videourl'
      WHEN 'trailerUrl' THEN v_old_movie -> 'trailerurl'
      WHEN 'descriptionEn' THEN COALESCE(v_old_description -> 'descriptionen', v_old_movie -> 'description')
      WHEN 'descriptionPt' THEN v_old_description -> 'descriptionpt'
      WHEN 'director' THEN v_old_technical -> 'director'
      WHEN 'duration' THEN v_old_technical -> 'duration'
      WHEN 'genres' THEN v_old_technical -> 'genres'
      WHEN 'themes' THEN v_old_technical -> 'themes'
      WHEN 'cast' THEN v_old_technical -> 'castmembers'
      WHEN 'rating' THEN v_old_technical -> 'rating'
      WHEN 'license' THEN v_old_technical -> 'sourcelabel'
      WHEN 'identifiers' THEN v_old_identifiers
    END;
    v_new := CASE v_field
      WHEN 'title' THEN v_new_movie -> 'title'
      WHEN 'titlePt' THEN v_new_movie -> 'titlept'
      WHEN 'originalTitle' THEN v_new_movie -> 'originaltitle'
      WHEN 'year' THEN v_new_movie -> 'year'
      WHEN 'language' THEN v_new_movie -> 'language'
      WHEN 'posterUrl' THEN v_new_movie -> 'posterurl'
      WHEN 'videoUrl' THEN v_new_movie -> 'videourl'
      WHEN 'trailerUrl' THEN v_new_movie -> 'trailerurl'
      WHEN 'descriptionEn' THEN COALESCE(v_new_description -> 'descriptionen', v_new_movie -> 'description')
      WHEN 'descriptionPt' THEN v_new_description -> 'descriptionpt'
      WHEN 'director' THEN v_new_technical -> 'director'
      WHEN 'duration' THEN v_new_technical -> 'duration'
      WHEN 'genres' THEN v_new_technical -> 'genres'
      WHEN 'themes' THEN v_new_technical -> 'themes'
      WHEN 'cast' THEN v_new_technical -> 'castmembers'
      WHEN 'rating' THEN v_new_technical -> 'rating'
      WHEN 'license' THEN v_new_technical -> 'sourcelabel'
      WHEN 'identifiers' THEN v_new_identifiers
    END;
    IF v_old IS DISTINCT FROM v_new THEN
      v_source := COALESCE(p_sources -> v_field ->> 'source', 'wikidata');
      v_source_url := p_sources -> v_field ->> 'url';
      INSERT INTO public.metadata_history
        (import_job_id, wikidataid, field_name, old_value, new_value, source, source_url, actor_id, actor_email)
      VALUES
        (v_job_id, v_qid, v_field, v_old, v_new, v_source, v_source_url, auth.uid(), v_email);
    END IF;
  END LOOP;

  FOR v_media IN SELECT value FROM jsonb_array_elements(COALESCE(p_media, '[]'::jsonb))
  LOOP
    v_source_id := COALESCE(NULLIF(v_media ->> 'source_id',''), NULLIF(v_media ->> 'url',''));
    IF v_source_id IS NOT NULL AND NULLIF(v_media ->> 'url','') IS NOT NULL THEN
      INSERT INTO public.movie_media
        (wikidataid, import_job_id, media_type, source, source_id, url, page_url, license, attribution, metadata)
      VALUES
        (v_qid, v_job_id, COALESCE(v_media ->> 'media_type','poster'), COALESCE(v_media ->> 'source','wikidata'),
         v_source_id, v_media ->> 'url', NULLIF(v_media ->> 'page_url',''),
         NULLIF(v_media ->> 'license',''), NULLIF(v_media ->> 'attribution',''),
         COALESCE(v_media -> 'metadata','{}'::jsonb))
      ON CONFLICT (wikidataid, source, source_id) DO NOTHING;
    END IF;
  END LOOP;

  RETURN v_job_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.classicflix_import_movie_with_history(text,jsonb,jsonb,jsonb,jsonb,text[],jsonb,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.classicflix_import_movie_with_history(text,jsonb,jsonb,jsonb,jsonb,text[],jsonb,jsonb) TO authenticated;


-- 17. Corrige a lista de campos permitidos na RPC seletiva.
CREATE OR REPLACE FUNCTION public.classicflix_import_movie_with_history(
  p_action text,
  p_movie jsonb,
  p_description jsonb,
  p_technicaldetails jsonb,
  p_identifiers jsonb,
  p_selected_fields text[],
  p_sources jsonb DEFAULT '{}'::jsonb,
  p_media jsonb DEFAULT '[]'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_qid text;
  v_job_id uuid;
  v_email text;
  v_old_movie jsonb := '{}'::jsonb;
  v_old_description jsonb := '{}'::jsonb;
  v_old_technical jsonb := '{}'::jsonb;
  v_old_identifiers jsonb := '{}'::jsonb;
  v_new_movie jsonb := '{}'::jsonb;
  v_new_description jsonb := '{}'::jsonb;
  v_new_technical jsonb := '{}'::jsonb;
  v_new_identifiers jsonb := '{}'::jsonb;
  v_field text;
  v_old jsonb;
  v_new jsonb;
  v_source text;
  v_source_url text;
  v_media jsonb;
  v_source_id text;
BEGIN
  v_email := COALESCE(auth.jwt() ->> 'email', '');
  IF auth.uid() IS NULL OR v_email <> 'liclopes@gmail.com' THEN
    RAISE EXCEPTION 'Apenas o administrador do ClassicFlix pode importar ou atualizar produções.' USING ERRCODE = '42501';
  END IF;

  v_qid := upper(NULLIF(btrim(p_movie ->> 'wikidataid'), ''));
  IF v_qid IS NULL OR v_qid !~ '^Q[0-9]+$' THEN
    RAISE EXCEPTION 'QID do Wikidata inválido ou ausente.' USING ERRCODE = '22023';
  END IF;
  IF p_action NOT IN ('insert','update') THEN
    RAISE EXCEPTION 'Ação de importação inválida.' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1 FROM unnest(COALESCE(p_selected_fields, ARRAY[]::text[])) f
    WHERE f NOT IN ('title','titlePt','originalTitle','year','language','posterUrl','videoUrl','trailerUrl',
                    'descriptionEn','descriptionPt','director','duration','genres','themes','cast','rating','license','identifiers')
  ) THEN
    RAISE EXCEPTION 'A seleção contém campos não permitidos.' USING ERRCODE = '22023';
  END IF;

  SELECT to_jsonb(m) INTO v_old_movie
  FROM public.movies m WHERE upper(m.wikidataid) = v_qid FOR UPDATE;

  IF p_action = 'insert' AND v_old_movie IS NOT NULL THEN
    RAISE EXCEPTION 'A produção % já existe. Abra a revisão seletiva para atualizar.', v_qid USING ERRCODE = '23505';
  ELSIF p_action = 'update' AND v_old_movie IS NULL THEN
    RAISE EXCEPTION 'A produção % não existe no catálogo; use a importação de nova produção.', v_qid USING ERRCODE = 'P0002';
  END IF;

  SELECT to_jsonb(d) INTO v_old_description FROM public.description d WHERE upper(d.wikidataid) = v_qid;
  SELECT to_jsonb(t) INTO v_old_technical FROM public.technicaldetails t WHERE upper(t.wikidataid) = v_qid;
  SELECT to_jsonb(i) INTO v_old_identifiers FROM public.identifiers i WHERE upper(i.wikidataid) = v_qid;

  INSERT INTO public.import_jobs (source, action, requested_by, requested_email, status, item_count, details)
  VALUES ('wikidata', p_action, auth.uid(), v_email, 'completed', 1,
          jsonb_build_object('wikidataid', v_qid, 'selected_fields', COALESCE(p_selected_fields, ARRAY[]::text[]), 'media_count', jsonb_array_length(COALESCE(p_media, '[]'::jsonb))))
  RETURNING id INTO v_job_id;

  IF p_action = 'insert' THEN
    PERFORM public.classicflix_import_movie_atomic(
      p_movie, p_description, p_technicaldetails, COALESCE(p_identifiers, '{}'::jsonb)
    );
  ELSE
    UPDATE public.movies SET
      title = CASE WHEN 'title' = ANY(p_selected_fields) THEN COALESCE(NULLIF(p_movie ->> 'title',''), title) ELSE title END,
      titlept = CASE WHEN 'titlePt' = ANY(p_selected_fields) THEN COALESCE(NULLIF(p_movie ->> 'titlept',''), titlept) ELSE titlept END,
      originaltitle = CASE WHEN 'originalTitle' = ANY(p_selected_fields) THEN COALESCE(NULLIF(p_movie ->> 'originaltitle',''), originaltitle) ELSE originaltitle END,
      year = CASE WHEN 'year' = ANY(p_selected_fields) THEN COALESCE(NULLIF(p_movie ->> 'year','')::integer, year) ELSE year END,
      language = CASE WHEN 'language' = ANY(p_selected_fields) THEN COALESCE(NULLIF(p_movie ->> 'language',''), language) ELSE language END,
      posterurl = CASE WHEN 'posterUrl' = ANY(p_selected_fields) THEN COALESCE(NULLIF(p_movie ->> 'posterurl',''), posterurl) ELSE posterurl END,
      videourl = CASE WHEN 'videoUrl' = ANY(p_selected_fields) THEN COALESCE(NULLIF(p_movie ->> 'videourl',''), videourl) ELSE videourl END,
      trailerurl = CASE WHEN 'trailerUrl' = ANY(p_selected_fields) THEN COALESCE(NULLIF(p_movie ->> 'trailerurl',''), trailerurl) ELSE trailerurl END,
      description = CASE WHEN 'descriptionEn' = ANY(p_selected_fields) THEN COALESCE(NULLIF(p_movie ->> 'description',''), description) ELSE description END
    WHERE upper(wikidataid) = v_qid;

    IF p_selected_fields && ARRAY['descriptionEn','descriptionPt']::text[] THEN
      INSERT INTO public.description (wikidataid, id, title, descriptionen, descriptionpt, descriptionhi, descriptionru, descriptionit)
      VALUES (v_qid, NULLIF(p_description ->> 'id',''), NULLIF(p_description ->> 'title',''),
              CASE WHEN 'descriptionEn' = ANY(p_selected_fields) THEN NULLIF(p_description ->> 'descriptionen','') END,
              CASE WHEN 'descriptionPt' = ANY(p_selected_fields) THEN NULLIF(p_description ->> 'descriptionpt','') END,
              NULL, NULL, NULL)
      ON CONFLICT (wikidataid) DO UPDATE SET
        descriptionen = CASE WHEN 'descriptionEn' = ANY(p_selected_fields) THEN COALESCE(EXCLUDED.descriptionen, description.descriptionen) ELSE description.descriptionen END,
        descriptionpt = CASE WHEN 'descriptionPt' = ANY(p_selected_fields) THEN COALESCE(EXCLUDED.descriptionpt, description.descriptionpt) ELSE description.descriptionpt END;
    END IF;

    IF p_selected_fields && ARRAY['director','duration','genres','themes','cast','rating','license']::text[] THEN
      INSERT INTO public.technicaldetails (wikidataid, id, title, duration, genres, director, sourcelabel, themes, castmembers, rating)
      VALUES (v_qid, NULLIF(p_technicaldetails ->> 'id',''), NULLIF(p_technicaldetails ->> 'title',''),
              CASE WHEN 'duration' = ANY(p_selected_fields) THEN NULLIF(p_technicaldetails ->> 'duration','') END,
              CASE WHEN 'genres' = ANY(p_selected_fields) THEN NULLIF(p_technicaldetails ->> 'genres','') END,
              CASE WHEN 'director' = ANY(p_selected_fields) THEN NULLIF(p_technicaldetails ->> 'director','') END,
              CASE WHEN 'license' = ANY(p_selected_fields) THEN NULLIF(p_technicaldetails ->> 'sourcelabel','') END,
              CASE WHEN 'themes' = ANY(p_selected_fields) THEN NULLIF(p_technicaldetails ->> 'themes','') END,
              CASE WHEN 'cast' = ANY(p_selected_fields) THEN NULLIF(p_technicaldetails ->> 'castmembers','') END,
              CASE WHEN 'rating' = ANY(p_selected_fields) THEN NULLIF(p_technicaldetails ->> 'rating','') END)
      ON CONFLICT (wikidataid) DO UPDATE SET
        duration = CASE WHEN 'duration' = ANY(p_selected_fields) THEN COALESCE(EXCLUDED.duration, technicaldetails.duration) ELSE technicaldetails.duration END,
        genres = CASE WHEN 'genres' = ANY(p_selected_fields) THEN COALESCE(EXCLUDED.genres, technicaldetails.genres) ELSE technicaldetails.genres END,
        director = CASE WHEN 'director' = ANY(p_selected_fields) THEN COALESCE(EXCLUDED.director, technicaldetails.director) ELSE technicaldetails.director END,
        sourcelabel = CASE WHEN 'license' = ANY(p_selected_fields) THEN COALESCE(EXCLUDED.sourcelabel, technicaldetails.sourcelabel) ELSE technicaldetails.sourcelabel END,
        themes = CASE WHEN 'themes' = ANY(p_selected_fields) THEN COALESCE(EXCLUDED.themes, technicaldetails.themes) ELSE technicaldetails.themes END,
        castmembers = CASE WHEN 'cast' = ANY(p_selected_fields) THEN COALESCE(EXCLUDED.castmembers, technicaldetails.castmembers) ELSE technicaldetails.castmembers END,
        rating = CASE WHEN 'rating' = ANY(p_selected_fields) THEN COALESCE(EXCLUDED.rating, technicaldetails.rating) ELSE technicaldetails.rating END;
    END IF;

    IF 'identifiers' = ANY(p_selected_fields) THEN
      INSERT INTO public.identifiers (wikidataid, archiveid, imdbid, omdbid, openmdbid, googleknowid, ofdbid, commons, youtube, tmdbid, updatedat)
      VALUES (v_qid, NULLIF(p_identifiers ->> 'archiveid',''), NULLIF(p_identifiers ->> 'imdbid',''),
              NULLIF(p_identifiers ->> 'omdbid',''), NULLIF(p_identifiers ->> 'openmdbid',''),
              NULLIF(p_identifiers ->> 'googleknowid',''), NULLIF(p_identifiers ->> 'ofdbid',''),
              NULLIF(p_identifiers ->> 'commons',''), NULLIF(p_identifiers ->> 'youtube',''),
              NULLIF(p_identifiers ->> 'tmdbid',''), now())
      ON CONFLICT (wikidataid) DO UPDATE SET
        archiveid = COALESCE(EXCLUDED.archiveid, identifiers.archiveid),
        imdbid = COALESCE(EXCLUDED.imdbid, identifiers.imdbid),
        omdbid = COALESCE(EXCLUDED.omdbid, identifiers.omdbid),
        openmdbid = COALESCE(EXCLUDED.openmdbid, identifiers.openmdbid),
        googleknowid = COALESCE(EXCLUDED.googleknowid, identifiers.googleknowid),
        ofdbid = COALESCE(EXCLUDED.ofdbid, identifiers.ofdbid),
        commons = COALESCE(EXCLUDED.commons, identifiers.commons),
        youtube = COALESCE(EXCLUDED.youtube, identifiers.youtube),
        tmdbid = COALESCE(EXCLUDED.tmdbid, identifiers.tmdbid),
        updatedat = now();
    END IF;
  END IF;

  IF 'identifiers' = ANY(p_selected_fields) AND p_action = 'insert' AND NULLIF(p_identifiers ->> 'tmdbid','') IS NOT NULL THEN
    UPDATE public.identifiers SET tmdbid = p_identifiers ->> 'tmdbid' WHERE wikidataid = v_qid;
  END IF;

  SELECT to_jsonb(m) INTO v_new_movie FROM public.movies m WHERE upper(m.wikidataid) = v_qid;
  SELECT to_jsonb(d) INTO v_new_description FROM public.description d WHERE upper(d.wikidataid) = v_qid;
  SELECT to_jsonb(t) INTO v_new_technical FROM public.technicaldetails t WHERE upper(t.wikidataid) = v_qid;
  SELECT to_jsonb(i) INTO v_new_identifiers FROM public.identifiers i WHERE upper(i.wikidataid) = v_qid;

  FOREACH v_field IN ARRAY COALESCE(p_selected_fields, ARRAY[]::text[]) LOOP
    v_old := CASE v_field
      WHEN 'title' THEN v_old_movie -> 'title'
      WHEN 'titlePt' THEN v_old_movie -> 'titlept'
      WHEN 'originalTitle' THEN v_old_movie -> 'originaltitle'
      WHEN 'year' THEN v_old_movie -> 'year'
      WHEN 'language' THEN v_old_movie -> 'language'
      WHEN 'posterUrl' THEN v_old_movie -> 'posterurl'
      WHEN 'videoUrl' THEN v_old_movie -> 'videourl'
      WHEN 'trailerUrl' THEN v_old_movie -> 'trailerurl'
      WHEN 'descriptionEn' THEN COALESCE(v_old_description -> 'descriptionen', v_old_movie -> 'description')
      WHEN 'descriptionPt' THEN v_old_description -> 'descriptionpt'
      WHEN 'director' THEN v_old_technical -> 'director'
      WHEN 'duration' THEN v_old_technical -> 'duration'
      WHEN 'genres' THEN v_old_technical -> 'genres'
      WHEN 'themes' THEN v_old_technical -> 'themes'
      WHEN 'cast' THEN v_old_technical -> 'castmembers'
      WHEN 'rating' THEN v_old_technical -> 'rating'
      WHEN 'license' THEN v_old_technical -> 'sourcelabel'
      WHEN 'identifiers' THEN v_old_identifiers
    END;
    v_new := CASE v_field
      WHEN 'title' THEN v_new_movie -> 'title'
      WHEN 'titlePt' THEN v_new_movie -> 'titlept'
      WHEN 'originalTitle' THEN v_new_movie -> 'originaltitle'
      WHEN 'year' THEN v_new_movie -> 'year'
      WHEN 'language' THEN v_new_movie -> 'language'
      WHEN 'posterUrl' THEN v_new_movie -> 'posterurl'
      WHEN 'videoUrl' THEN v_new_movie -> 'videourl'
      WHEN 'trailerUrl' THEN v_new_movie -> 'trailerurl'
      WHEN 'descriptionEn' THEN COALESCE(v_new_description -> 'descriptionen', v_new_movie -> 'description')
      WHEN 'descriptionPt' THEN v_new_description -> 'descriptionpt'
      WHEN 'director' THEN v_new_technical -> 'director'
      WHEN 'duration' THEN v_new_technical -> 'duration'
      WHEN 'genres' THEN v_new_technical -> 'genres'
      WHEN 'themes' THEN v_new_technical -> 'themes'
      WHEN 'cast' THEN v_new_technical -> 'castmembers'
      WHEN 'rating' THEN v_new_technical -> 'rating'
      WHEN 'license' THEN v_new_technical -> 'sourcelabel'
      WHEN 'identifiers' THEN v_new_identifiers
    END;
    IF v_old IS DISTINCT FROM v_new THEN
      v_source := COALESCE(p_sources -> v_field ->> 'source', 'wikidata');
      v_source_url := p_sources -> v_field ->> 'url';
      INSERT INTO public.metadata_history
        (import_job_id, wikidataid, field_name, old_value, new_value, source, source_url, actor_id, actor_email)
      VALUES
        (v_job_id, v_qid, v_field, v_old, v_new, v_source, v_source_url, auth.uid(), v_email);
    END IF;
  END LOOP;

  FOR v_media IN SELECT value FROM jsonb_array_elements(COALESCE(p_media, '[]'::jsonb))
  LOOP
    v_source_id := COALESCE(NULLIF(v_media ->> 'source_id',''), NULLIF(v_media ->> 'url',''));
    IF v_source_id IS NOT NULL AND NULLIF(v_media ->> 'url','') IS NOT NULL THEN
      INSERT INTO public.movie_media
        (wikidataid, import_job_id, media_type, source, source_id, url, page_url, license, attribution, metadata)
      VALUES
        (v_qid, v_job_id, COALESCE(v_media ->> 'media_type','poster'), COALESCE(v_media ->> 'source','wikidata'),
         v_source_id, v_media ->> 'url', NULLIF(v_media ->> 'page_url',''),
         NULLIF(v_media ->> 'license',''), NULLIF(v_media ->> 'attribution',''),
         COALESCE(v_media -> 'metadata','{}'::jsonb))
      ON CONFLICT (wikidataid, source, source_id) DO NOTHING;
    END IF;
  END LOOP;

  RETURN v_job_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.classicflix_import_movie_with_history(text,jsonb,jsonb,jsonb,jsonb,text[],jsonb,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.classicflix_import_movie_with_history(text,jsonb,jsonb,jsonb,jsonb,text[],jsonb,jsonb) TO authenticated;



-- 18. Atualizar metadados de materiais selecionados em reimportações.
CREATE OR REPLACE FUNCTION public.classicflix_import_movie_with_history(
  p_action text,
  p_movie jsonb,
  p_description jsonb,
  p_technicaldetails jsonb,
  p_identifiers jsonb,
  p_selected_fields text[],
  p_sources jsonb DEFAULT '{}'::jsonb,
  p_media jsonb DEFAULT '[]'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_qid text;
  v_job_id uuid;
  v_email text;
  v_old_movie jsonb := '{}'::jsonb;
  v_old_description jsonb := '{}'::jsonb;
  v_old_technical jsonb := '{}'::jsonb;
  v_old_identifiers jsonb := '{}'::jsonb;
  v_new_movie jsonb := '{}'::jsonb;
  v_new_description jsonb := '{}'::jsonb;
  v_new_technical jsonb := '{}'::jsonb;
  v_new_identifiers jsonb := '{}'::jsonb;
  v_field text;
  v_old jsonb;
  v_new jsonb;
  v_source text;
  v_source_url text;
  v_media jsonb;
  v_source_id text;
BEGIN
  v_email := COALESCE(auth.jwt() ->> 'email', '');
  IF auth.uid() IS NULL OR v_email <> 'liclopes@gmail.com' THEN
    RAISE EXCEPTION 'Apenas o administrador do ClassicFlix pode importar ou atualizar produções.' USING ERRCODE = '42501';
  END IF;

  v_qid := upper(NULLIF(btrim(p_movie ->> 'wikidataid'), ''));
  IF v_qid IS NULL OR v_qid !~ '^Q[0-9]+$' THEN
    RAISE EXCEPTION 'QID do Wikidata inválido ou ausente.' USING ERRCODE = '22023';
  END IF;
  IF p_action NOT IN ('insert','update') THEN
    RAISE EXCEPTION 'Ação de importação inválida.' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1 FROM unnest(COALESCE(p_selected_fields, ARRAY[]::text[])) f
    WHERE f NOT IN ('title','titlePt','originalTitle','year','language','posterUrl','videoUrl','trailerUrl',
                    'descriptionEn','descriptionPt','director','duration','genres','themes','cast','rating','license','identifiers')
  ) THEN
    RAISE EXCEPTION 'A seleção contém campos não permitidos.' USING ERRCODE = '22023';
  END IF;

  SELECT to_jsonb(m) INTO v_old_movie
  FROM public.movies m WHERE upper(m.wikidataid) = v_qid FOR UPDATE;

  IF p_action = 'insert' AND v_old_movie IS NOT NULL THEN
    RAISE EXCEPTION 'A produção % já existe. Abra a revisão seletiva para atualizar.', v_qid USING ERRCODE = '23505';
  ELSIF p_action = 'update' AND v_old_movie IS NULL THEN
    RAISE EXCEPTION 'A produção % não existe no catálogo; use a importação de nova produção.', v_qid USING ERRCODE = 'P0002';
  END IF;

  SELECT to_jsonb(d) INTO v_old_description FROM public.description d WHERE upper(d.wikidataid) = v_qid;
  SELECT to_jsonb(t) INTO v_old_technical FROM public.technicaldetails t WHERE upper(t.wikidataid) = v_qid;
  SELECT to_jsonb(i) INTO v_old_identifiers FROM public.identifiers i WHERE upper(i.wikidataid) = v_qid;

  INSERT INTO public.import_jobs (source, action, requested_by, requested_email, status, item_count, details)
  VALUES ('wikidata', p_action, auth.uid(), v_email, 'completed', 1,
          jsonb_build_object('wikidataid', v_qid, 'selected_fields', COALESCE(p_selected_fields, ARRAY[]::text[]), 'media_count', jsonb_array_length(COALESCE(p_media, '[]'::jsonb))))
  RETURNING id INTO v_job_id;

  IF p_action = 'insert' THEN
    PERFORM public.classicflix_import_movie_atomic(
      p_movie, p_description, p_technicaldetails, COALESCE(p_identifiers, '{}'::jsonb)
    );
  ELSE
    UPDATE public.movies SET
      title = CASE WHEN 'title' = ANY(p_selected_fields) THEN COALESCE(NULLIF(p_movie ->> 'title',''), title) ELSE title END,
      titlept = CASE WHEN 'titlePt' = ANY(p_selected_fields) THEN COALESCE(NULLIF(p_movie ->> 'titlept',''), titlept) ELSE titlept END,
      originaltitle = CASE WHEN 'originalTitle' = ANY(p_selected_fields) THEN COALESCE(NULLIF(p_movie ->> 'originaltitle',''), originaltitle) ELSE originaltitle END,
      year = CASE WHEN 'year' = ANY(p_selected_fields) THEN COALESCE(NULLIF(p_movie ->> 'year','')::integer, year) ELSE year END,
      language = CASE WHEN 'language' = ANY(p_selected_fields) THEN COALESCE(NULLIF(p_movie ->> 'language',''), language) ELSE language END,
      posterurl = CASE WHEN 'posterUrl' = ANY(p_selected_fields) THEN COALESCE(NULLIF(p_movie ->> 'posterurl',''), posterurl) ELSE posterurl END,
      videourl = CASE WHEN 'videoUrl' = ANY(p_selected_fields) THEN COALESCE(NULLIF(p_movie ->> 'videourl',''), videourl) ELSE videourl END,
      trailerurl = CASE WHEN 'trailerUrl' = ANY(p_selected_fields) THEN COALESCE(NULLIF(p_movie ->> 'trailerurl',''), trailerurl) ELSE trailerurl END,
      description = CASE WHEN 'descriptionEn' = ANY(p_selected_fields) THEN COALESCE(NULLIF(p_movie ->> 'description',''), description) ELSE description END
    WHERE upper(wikidataid) = v_qid;

    IF p_selected_fields && ARRAY['descriptionEn','descriptionPt']::text[] THEN
      INSERT INTO public.description (wikidataid, id, title, descriptionen, descriptionpt, descriptionhi, descriptionru, descriptionit)
      VALUES (v_qid, NULLIF(p_description ->> 'id',''), NULLIF(p_description ->> 'title',''),
              CASE WHEN 'descriptionEn' = ANY(p_selected_fields) THEN NULLIF(p_description ->> 'descriptionen','') END,
              CASE WHEN 'descriptionPt' = ANY(p_selected_fields) THEN NULLIF(p_description ->> 'descriptionpt','') END,
              NULL, NULL, NULL)
      ON CONFLICT (wikidataid) DO UPDATE SET
        descriptionen = CASE WHEN 'descriptionEn' = ANY(p_selected_fields) THEN COALESCE(EXCLUDED.descriptionen, description.descriptionen) ELSE description.descriptionen END,
        descriptionpt = CASE WHEN 'descriptionPt' = ANY(p_selected_fields) THEN COALESCE(EXCLUDED.descriptionpt, description.descriptionpt) ELSE description.descriptionpt END;
    END IF;

    IF p_selected_fields && ARRAY['director','duration','genres','themes','cast','rating','license']::text[] THEN
      INSERT INTO public.technicaldetails (wikidataid, id, title, duration, genres, director, sourcelabel, themes, castmembers, rating)
      VALUES (v_qid, NULLIF(p_technicaldetails ->> 'id',''), NULLIF(p_technicaldetails ->> 'title',''),
              CASE WHEN 'duration' = ANY(p_selected_fields) THEN NULLIF(p_technicaldetails ->> 'duration','') END,
              CASE WHEN 'genres' = ANY(p_selected_fields) THEN NULLIF(p_technicaldetails ->> 'genres','') END,
              CASE WHEN 'director' = ANY(p_selected_fields) THEN NULLIF(p_technicaldetails ->> 'director','') END,
              CASE WHEN 'license' = ANY(p_selected_fields) THEN NULLIF(p_technicaldetails ->> 'sourcelabel','') END,
              CASE WHEN 'themes' = ANY(p_selected_fields) THEN NULLIF(p_technicaldetails ->> 'themes','') END,
              CASE WHEN 'cast' = ANY(p_selected_fields) THEN NULLIF(p_technicaldetails ->> 'castmembers','') END,
              CASE WHEN 'rating' = ANY(p_selected_fields) THEN NULLIF(p_technicaldetails ->> 'rating','') END)
      ON CONFLICT (wikidataid) DO UPDATE SET
        duration = CASE WHEN 'duration' = ANY(p_selected_fields) THEN COALESCE(EXCLUDED.duration, technicaldetails.duration) ELSE technicaldetails.duration END,
        genres = CASE WHEN 'genres' = ANY(p_selected_fields) THEN COALESCE(EXCLUDED.genres, technicaldetails.genres) ELSE technicaldetails.genres END,
        director = CASE WHEN 'director' = ANY(p_selected_fields) THEN COALESCE(EXCLUDED.director, technicaldetails.director) ELSE technicaldetails.director END,
        sourcelabel = CASE WHEN 'license' = ANY(p_selected_fields) THEN COALESCE(EXCLUDED.sourcelabel, technicaldetails.sourcelabel) ELSE technicaldetails.sourcelabel END,
        themes = CASE WHEN 'themes' = ANY(p_selected_fields) THEN COALESCE(EXCLUDED.themes, technicaldetails.themes) ELSE technicaldetails.themes END,
        castmembers = CASE WHEN 'cast' = ANY(p_selected_fields) THEN COALESCE(EXCLUDED.castmembers, technicaldetails.castmembers) ELSE technicaldetails.castmembers END,
        rating = CASE WHEN 'rating' = ANY(p_selected_fields) THEN COALESCE(EXCLUDED.rating, technicaldetails.rating) ELSE technicaldetails.rating END;
    END IF;

    IF 'identifiers' = ANY(p_selected_fields) THEN
      INSERT INTO public.identifiers (wikidataid, archiveid, imdbid, omdbid, openmdbid, googleknowid, ofdbid, commons, youtube, tmdbid, updatedat)
      VALUES (v_qid, NULLIF(p_identifiers ->> 'archiveid',''), NULLIF(p_identifiers ->> 'imdbid',''),
              NULLIF(p_identifiers ->> 'omdbid',''), NULLIF(p_identifiers ->> 'openmdbid',''),
              NULLIF(p_identifiers ->> 'googleknowid',''), NULLIF(p_identifiers ->> 'ofdbid',''),
              NULLIF(p_identifiers ->> 'commons',''), NULLIF(p_identifiers ->> 'youtube',''),
              NULLIF(p_identifiers ->> 'tmdbid',''), now())
      ON CONFLICT (wikidataid) DO UPDATE SET
        archiveid = COALESCE(EXCLUDED.archiveid, identifiers.archiveid),
        imdbid = COALESCE(EXCLUDED.imdbid, identifiers.imdbid),
        omdbid = COALESCE(EXCLUDED.omdbid, identifiers.omdbid),
        openmdbid = COALESCE(EXCLUDED.openmdbid, identifiers.openmdbid),
        googleknowid = COALESCE(EXCLUDED.googleknowid, identifiers.googleknowid),
        ofdbid = COALESCE(EXCLUDED.ofdbid, identifiers.ofdbid),
        commons = COALESCE(EXCLUDED.commons, identifiers.commons),
        youtube = COALESCE(EXCLUDED.youtube, identifiers.youtube),
        tmdbid = COALESCE(EXCLUDED.tmdbid, identifiers.tmdbid),
        updatedat = now();
    END IF;
  END IF;

  IF 'identifiers' = ANY(p_selected_fields) AND p_action = 'insert' AND NULLIF(p_identifiers ->> 'tmdbid','') IS NOT NULL THEN
    UPDATE public.identifiers SET tmdbid = p_identifiers ->> 'tmdbid' WHERE wikidataid = v_qid;
  END IF;

  SELECT to_jsonb(m) INTO v_new_movie FROM public.movies m WHERE upper(m.wikidataid) = v_qid;
  SELECT to_jsonb(d) INTO v_new_description FROM public.description d WHERE upper(d.wikidataid) = v_qid;
  SELECT to_jsonb(t) INTO v_new_technical FROM public.technicaldetails t WHERE upper(t.wikidataid) = v_qid;
  SELECT to_jsonb(i) INTO v_new_identifiers FROM public.identifiers i WHERE upper(i.wikidataid) = v_qid;

  FOREACH v_field IN ARRAY COALESCE(p_selected_fields, ARRAY[]::text[]) LOOP
    v_old := CASE v_field
      WHEN 'title' THEN v_old_movie -> 'title'
      WHEN 'titlePt' THEN v_old_movie -> 'titlept'
      WHEN 'originalTitle' THEN v_old_movie -> 'originaltitle'
      WHEN 'year' THEN v_old_movie -> 'year'
      WHEN 'language' THEN v_old_movie -> 'language'
      WHEN 'posterUrl' THEN v_old_movie -> 'posterurl'
      WHEN 'videoUrl' THEN v_old_movie -> 'videourl'
      WHEN 'trailerUrl' THEN v_old_movie -> 'trailerurl'
      WHEN 'descriptionEn' THEN COALESCE(v_old_description -> 'descriptionen', v_old_movie -> 'description')
      WHEN 'descriptionPt' THEN v_old_description -> 'descriptionpt'
      WHEN 'director' THEN v_old_technical -> 'director'
      WHEN 'duration' THEN v_old_technical -> 'duration'
      WHEN 'genres' THEN v_old_technical -> 'genres'
      WHEN 'themes' THEN v_old_technical -> 'themes'
      WHEN 'cast' THEN v_old_technical -> 'castmembers'
      WHEN 'rating' THEN v_old_technical -> 'rating'
      WHEN 'license' THEN v_old_technical -> 'sourcelabel'
      WHEN 'identifiers' THEN v_old_identifiers
    END;
    v_new := CASE v_field
      WHEN 'title' THEN v_new_movie -> 'title'
      WHEN 'titlePt' THEN v_new_movie -> 'titlept'
      WHEN 'originalTitle' THEN v_new_movie -> 'originaltitle'
      WHEN 'year' THEN v_new_movie -> 'year'
      WHEN 'language' THEN v_new_movie -> 'language'
      WHEN 'posterUrl' THEN v_new_movie -> 'posterurl'
      WHEN 'videoUrl' THEN v_new_movie -> 'videourl'
      WHEN 'trailerUrl' THEN v_new_movie -> 'trailerurl'
      WHEN 'descriptionEn' THEN COALESCE(v_new_description -> 'descriptionen', v_new_movie -> 'description')
      WHEN 'descriptionPt' THEN v_new_description -> 'descriptionpt'
      WHEN 'director' THEN v_new_technical -> 'director'
      WHEN 'duration' THEN v_new_technical -> 'duration'
      WHEN 'genres' THEN v_new_technical -> 'genres'
      WHEN 'themes' THEN v_new_technical -> 'themes'
      WHEN 'cast' THEN v_new_technical -> 'castmembers'
      WHEN 'rating' THEN v_new_technical -> 'rating'
      WHEN 'license' THEN v_new_technical -> 'sourcelabel'
      WHEN 'identifiers' THEN v_new_identifiers
    END;
    IF v_old IS DISTINCT FROM v_new THEN
      v_source := COALESCE(p_sources -> v_field ->> 'source', 'wikidata');
      v_source_url := p_sources -> v_field ->> 'url';
      INSERT INTO public.metadata_history
        (import_job_id, wikidataid, field_name, old_value, new_value, source, source_url, actor_id, actor_email)
      VALUES
        (v_job_id, v_qid, v_field, v_old, v_new, v_source, v_source_url, auth.uid(), v_email);
    END IF;
  END LOOP;

  FOR v_media IN SELECT value FROM jsonb_array_elements(COALESCE(p_media, '[]'::jsonb))
  LOOP
    v_source_id := COALESCE(NULLIF(v_media ->> 'source_id',''), NULLIF(v_media ->> 'url',''));
    IF v_source_id IS NOT NULL AND NULLIF(v_media ->> 'url','') IS NOT NULL THEN
      INSERT INTO public.movie_media
        (wikidataid, import_job_id, media_type, source, source_id, url, page_url, license, attribution, metadata)
      VALUES
        (v_qid, v_job_id, COALESCE(v_media ->> 'media_type','poster'), COALESCE(v_media ->> 'source','wikidata'),
         v_source_id, v_media ->> 'url', NULLIF(v_media ->> 'page_url',''),
         NULLIF(v_media ->> 'license',''), NULLIF(v_media ->> 'attribution',''),
         COALESCE(v_media -> 'metadata','{}'::jsonb))
      ON CONFLICT (wikidataid, source, source_id) DO UPDATE SET
        import_job_id = EXCLUDED.import_job_id,
        url = EXCLUDED.url,
        page_url = COALESCE(EXCLUDED.page_url, movie_media.page_url),
        license = COALESCE(EXCLUDED.license, movie_media.license),
        attribution = COALESCE(EXCLUDED.attribution, movie_media.attribution),
        metadata = movie_media.metadata || EXCLUDED.metadata;
    END IF;
  END LOOP;

  RETURN v_job_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.classicflix_import_movie_with_history(text,jsonb,jsonb,jsonb,jsonb,text[],jsonb,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.classicflix_import_movie_with_history(text,jsonb,jsonb,jsonb,jsonb,text[],jsonb,jsonb) TO authenticated;

