import { WikidataPublicDomainProduction } from './wikidataService';
import { fetchMovieIdentifiers } from './videoSourceService';
import { getTmdbMovieDetails, searchTmdbMovies } from './tmdbService';

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
  year: number;
  overview: string;
  posterUrl: string;
  director: string;
  genres: string[];
  duration: string;
  rating: string;
  imdbId: string;
  pageUrl: string;
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
  warnings: string[];
}

const clean = (value: unknown): string => String(value ?? '').trim();
const normalize = (value: string): string =>
  value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

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

const searchTmdb = async (title: string, year: number, imdbId?: string): Promise<TmdbMetadataCandidate[]> => {
  const candidates: TmdbMetadataCandidate[] = [];
  if (imdbId) {
    const response = await fetch(
      `https://api.themoviedb.org/3/find/${encodeURIComponent(imdbId)}?api_key=${import.meta.env.VITE_TMDB_API_KEY || 'e6a44aa8865934c03ad582bc72c5b85d'}&external_source=imdb_id&language=pt-BR`
    );
    if (response.ok) {
      const data = await response.json();
      const found = data.movie_results?.[0];
      if (found?.id) {
        const details = await getTmdbMovieDetails(String(found.id), 'pt-BR');
        if (details) candidates.push(mapTmdbCandidate(String(found.id), details));
      }
    }
  }
  if (candidates.length === 0) {
    const results = await searchTmdbMovies(title, 'pt-BR');
    const ranked = results
      .map((result: any) => {
        const titleScore = normalize(result.originalTitle || result.title) === normalize(title) ? 2 : 0;
        const yearScore = year && result.year === year ? 1 : 0;
        return { result, score: titleScore + yearScore };
      })
      .filter((entry: any) => entry.score >= 2)
      .sort((a: any, b: any) => b.score - a.score)
      .slice(0, 3);
    for (const entry of ranked) {
      const id = clean(entry.result.id).replace(/^tmdb-/, '');
      const details = await getTmdbMovieDetails(id, 'pt-BR');
      if (details) candidates.push(mapTmdbCandidate(id, details));
    }
  }
  return candidates;
};

const mapTmdbCandidate = (id: string, details: any): TmdbMetadataCandidate => ({
  tmdbId: id,
  title: clean(details.title),
  originalTitle: clean(details.originalTitle),
  year: Number(details.year) || 0,
  overview: clean(details.description),
  posterUrl: clean(details.posterUrl),
  director: clean(details.director) === 'Unknown' ? '' : clean(details.director),
  genres: Array.isArray(details.genres) ? details.genres : [],
  duration: clean(details.duration),
  rating: clean(details.rating),
  imdbId: clean(details.wikidataId),
  pageUrl: `https://www.themoviedb.org/movie/${id}`,
});

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
    searchTmdb(item.originalTitle, item.year, item.imdbId),
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
          metadata: { title: candidate.title, year: candidate.year, rating: candidate.rating },
        });
      }
    }
  } else result.warnings.push('A consulta ao TMDb falhou ou não retornou correspondências confiáveis.');

  if (result.identifiers.youtubeId) {
    result.media.push({
      id: `youtube:${result.identifiers.youtubeId}`,
      source: 'youtube',
      media_type: 'video',
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
