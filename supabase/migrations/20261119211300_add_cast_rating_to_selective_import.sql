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
