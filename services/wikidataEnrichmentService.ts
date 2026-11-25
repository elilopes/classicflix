import { WikidataPublicDomainProduction } from './wikidataService';
import { fetchMovieIdentifiers } from './videoSourceService';
import { getTmdbMovieDetails, searchTmdbMovies } from './tmdbService';
import { getOmdbByTitleAndYear, getOmdbMovieDetails } from './omdbService';
import { getTvMazeByImdbId, searchTvMaze } from './tvmazeService';
import { translateWikidataMetadata } from './translateService';

export interface ImportMediaCandidate {
  id: string;
  source: 'commons' | 'archive' | 'tmdb' | 'youtube';
  media_type: 'poster' | 'still' | 'video' | 'trailer';
  source_id: string;
  url: string;
  page_url?: string;
  license?: string;
  attribution?: string;
  metadata?: Record<string, unknown>;
}

export interface TmdbMetadataCandidate {
  tmdbId: string;
  title: string;
  originalTitle: string;
  localizedTitlePt?: string;
  localizedTitleEn?: string;
  year: number;
  overviewPt: string;
  posterUrl: string;
  director: string;
  genres: string[];
  cast: string[];
  duration: string;
  rating: string;
  imdbId: string;
  pageUrl: string;
  mediaType: 'movie' | 'tv';
}

export interface RatingSuggestion {
  value: string;
  source: 'tmdb' | 'omdb' | 'tvmaze' | 'wikidata';
  sourceLabel: string;
  url: string;
}

export interface TitleSuggestions {
  title?: string;
  titlePt?: string;
  titlePtSource?: 'wikidata' | 'tmdb' | 'translate';
  titlePtUrl?: string;
  originalTitle?: string;
}

export interface WikidataEnrichmentResult {
  media: ImportMediaCandidate[];
  tmdb: TmdbMetadataCandidate[];
  identifiers: {
    archiveId?: string;
    imdbId?: string;
    tmdbId?: string;
    youtubeId?: string;
    commonsVideo?: string;
  };
  rating?: RatingSuggestion;
  titleSuggestions?: TitleSuggestions;
  warnings: string[];
}

const clean = (value: unknown): string => String(value ?? '').trim();
const normalize = (value: string): string =>
  value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

const normalizeValidRating = (raw: unknown): string => {
  const str = clean(raw);
  if (!str || /^n\/?a$/i.test(str)) return '';
  const pct = str.match(/^(\d+(?:[.,]\d+)?)\s*%$/);
  if (pct) {
    const n = Number(pct[1].replace(',', '.'));
    if (Number.isFinite(n) && n > 0 && n <= 100) return (n / 10).toFixed(1);
    return '';
  }
  const frac100 = str.match(/^(\d+(?:[.,]\d+)?)\s*\/\s*100$/);
  if (frac100) {
    const n = Number(frac100[1].replace(',', '.'));
    if (Number.isFinite(n) && n > 0 && n <= 100) return (n / 10).toFixed(1);
    return '';
  }
  const frac10 = str.match(/^(\d+(?:[.,]\d+)?)\s*(?:\/\s*10)?$/);
  if (frac10) {
    const n = Number(frac10[1].replace(',', '.'));
    if (Number.isFinite(n) && n > 0 && n <= 10) return n.toFixed(1);
  }
  return '';
};

const fetchJson = async (url: string): Promise<any> => {
  const response = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`HTTP ${response.status} ao consultar ${new URL(url).hostname}`);
  return response.json();
};

const searchCommonsImages = async (title: string, p18Url?: string): Promise<ImportMediaCandidate[]> => {
  const terms = [`${title} film poster`, `${title} movie poster`];
  const candidates: ImportMediaCandidate[] = [];
  if (p18Url && p18Url.includes('upload.wikimedia.org')) {
    try {
      const fileName = decodeURIComponent(p18Url.split('/').pop() || '').replace(/\?.*$/, '');
      const directUrl = new URL('https://commons.wikimedia.org/w/api.php');
      directUrl.search = new URLSearchParams({ action: 'query', titles: `File:${fileName}`, prop: 'imageinfo', iiprop: 'url|extmetadata|mime|size', format: 'json', origin: '*' }).toString();
      const directData = await fetchJson(directUrl.toString());
      const page = Object.values(directData.query?.pages || {})[0] as any;
      const info = page?.imageinfo?.[0];
      if (info?.url) {
        const meta = info.extmetadata || {};
        const license = clean(meta.LicenseShortName?.value || meta.License?.value);
        const artist = clean(meta.Artist?.value).replace(/<[^>]*>/g, '');
        candidates.push({
          id: `commons-p18:${fileName}`, source: 'commons', media_type: 'poster', source_id: fileName,
          url: info.thumburl || info.url, page_url: `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(fileName)}`,
          license: license || undefined, attribution: clean(meta.Attribution?.value || meta.Credit?.value).replace(/<[^>]*>/g, '') || artist || undefined,
          metadata: { sourceProperty: 'Wikidata P18', mime: info.mime, width: info.width, height: info.height, artist },
        });
      }
    } catch { /* continue with title-based Commons search */ }
  }
  for (const term of terms) {
    const url = new URL('https://commons.wikimedia.org/w/api.php');
    url.search = new URLSearchParams({
      action: 'query',
      generator: 'search',
      gsrsearch: term,
      gsrnamespace: '6',
      gsrlimit: '6',
      prop: 'imageinfo',
      iiprop: 'url|extmetadata|mime|size',
      iiurlwidth: '700',
      format: 'json',
      origin: '*',
    }).toString();
    const data = await fetchJson(url.toString());
    const pages = Object.values(data.query?.pages || {}) as any[];
    for (const page of pages) {
      const info = page.imageinfo?.[0];
      if (!info?.url || !String(info.mime || '').startsWith('image/')) continue;
      const meta = info.extmetadata || {};
      const fileName = clean(page.title).replace(/^File:/i, '');
      const license = clean(meta.LicenseShortName?.value || meta.License?.value);
      const artist = clean(meta.Artist?.value).replace(/<[^>]*>/g, '');
      const attribution = clean(meta.Attribution?.value || meta.Credit?.value).replace(/<[^>]*>/g, '') || artist;
      const candidate: ImportMediaCandidate = {
        id: `commons:${fileName}`,
        source: 'commons',
        media_type: /poster|cartaz/i.test(fileName) ? 'poster' : 'still',
        source_id: fileName,
        url: info.thumburl || info.url,
        page_url: `https://commons.wikimedia.org/wiki/${encodeURIComponent(page.title).replace(/%3A/i, ':')}`,
        license: license || undefined,
        attribution: attribution || undefined,
        metadata: { title: page.title, mime: info.mime, width: info.width, height: info.height, artist },
      };
      if (!candidates.some((item) => item.source_id === candidate.source_id)) candidates.push(candidate);
    }
    if (candidates.length >= 6) break;
  }
  return candidates.slice(0, 6);
};

const searchArchiveItems = async (
  title: string,
  year: number,
  knownArchiveId?: string,
): Promise<ImportMediaCandidate[]> => {
  const identifiers = new Set<string>();
  if (knownArchiveId) identifiers.add(knownArchiveId);
  const q = year
    ? `title:("${title.replace(/["']/g, ' ')}") AND year:${year} AND mediatype:(movies)`
    : `title:("${title.replace(/["']/g, ' ') }") AND mediatype:(movies)`;
  const searchUrl = `https://archive.org/advancedsearch.php?q=${encodeURIComponent(q)}&fl[]=identifier,title,year,description&rows=5&output=json`;
  const search = await fetchJson(searchUrl);
  for (const doc of search.response?.docs || []) if (doc.identifier) identifiers.add(doc.identifier);

  const candidates: ImportMediaCandidate[] = [];
  for (const identifier of Array.from(identifiers).slice(0, 5)) {
    const metadata = await fetchJson(`https://archive.org/metadata/${encodeURIComponent(identifier)}`);
    const files: any[] = metadata.files || [];
    const videoFiles = files.filter((file) => {
      const name = clean(file.name).toLowerCase();
      return (name.endsWith('.mp4') || name.endsWith('.webm') || name.endsWith('.ogv')) &&
        !/(trailer|sample|preview|thumb)/.test(name);
    });
    const best = videoFiles.find((file) => file.format === 'h.264' && clean(file.name).endsWith('.mp4')) ||
      videoFiles.find((file) => clean(file.name).endsWith('.mp4')) || videoFiles[0];
    if (!best) continue;
    const license = clean(metadata.metadata?.licenseurl || metadata.metadata?.rights);
    candidates.push({
      id: `archive:${identifier}:${best.name}`,
      source: 'archive',
      media_type: 'video',
      source_id: identifier,
      url: `https://archive.org/download/${encodeURIComponent(identifier)}/${encodeURIComponent(best.name)}`,
      page_url: `https://archive.org/details/${encodeURIComponent(identifier)}`,
      license: license || undefined,
      attribution: clean(metadata.metadata?.creator) || undefined,
      metadata: {
        title: metadata.metadata?.title,
        year: metadata.metadata?.year,
        fileName: best.name,
        format: best.format,
        size: best.size,
        mediatype: metadata.metadata?.mediatype,
      },
    });
  }
  return candidates;
};

const getTmdbTvDetails = async (id: string): Promise<any | null> => {
  const key = import.meta.env.VITE_TMDB_API_KEY || 'e6a44aa8865934c03ad582bc72c5b85d';
  const response = await fetch(`https://api.themoviedb.org/3/tv/${encodeURIComponent(id)}?api_key=${key}&language=pt-BR&append_to_response=aggregate_credits,external_ids,translations`);
  if (!response.ok) return null;
  const data = await response.json();
  const translationsList: any[] = Array.isArray(data.translations?.translations) ? data.translations.translations : [];
  const ptBrTrans = translationsList.find((tr) => tr.iso_639_1 === 'pt' && tr.iso_3166_1 === 'BR' && tr.data?.name);
  const ptAnyTrans = translationsList.find((tr) => tr.iso_639_1 === 'pt' && tr.data?.name);
  const enTrans = translationsList.find((tr) => tr.iso_639_1 === 'en' && tr.data?.name);
  const localizedTitlePt = clean(ptBrTrans?.data?.name || ptAnyTrans?.data?.name);
  const localizedTitleEn = clean(enTrans?.data?.name);

  const crew = data.aggregate_credits?.crew || [];
  const director = crew.find((person: any) => person.jobs?.some((job: any) => job.job === 'Director'))?.name ||
    (data.created_by || []).map((person: any) => person.name).join(', ') || '';
  const cast = (data.aggregate_credits?.cast || []).slice(0, 10).map((person: any) => person.name);
  const numericVote = Number(data.vote_average);
  const validRating = Number.isFinite(numericVote) && numericVote > 0 ? numericVote.toFixed(1) : '';
  return {
    title: data.name,
    originalTitle: data.original_name,
    localizedTitlePt,
    localizedTitleEn,
    description: data.overview,
    year: data.first_air_date ? new Date(data.first_air_date).getFullYear() : 0,
    posterUrl: data.poster_path ? `https://image.tmdb.org/t/p/w342${data.poster_path}` : '',
    director,
    genres: (data.genres || []).map((genre: any) => genre.name),
    duration: data.episode_run_time?.[0] ? `${data.episode_run_time[0]}m` : '',
    rating: validRating,
    wikidataId: data.external_ids?.imdb_id || '',
    cast,
  };
};

const searchTmdb = async (
  title: string,
  year: number,
  imdbId?: string,
  knownTmdbId?: string,
  isTv = false,
  fallbackTitle?: string,
): Promise<TmdbMetadataCandidate[]> => {
  const candidates: TmdbMetadataCandidate[] = [];
  const getDetails = (id: string) => isTv ? getTmdbTvDetails(id) : getTmdbMovieDetails(id, 'pt-BR');

  if (knownTmdbId && /^\d+$/.test(knownTmdbId)) {
    const details = await getDetails(knownTmdbId);
    if (details) candidates.push(mapTmdbCandidate(knownTmdbId, details, isTv));
  }

  if (candidates.length === 0 && imdbId) {
    const key = import.meta.env.VITE_TMDB_API_KEY || 'e6a44aa8865934c03ad582bc72c5b85d';
    const response = await fetch(`https://api.themoviedb.org/3/find/${encodeURIComponent(imdbId)}?api_key=${key}&external_source=imdb_id&language=pt-BR`);
    if (response.ok) {
      const data = await response.json();
      const found = isTv ? data.tv_results?.[0] : data.movie_results?.[0];
      if (found?.id) {
        const details = await getDetails(String(found.id));
        if (details) candidates.push(mapTmdbCandidate(String(found.id), details, isTv));
      }
    }
  }

  if (candidates.length === 0) {
    const key = import.meta.env.VITE_TMDB_API_KEY || 'e6a44aa8865934c03ad582bc72c5b85d';
    const queryTitles = Array.from(new Set([clean(title), clean(fallbackTitle)].filter(Boolean)));
    for (const qTitle of queryTitles) {
      const results = isTv
        ? await (async () => {
            const response = await fetch(`https://api.themoviedb.org/3/search/tv?api_key=${key}&query=${encodeURIComponent(qTitle)}&language=pt-BR`);
            if (!response.ok) return [];
            const data = await response.json();
            return (data.results || []).map((entry: any) => ({
              id: `tmdb-${entry.id}`,
              title: entry.name,
              originalTitle: entry.original_name,
              year: entry.first_air_date ? new Date(entry.first_air_date).getFullYear() : 0,
            }));
          })()
        : await searchTmdbMovies(qTitle, 'pt-BR');
      const ranked = results
        .map((result: any) => {
          const titleScore = normalize(result.originalTitle || result.title) === normalize(qTitle) ? 2 : 0;
          const yearScore = year && result.year === year ? 1 : 0;
          return { result, score: titleScore + yearScore };
        })
        .filter((entry: any) => entry.score >= 2)
        .sort((a: any, b: any) => b.score - a.score)
        .slice(0, 3);
      for (const entry of ranked) {
        const id = clean(entry.result.id).replace(/^tmdb-/, '');
        const details = await getDetails(id);
        if (details) candidates.push(mapTmdbCandidate(id, details, isTv));
      }
      if (candidates.length > 0) break;
    }
  }
  return candidates;
};

const mapTmdbCandidate = (id: string, details: any, isTv = false): TmdbMetadataCandidate => {
  const rawTitle = clean(details.title);
  const rawOriginal = clean(details.originalTitle);
  const localizedPt = clean(details.localizedTitlePt);
  const localizedEn = clean(details.localizedTitleEn);
  return {
    tmdbId: id,
    title: rawTitle,
    originalTitle: rawOriginal,
    localizedTitlePt: localizedPt || (rawTitle && normalize(rawTitle) !== normalize(rawOriginal) ? rawTitle : undefined),
    localizedTitleEn: localizedEn || undefined,
    year: Number(details.year) || 0,
    overviewPt: clean(details.description),
    posterUrl: clean(details.posterUrl),
    director: clean(details.director) === 'Unknown' ? '' : clean(details.director),
    genres: Array.isArray(details.genres) ? details.genres : [],
    cast: Array.isArray(details.cast) ? details.cast : [],
    duration: clean(details.duration),
    rating: normalizeValidRating(details.rating),
    imdbId: clean(details.wikidataId),
    pageUrl: `https://www.themoviedb.org/${isTv ? 'tv' : 'movie'}/${id}`,
    mediaType: isTv ? 'tv' : 'movie',
  };
};

const fetchWikidataReviewRating = async (qid: string): Promise<string> => {
  try {
    const res = await fetch(`/api/wikidata/entities?ids=${encodeURIComponent(qid)}&props=claims`);
    if (!res.ok) return '';
    const data = await res.json();
    const p444 = data?.entities?.[qid]?.claims?.P444;
    if (!Array.isArray(p444)) return '';
    for (const claim of p444) {
      const val = claim?.mainsnak?.datavalue?.value;
      const parsed = normalizeValidRating(typeof val === 'string' ? val : val?.text);
      if (parsed) return parsed;
    }
    return '';
  } catch {
    return '';
  }
};

const resolveRatingWithFallbacks = async (
  item: WikidataPublicDomainProduction,
  tmdbCandidates: TmdbMetadataCandidate[],
  effectiveImdbId?: string,
): Promise<RatingSuggestion | undefined> => {
  // 1. TMDb vote_average (> 0)
  const tmdbWithRating = tmdbCandidates.find((c) => Boolean(normalizeValidRating(c.rating)));
  if (tmdbWithRating) {
    return {
      value: normalizeValidRating(tmdbWithRating.rating),
      source: 'tmdb',
      sourceLabel: 'TMDb',
      url: tmdbWithRating.pageUrl,
    };
  }

  // 2. OMDb API (IMDb / Rotten Tomatoes / Metacritic)
  const imdbToQuery = effectiveImdbId || item.imdbId || tmdbCandidates[0]?.imdbId;
  try {
    const omdbDetails = imdbToQuery
      ? await getOmdbMovieDetails(imdbToQuery)
      : await getOmdbByTitleAndYear(item.originalTitle || item.wikidataLabel || '', item.year);
    const omdbRating = normalizeValidRating(omdbDetails?.rating);
    if (omdbRating) {
      const resolvedImdb = clean(omdbDetails?.imdbId || imdbToQuery);
      return {
        value: omdbRating,
        source: 'omdb',
        sourceLabel: 'OMDb / IMDb',
        url: resolvedImdb ? `https://www.imdb.com/title/${encodeURIComponent(resolvedImdb)}/` : 'https://www.omdbapi.com/',
      };
    }
  } catch {
    // continue to next rating fallback
  }

  // 3. TVMaze API (for TV series / programs / episodes or fallback)
  try {
    let tvmazeData: any = null;
    if (imdbToQuery) {
      tvmazeData = await getTvMazeByImdbId(imdbToQuery);
    }
    if (!tvmazeData && (item.tmdbType === 'tv' || item.instanceQid === 'Q5398426' || item.instanceQid === 'Q15416')) {
      const tvResults = await searchTvMaze(item.originalTitle || item.wikidataLabel || '');
      tvmazeData = tvResults.find((entry) => !item.year || !entry.year || Math.abs(entry.year - item.year) <= 1) || tvResults[0];
    }
    const tvmazeRating = normalizeValidRating(tvmazeData?.rating);
    if (tvmazeRating) {
      return {
        value: tvmazeRating,
        source: 'tvmaze',
        sourceLabel: 'TVMaze',
        url: 'https://www.tvmaze.com/',
      };
    }
  } catch {
    // continue to Wikidata P444
  }

  // 4. Wikidata P444 (review score)
  const wdRating = await fetchWikidataReviewRating(item.wikidataId);
  if (wdRating) {
    return {
      value: wdRating,
      source: 'wikidata',
      sourceLabel: 'Wikidata (P444)',
      url: `https://www.wikidata.org/wiki/${item.wikidataId}`,
    };
  }

  return undefined;
};

const resolveTitleSuggestions = async (
  item: WikidataPublicDomainProduction,
  tmdbCandidates: TmdbMetadataCandidate[],
): Promise<TitleSuggestions> => {
  const topTmdb = tmdbCandidates[0];
  const originalTitle = clean(item.originalTitle || topTmdb?.originalTitle || item.wikidataLabel);

  // Main / international title: prefer Wikidata label (usually EN) or TMDb EN when distinct from originalTitle
  const wdLabel = clean(item.wikidataLabel);
  const tmdbEn = clean(topTmdb?.localizedTitleEn);
  let mainTitle = originalTitle;
  if (wdLabel && normalize(wdLabel) !== normalize(originalTitle)) {
    mainTitle = wdLabel;
  } else if (tmdbEn && normalize(tmdbEn) !== normalize(originalTitle)) {
    mainTitle = tmdbEn;
  } else if (wdLabel) {
    mainTitle = wdLabel;
  }

  const isOriginalPortuguese = /^portugu/i.test(clean(item.language));
  let titlePt = '';
  let titlePtSource: TitleSuggestions['titlePtSource'];
  let titlePtUrl: string | undefined;

  const wdTitlePt = clean(item.titlePt);
  const tmdbTitlePt = clean(topTmdb?.localizedTitlePt);

  if (wdTitlePt && (isOriginalPortuguese || normalize(wdTitlePt) !== normalize(originalTitle))) {
    titlePt = wdTitlePt;
    titlePtSource = 'wikidata';
    titlePtUrl = `https://www.wikidata.org/wiki/${item.wikidataId}`;
  } else if (tmdbTitlePt && (isOriginalPortuguese || normalize(tmdbTitlePt) !== normalize(originalTitle))) {
    titlePt = tmdbTitlePt;
    titlePtSource = 'tmdb';
    titlePtUrl = topTmdb?.pageUrl;
  } else if (isOriginalPortuguese) {
    titlePt = wdTitlePt || originalTitle;
    titlePtSource = 'wikidata';
    titlePtUrl = `https://www.wikidata.org/wiki/${item.wikidataId}`;
  } else {
    const sourceToTranslate = mainTitle || originalTitle;
    if (sourceToTranslate) {
      try {
        const translated = await translateWikidataMetadata({ title: sourceToTranslate, to: 'pt' });
        const translatedPt = clean(translated?.titlePt);
        if (translatedPt) {
          titlePt = translatedPt;
          titlePtSource = 'translate';
          titlePtUrl = `https://www.wikidata.org/wiki/${item.wikidataId}`;
        }
      } catch {
        titlePt = wdTitlePt || tmdbTitlePt || '';
      }
    }
  }

  return {
    title: mainTitle || undefined,
    titlePt: titlePt || undefined,
    titlePtSource,
    titlePtUrl,
    originalTitle: originalTitle || undefined,
  };
};

export const loadWikidataEnrichment = async (
  item: WikidataPublicDomainProduction,
): Promise<WikidataEnrichmentResult> => {
  const result: WikidataEnrichmentResult = {
    media: [],
    tmdb: [],
    identifiers: {},
    warnings: [],
  };
  const [ids, commons, archive, tmdb] = await Promise.allSettled([
    fetchMovieIdentifiers(item.wikidataId),
    searchCommonsImages(item.originalTitle, item.posterUrl),
    searchArchiveItems(item.originalTitle, item.year, item.archiveId),
    searchTmdb(
      item.originalTitle,
      item.year,
      item.imdbId,
      item.tmdbId,
      item.tmdbType === 'tv' || item.instanceQid === 'Q5398426',
      item.wikidataLabel,
    ),
  ]);

  if (ids.status === 'fulfilled') {
    result.identifiers = {
      archiveId: ids.value.archiveId || item.archiveId,
      imdbId: ids.value.imdbId || item.imdbId,
      tmdbId: ids.value.tmdbId || undefined,
      youtubeId: ids.value.youtubeId || item.youtubeId,
      commonsVideo: ids.value.commonsVideo || undefined,
    };
  } else result.warnings.push('Não foi possível consultar identificadores adicionais no Wikidata.');

  if (commons.status === 'fulfilled') result.media.push(...commons.value);
  else result.warnings.push('A busca de imagens no Wikimedia Commons falhou.');

  if (archive.status === 'fulfilled') result.media.push(...archive.value);
  else result.warnings.push('A busca de vídeos no Internet Archive falhou.');

  if (tmdb.status === 'fulfilled') {
    result.tmdb = tmdb.value;
    for (const candidate of tmdb.value) {
      if (candidate.posterUrl) {
        result.media.push({
          id: `tmdb:${candidate.tmdbId}:poster`,
          source: 'tmdb',
          media_type: 'poster',
          source_id: candidate.tmdbId,
          url: candidate.posterUrl,
          page_url: candidate.pageUrl,
          metadata: { title: candidate.title, year: candidate.year, rating: candidate.rating, tmdbMediaType: candidate.mediaType },
        });
      }
    }
  } else result.warnings.push('A consulta ao TMDb falhou ou não retornou correspondências confiáveis.');

  const [ratingResult, titleSuggestions] = await Promise.all([
    resolveRatingWithFallbacks(item, result.tmdb, result.identifiers.imdbId),
    resolveTitleSuggestions(item, result.tmdb),
  ]);
  result.rating = ratingResult;
  result.titleSuggestions = titleSuggestions;

  if (result.identifiers.youtubeId) {
    result.media.push({
      id: `youtube:${result.identifiers.youtubeId}`,
      source: 'youtube',
      media_type: 'trailer',
      source_id: result.identifiers.youtubeId,
      url: `https://www.youtube.com/watch?v=${result.identifiers.youtubeId}`,
      page_url: `https://www.youtube.com/watch?v=${result.identifiers.youtubeId}`,
      metadata: { sourceProperty: 'Wikidata P1651' },
    });
  }
  if (result.identifiers.commonsVideo) {
    result.media.push({
      id: `commons-video:${result.identifiers.commonsVideo}`,
      source: 'commons',
      media_type: 'video',
      source_id: result.identifiers.commonsVideo,
      url: result.identifiers.commonsVideo,
      page_url: result.identifiers.commonsVideo,
      metadata: { sourceProperty: 'Wikidata P10' },
    });
  }
  return result;
};
