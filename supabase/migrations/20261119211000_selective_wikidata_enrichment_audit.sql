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
