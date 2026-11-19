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
    title = COALESCE(EXCLUDED.title, current_movie.title),
    titlept = COALESCE(EXCLUDED.titlept, current_movie.titlept),
    originaltitle = COALESCE(EXCLUDED.originaltitle, current_movie.originaltitle),
    year = COALESCE(EXCLUDED.year, current_movie.year),
    language = COALESCE(EXCLUDED.language, current_movie.language),
    hassubtitles = COALESCE(NULLIF(p_movie ->> 'hassubtitles', '')::boolean, current_movie.hassubtitles),
    posterurl = COALESCE(EXCLUDED.posterurl, current_movie.posterurl),
    videourl = COALESCE(EXCLUDED.videourl, current_movie.videourl),
    trailerurl = COALESCE(EXCLUDED.trailerurl, current_movie.trailerurl),
    subtitleurl = COALESCE(EXCLUDED.subtitleurl, current_movie.subtitleurl),
    description = COALESCE(EXCLUDED.description, current_movie.description),
    type = COALESCE(EXCLUDED.type, current_movie.type),
    awards = COALESCE(EXCLUDED.awards, current_movie.awards),
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
    id = COALESCE(EXCLUDED.id, current_description.id),
    title = COALESCE(EXCLUDED.title, current_description.title),
    descriptionen = COALESCE(EXCLUDED.descriptionen, current_description.descriptionen),
    descriptionpt = COALESCE(EXCLUDED.descriptionpt, current_description.descriptionpt),
    descriptionhi = COALESCE(EXCLUDED.descriptionhi, current_description.descriptionhi),
    descriptionru = COALESCE(EXCLUDED.descriptionru, current_description.descriptionru),
    descriptionit = COALESCE(EXCLUDED.descriptionit, current_description.descriptionit);

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
    id = COALESCE(EXCLUDED.id, current_technicaldetails.id),
    title = COALESCE(EXCLUDED.title, current_technicaldetails.title),
    duration = COALESCE(EXCLUDED.duration, current_technicaldetails.duration),
    genres = COALESCE(EXCLUDED.genres, current_technicaldetails.genres),
    director = COALESCE(EXCLUDED.director, current_technicaldetails.director),
    sourcelabel = COALESCE(EXCLUDED.sourcelabel, current_technicaldetails.sourcelabel),
    castmembers = COALESCE(EXCLUDED.castmembers, current_technicaldetails.castmembers),
    cinematographers = COALESCE(EXCLUDED.cinematographers, current_technicaldetails.cinematographers),
    composers = COALESCE(EXCLUDED.composers, current_technicaldetails.composers),
    themes = COALESCE(EXCLUDED.themes, current_technicaldetails.themes),
    rating = COALESCE(EXCLUDED.rating, current_technicaldetails.rating);

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
      archiveid = COALESCE(EXCLUDED.archiveid, current_identifiers.archiveid),
      imdbid = COALESCE(EXCLUDED.imdbid, current_identifiers.imdbid),
      omdbid = COALESCE(EXCLUDED.omdbid, current_identifiers.omdbid),
      openmdbid = COALESCE(EXCLUDED.openmdbid, current_identifiers.openmdbid),
      googleknowid = COALESCE(EXCLUDED.googleknowid, current_identifiers.googleknowid),
      ofdbid = COALESCE(EXCLUDED.ofdbid, current_identifiers.ofdbid),
      commons = COALESCE(EXCLUDED.commons, current_identifiers.commons),
      youtube = COALESCE(EXCLUDED.youtube, current_identifiers.youtube),
      updatedat = now();
  END IF;
END;
$function$


REVOKE ALL ON FUNCTION public.classicflix_import_movie_atomic(jsonb,jsonb,jsonb,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.classicflix_import_movie_atomic(jsonb,jsonb,jsonb,jsonb) TO authenticated;
