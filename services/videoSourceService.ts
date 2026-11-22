import { Movie } from '../types';
import { getSupabase } from './bd';
import { updateSupabaseMovie } from './supabaseClient';

export interface VideoSources {
    commons: string | null;
    youtube: string | null;
    archiveid: string | null;
    directUrl?: string | null;
    imdbId?: string | null;
    tmdbCompanyId?: string | null;
    tmdbId?: string | null;
}

export interface SearchVideoResult {
    success: boolean;
    directUrl: string | null;
    source: 'archive' | 'commons' | 'youtube' | null;
    archiveId?: string;
    imdbId?: string;
    tmdbCompanyId?: string;
    tmdbId?: string;
    commonsTitle?: string;
    message: string;
}

/**
 * Searches external movie identifiers from Wikidata SPARQL:
 * - P724 / P1170: Internet Archive ID
 * - P345: IMDb ID
 * - P4985: TMDB Movie ID
 * - P272 -> P3968: TMDB Company ID (production company)
 * - P10: Wikimedia Commons video
 * - P1651: YouTube video ID
 */
const emptyIds = () => ({ archiveId: null, imdbId: null, tmdbCompanyId: null, tmdbId: null, commonsVideo: null, youtubeId: null });
const extractYouTubeId = (value?: string | null): string | null => {
    if (!value) return null;
    const raw = value.trim();
    if (/^[\\w-]{11}$/.test(raw)) return raw;
    try {
        const u = new URL(raw);
        const id = u.hostname.includes('youtu.be') ? u.pathname.split('/').filter(Boolean)[0]
            : u.searchParams.get('v') || u.pathname.match(/\\/(?:embed|shorts|live|v)\\/([^/?]+)/)?.[1];
        return id && /^[\\w-]{11}$/.test(id) ? id : null;
    } catch { return null; }
};
const cleanTitle = (s = '') => s.normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const similarity = (candidate: string, titles: string[]) => {
    const a = cleanTitle(candidate);
    if (!a) return 0;
    return Math.max(0, ...titles.map(t => {
        const b = cleanTitle(t);
        if (a === b) return 1;
        if (a.includes(b) || b.includes(a)) return 0.82;
        const aa = new Set(a.split(' ').filter(x => x.length > 1));
        const bb = new Set(b.split(' ').filter(x => x.length > 1));
        return [...aa].filter(x => bb.has(x)).length / Math.max(aa.size, bb.size, 1);
    }));
};
const fetchJson = async (url: string) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    try {
        const res = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
    } finally { clearTimeout(timer); }
};

export const fetchMovieIdentifiers = async (qid: string): Promise<{
    archiveId: string | null; imdbId: string | null; tmdbCompanyId: string | null;
    tmdbId: string | null; commonsVideo: string | null; youtubeId: string | null;
}> => {
    if (!/^Q\\d+$/.test(qid || '')) return emptyIds();
    const query = `
      SELECT ?archive ?archiveAlt ?imdb ?tmdbMovie ?tmdbTv ?companyTmdb ?commons ?youtube WHERE {
        BIND(wd:${qid} AS ?item)
        OPTIONAL { ?item wdt:P724 ?archive. }
        OPTIONAL { ?item wdt:P1170 ?archiveAlt. }
        OPTIONAL { ?item wdt:P345 ?imdb. }
        OPTIONAL { ?item wdt:P4947 ?tmdbMovie. }
        OPTIONAL { ?item wdt:P4985 ?tmdbTv. }
        OPTIONAL { ?item wdt:P272/wdt:P3968 ?companyTmdb. }
        OPTIONAL { ?item wdt:P10 ?commons. }
        OPTIONAL { ?item wdt:P1651 ?youtube. }
      } LIMIT 20`;
    try {
        const url = new URL('https://query.wikidata.org/sparql');
        url.searchParams.set('query', query); url.searchParams.set('format', 'json');
        const json = await fetchJson(url.toString());
        const rows = json.results?.bindings || [];
        const first = (k: string) => rows.map((r: any) => r[k]?.value).find(Boolean) || null;
        return { archiveId: first('archive') || first('archiveAlt'), imdbId: first('imdb'),
            tmdbCompanyId: first('companyTmdb'), tmdbId: first('tmdbMovie') || first('tmdbTv'),
            commonsVideo: first('commons'), youtubeId: extractYouTubeId(first('youtube')) };
    } catch (e) { console.warn('Wikidata identifiers failed:', e); return emptyIds(); }
};

/**
 * Searches and extracts a direct playable video link from Internet Archive (Archive.org)
 * using the official Metadata and Advanced Search APIs.
 */
export const searchArchiveOrg = async (options: {
    title: string; originalTitle?: string; year?: number; archiveId?: string; imdbId?: string;
}): Promise<{ directUrl: string | null; archiveId: string | null; fileName: string | null; format: string | null }> => {
    const titles = [...new Set([options.originalTitle, options.title].filter(Boolean) as string[])];
    const candidates = new Map<string, any>();
    if (options.archiveId?.trim()) candidates.set(options.archiveId.trim(), { identifier: options.archiveId.trim(), title: titles[0], score: 1 });
    const queries: string[] = [];
    if (options.imdbId) queries.push(`mediatype:movies AND "${options.imdbId.replace(/[^a-zA-Z0-9]/g, '')}"`);
    for (const t of titles) {
        const safe = t.replace(/["\\\\]/g, ' ').replace(/\\s+/g, ' ').trim();
        if (!safe) continue;
        if (options.year) queries.push(`mediatype:movies AND title:"${safe}" AND year:${options.year}`);
        queries.push(`mediatype:movies AND title:"${safe}"`);
    }
    for (const q of queries) {
        try {
            const u = new URL('https://archive.org/advancedsearch.php');
            u.searchParams.set('q', q);
            ['identifier','title','year','downloads','mediatype'].forEach(x => u.searchParams.append('fl[]', x));
            u.searchParams.set('sort[]','downloads desc'); u.searchParams.set('rows','12'); u.searchParams.set('output','json');
            const data = await fetchJson(u.toString());
            for (const d of data.response?.docs || []) {
                if (!d.identifier || (d.mediatype && d.mediatype !== 'movies')) continue;
                const score = similarity(d.title || '', titles) + (options.year && Number(d.year) === options.year ? 0.15 : 0);
                const prev = candidates.get(d.identifier);
                if (!prev || score > prev.score) candidates.set(d.identifier, { ...d, score });
            }
        } catch (e) { console.warn('Archive title search failed:', e); }
    }
    const ranked = [...candidates.values()].filter(x => x.score >= 0.68 || x.identifier === options.archiveId)
        .sort((a,b) => b.score-a.score || (Number(b.downloads)||0)-(Number(a.downloads)||0)).slice(0,8);
    for (const item of ranked) {
        try {
            const meta = await fetchJson(`https://archive.org/metadata/${encodeURIComponent(item.identifier)}`);
            if (meta.metadata?.mediatype !== 'movies') continue;
            if (similarity(meta.metadata?.title || item.title || '', titles) < 0.58) continue;\n            if (options.year && meta.metadata?.year && Math.abs(Number(meta.metadata.year) - options.year) > 2) continue;
            const files = (meta.files || []).filter((f:any) => {
                const n = String(f.name || '').toLowerCase(), fmt = String(f.format || '').toLowerCase();
                if (!/\\.(mp4|m4v|webm|ogv|ogg)(?:$|[?#])/i.test(n)) return false;
                if (/sample|trailer|preview|thumb|poster|cover|subtitle|torrent/.test(n)) return false;
                return fmt.includes('video') || fmt.includes('h.264') || fmt.includes('mpeg') || fmt.includes('webm') || fmt.includes('ogg') || f.source === 'original';
            }).sort((a:any,b:any) => {
                const rank=(f:any)=> (/\\.mp4$/i.test(f.name)?50:/\\.webm$/i.test(f.name)?30:10)+(String(f.format).toLowerCase().includes('h.264')?20:0)+(f.source==='original'?5:0);
                return rank(b)-rank(a);
            });
            const file=files[0]; if (!file?.name) continue;
            return { directUrl:`https://archive.org/download/${encodeURIComponent(item.identifier)}/${encodeURIComponent(file.name)}`,
                archiveId:item.identifier, fileName:file.name, format:file.format || null };
        } catch (e) { console.warn('Archive metadata failed:', item.identifier, e); }
    }
    return { directUrl:null, archiveId:null, fileName:null, format:null };
};

/**
 * Searches and extracts a direct playable video link from Wikimedia Commons using the official MediaWiki API
 */
export const searchWikimediaCommons = async (options: {
    title: string; originalTitle?: string; commonsUrl?: string | null;
}): Promise<{ directUrl: string | null; fileName: string | null; pageUrl: string | null }> => {
    const resolveFile = async (name: string) => {
        const clean = name.replace(/^File:/i,'').replace(/_/g,' ').trim();
        const u = new URL('https://commons.wikimedia.org/w/api.php');
        u.searchParams.set('action','query'); u.searchParams.set('titles',`File:${clean}`);
        u.searchParams.set('prop','imageinfo'); u.searchParams.set('iiprop','url|mime|size');
        u.searchParams.set('format','json'); u.searchParams.set('origin','*');
        try {
            const data=await fetchJson(u.toString());
            const page:any=Object.values(data.query?.pages || {})[0], info=page?.imageinfo?.[0];
            const mime=String(info?.mime||'').toLowerCase(), fileUrl=String(info?.url||'');
            if (!fileUrl || !(mime.startsWith('video/') || /\\.(mp4|m4v|webm|ogv|ogg)(?:$|[?#])/i.test(fileUrl))) return null;
            return { directUrl:fileUrl.replace(/^http:/,'https:'), fileName:clean,
                pageUrl:`https://commons.wikimedia.org/wiki/File:${encodeURIComponent(clean.replace(/ /g,'_'))}` };
        } catch { return null; }
    };
    if (options.commonsUrl) {
        try {
            const u=new URL(options.commonsUrl);
            const m=u.pathname.match(/Special:FilePath\\/(.+)$/i) || u.pathname.match(/\\/wiki\\/File:(.+)$/i);
            if (m?.[1]) { const exact=await resolveFile(decodeURIComponent(m[1]).split('/')[0]); if (exact) return exact; }
        } catch { /* invalid URL: title search below */ }
    }
    const titles=[...new Set([options.originalTitle,options.title].filter(Boolean) as string[])];
    for (const title of titles) for (const term of [`${title} filetype:video`,`${title} film video`]) {
        try {
            const u=new URL('https://commons.wikimedia.org/w/api.php');
            u.searchParams.set('action','query'); u.searchParams.set('generator','search');
            u.searchParams.set('gsrsearch',term); u.searchParams.set('gsrnamespace','6'); u.searchParams.set('gsrlimit','30');
            u.searchParams.set('prop','imageinfo'); u.searchParams.set('iiprop','url|mime|size'); u.searchParams.set('format','json'); u.searchParams.set('origin','*');
            const data=await fetchJson(u.toString());
            const pages:any[]=Object.values(data.query?.pages||{}).sort((a:any,b:any)=>similarity(b.title.replace(/^File:/i,''),titles)-similarity(a.title.replace(/^File:/i,''),titles));
            for (const p of pages) {
                if (similarity(String(p.title||'').replace(/^File:/i,''),titles)<0.58) continue;
                const info=p.imageinfo?.[0], mime=String(info?.mime||'').toLowerCase(), url=String(info?.url||'');
                if (!(mime.startsWith('video/') || /\\.(mp4|m4v|webm|ogv|ogg)(?:$|[?#])/i.test(url))) continue;
                const valid=await resolveFile(p.title); if (valid) return valid;
            }
        } catch (e) { console.warn('Commons search failed:',e); }
    }
    return { directUrl:null,fileName:null,pageUrl:null };
};

/**
 * Searches Archive.org & Wikimedia Commons for a direct movie stream link,
 * saves it to the database (Supabase movies & identifiers table),
 * and connects it to the movie.
 */
const searchYouTubeByTitle = async (movie: Movie): Promise<string | null> => {
    const titles = [...new Set([movie.originalTitle, movie.title, movie.titlePt].filter(Boolean) as string[])];
    for (const title of titles) {
        try {
            const query = [title, movie.year || '', 'full movie'].filter(Boolean).join(' ');
            const data = await fetchJson(`/api/video/youtube-search?q=${encodeURIComponent(query)}`);
            const items = data.items || [];
            const ranked = items.map((item: any) => ({
                item,
                score: similarity(item.title || '', titles),
                duration: Number(item.durationSeconds || 0),
            })).filter((x: any) => x.score >= 0.72 && x.duration >= 480 &&
                !/trailer|teaser|review|reaction|soundtrack|interview|behind the scenes|clip|shorts/i.test(x.item.title || ''))
              .sort((a: any, b: any) => b.score - a.score || b.duration - a.duration);
            const id = ranked[0]?.item?.videoId;
            if (id && /^[\\w-]{11}$/.test(id)) return id;
        } catch (error) {
            // YouTube title search is optional; keep Archive and Commons available if the API key is absent.
            console.info('YouTube title search unavailable:', error);
        }
    }
    return null;
};

export const findAndSaveMovieVideoSource = async (movie: Movie): Promise<SearchVideoResult> => {
    try {
        let archiveId=movie.identifiers?.archiveId, imdbId=movie.identifiers?.imdbId;
        let tmdbCompanyId=movie.identifiers?.tmdbCompanyId, tmdbId=movie.identifiers?.tmdbId;
        let commonsVideo=movie.identifiers?.wikimediaCommons;
        let youtubeId=extractYouTubeId(movie.identifiers?.youtubeId);
        if (movie.wikidataId && (!archiveId || !imdbId || !tmdbId || !commonsVideo || !youtubeId)) {
            const ids=await fetchMovieIdentifiers(movie.wikidataId);
            archiveId ||= ids.archiveId || undefined; imdbId ||= ids.imdbId || undefined;
            tmdbCompanyId ||= ids.tmdbCompanyId || undefined; tmdbId ||= ids.tmdbId || undefined;
            commonsVideo ||= ids.commonsVideo || undefined; youtubeId ||= ids.youtubeId || undefined;
        }
        const archive=await searchArchiveOrg({ title:movie.title, originalTitle:movie.originalTitle || movie.titlePt, year:movie.year, archiveId, imdbId });
        if (archive.directUrl) {
            await persistVideoSource({ movie,directUrl:archive.directUrl,archiveId:archive.archiveId||archiveId,imdbId,tmdbCompanyId,tmdbId,youtube:youtubeId ? `https://www.youtube.com/watch?v=${youtubeId}` : undefined });
            return { success:true,directUrl:archive.directUrl,source:'archive',archiveId:archive.archiveId||undefined,imdbId,tmdbCompanyId,tmdbId,message:`Vídeo validado no Internet Archive: ${archive.fileName}` };
        }
        const commons=await searchWikimediaCommons({ title:movie.title,originalTitle:movie.originalTitle || movie.titlePt,commonsUrl:commonsVideo });
        if (commons.directUrl) {
            await persistVideoSource({ movie,directUrl:commons.directUrl,commons:commons.directUrl,archiveId,imdbId,tmdbCompanyId,tmdbId,youtube:youtubeId ? `https://www.youtube.com/watch?v=${youtubeId}` : undefined });
            return { success:true,directUrl:commons.directUrl,source:'commons',commonsTitle:commons.fileName,archiveId:archiveId||undefined,imdbId,tmdbCompanyId,tmdbId,message:`Vídeo validado no Wikimedia Commons: ${commons.fileName}` };
        }
        youtubeId ||= await searchYouTubeByTitle(movie) || undefined;
        if (youtubeId) {
            const url=`https://www.youtube.com/watch?v=${youtubeId}`;
            await persistVideoSource({ movie,directUrl:url,youtube:url,archiveId,imdbId,tmdbCompanyId,tmdbId });
            return { success:true,directUrl:url,source:'youtube',archiveId:archiveId||undefined,imdbId,tmdbCompanyId,tmdbId,message:'Vídeo vinculado ao item no YouTube.' };
        }
        return { success:false,directUrl:null,source:null,archiveId:archiveId||undefined,imdbId,tmdbCompanyId,tmdbId,message:'Nenhum vídeo confiável encontrado. Livros, PDFs e arquivos sem formato de vídeo foram descartados.' };
    } catch (err:any) {
        console.error('Error in findAndSaveMovieVideoSource:',err);
        return { success:false,directUrl:null,source:null,message:err?.message||'Erro durante a busca da fonte de vídeo.' };
    }
};

/**
 * Persists the discovered video URL and identifiers in Supabase and in-memory movie object
 */
const persistVideoSource = async (data: {
    movie: Movie;
    directUrl: string;
    archiveId?: string;
    commons?: string;
    youtube?: string;
    imdbId?: string;
    tmdbCompanyId?: string;
    tmdbId?: string;
}) => {
    const { movie, directUrl, archiveId, commons, youtube, imdbId, tmdbCompanyId, tmdbId } = data;

    // Mutate movie object in place so the UI updates immediately
    movie.videoUrl = directUrl;
    if (!movie.identifiers) movie.identifiers = {};
    if (archiveId) movie.identifiers.archiveId = archiveId;
    if (imdbId) movie.identifiers.imdbId = imdbId;
    if (tmdbCompanyId) movie.identifiers.tmdbCompanyId = tmdbCompanyId;
    if (tmdbId) movie.identifiers.tmdbId = tmdbId;
    if (commons) movie.identifiers.wikimediaCommons = commons;\n    if (youtube) movie.identifiers.youtubeId = extractYouTubeId(youtube) || movie.identifiers.youtubeId;

    try {
        const supabase = await getSupabase();
        if (supabase) {
            // Update movies table
            if (movie.wikidataId) {
                await updateSupabaseMovie(movie.wikidataId, {
                    ...movie,
                    videoUrl: directUrl
                });

                // Update identifiers table
                await supabase.from('identifiers').upsert({
                    wikidataid: movie.wikidataId,
                    archiveid: archiveId || null,
                    commons: commons || null,
                    youtube: youtube || null,
                    updatedat: new Date().toISOString()
                }, { onConflict: 'wikidataid' });
            } else if (movie.id) {
                await supabase.from('movies').update({
                    videourl: directUrl
                }).eq('id', movie.id);
            }
        }
    } catch (dbErr) {
        console.warn("Could not persist video source to Supabase:", dbErr);
    }
};

/**
 * Backwards compatibility helper for existing callers of getVideoSources
 */
export const getVideoSources = async (qid: string): Promise<VideoSources> => {
    if (!qid || !qid.startsWith('Q')) {
        return { commons: null, youtube: null, archiveid: null };
    }

    const identifiers = await fetchMovieIdentifiers(qid);
    return {
        commons: identifiers.commonsVideo,
        youtube: identifiers.youtubeId ? `https://www.youtube.com/watch?v=${identifiers.youtubeId}` : null,
        archiveid: identifiers.archiveId,
        imdbId: identifiers.imdbId,
        tmdbCompanyId: identifiers.tmdbCompanyId,
        tmdbId: identifiers.tmdbId
    };
};
