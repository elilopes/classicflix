-- Importação Wikidata atômica para ClassicFlix.
-- As tabelas são criadas apenas se ausentes; nenhum dado existente é removido.
CREATE TABLE IF NOT EXISTS public.description (
  wikidataid text PRIMARY KEY REFERENCES public.movies(wikidataid) ON DELETE CASCADE,
  id text, title text, descriptionen text, descriptionpt text,
  descriptionhi text, descriptionru text, descriptionit text
);
CREATE TABLE IF NOT EXISTS public.technicaldetails (
  wikidataid text PRIMARY KEY REFERENCES public.movies(wikidataid) ON DELETE CASCADE,
  id text, title text, duration text, genres text, director text,
  sourcelabel text, castmembers text, cinematographers text,
  composers text, themes text, rating text
);
CREATE TABLE IF NOT EXISTS public.identifiers (
  wikidataid text PRIMARY KEY REFERENCES public.movies(wikidataid) ON DELETE CASCADE,
  archiveid text, imdbid text, omdbid text, openmdbid text,
  googleknowid text, ofdbid text, commons text, youtube text,
  updatedat timestamptz DEFAULT now()
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
