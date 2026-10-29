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
export const fetchMovieIdentifiers = async (qid: string): Promise<{
    archiveId: string | null;
    imdbId: string | null;
    tmdbCompanyId: string | null;
    tmdbId: string | null;
    commonsVideo: string | null;
    youtubeId: string | null;
}> => {
    if (!qid || !qid.startsWith('Q')) {
        return { archiveId: null, imdbId: null, tmdbCompanyId: null, tmdbId: null, commonsVideo: null, youtubeId: null };
    }

    const endpoint = "https://query.wikidata.org/sparql";
    const sparqlQuery = `
        SELECT ?archive ?archiveAlt ?imdb ?tmdb ?companyTmdb ?commons ?youtube WHERE {
            BIND(wd:${qid} AS ?item)
            OPTIONAL { ?item wdt:P724 ?archive. }
            OPTIONAL { ?item wdt:P1170 ?archiveAlt. }
            OPTIONAL { ?item wdt:P345 ?imdb. }
            OPTIONAL { ?item wdt:P4985 ?tmdb. }
            OPTIONAL { 
                ?item wdt:P272 ?company. 
                OPTIONAL { ?company wdt:P3968 ?companyTmdb. }
            }
            OPTIONAL { ?item wdt:P10 ?commons. }
            OPTIONAL { ?item wdt:P1651 ?youtube. }
        }
        LIMIT 1
    `;

    try {
        const url = new URL(endpoint);
        url.searchParams.append("query", sparqlQuery);
        url.searchParams.append("format", "json");
        url.searchParams.append("origin", "*");

        const response = await fetch(url.toString());
        if (!response.ok) return { archiveId: null, imdbId: null, tmdbCompanyId: null, tmdbId: null, commonsVideo: null, youtubeId: null };

        const data = await response.json();
        const binding = data.results?.bindings?.[0];
        if (!binding) return { archiveId: null, imdbId: null, tmdbCompanyId: null, tmdbId: null, commonsVideo: null, youtubeId: null };

        return {
            archiveId: binding.archive?.value || binding.archiveAlt?.value || null,
            imdbId: binding.imdb?.value || null,
            tmdbCompanyId: binding.companyTmdb?.value || null,
            tmdbId: binding.tmdb?.value || null,
            commonsVideo: binding.commons?.value || null,
            youtubeId: binding.youtube?.value || null,
        };
    } catch (e) {
        console.warn("Error fetching Wikidata identifiers:", e);
        return { archiveId: null, imdbId: null, tmdbCompanyId: null, tmdbId: null, commonsVideo: null, youtubeId: null };
    }
};

/**
 * Searches and extracts a direct playable video link from Internet Archive (Archive.org)
 * using the official Metadata and Advanced Search APIs.
 */
export const searchArchiveOrg = async (options: {
    title: string;
    originalTitle?: string;
    year?: number;
    archiveId?: string;
    imdbId?: string;
}): Promise<{
    directUrl: string | null;
    archiveId: string | null;
    fileName: string | null;
    format: string | null;
}> => {
    let candidateIdentifiers: string[] = [];

    // 1. If explicit archiveId provided, test that first
    if (options.archiveId) {
        candidateIdentifiers.push(options.archiveId.trim());
    }

    // 2. Search Archive.org Advanced Search API
    try {
        const queries: string[] = [];
        
        if (options.imdbId) {
            queries.push(`(description:"${options.imdbId}" OR "${options.imdbId}") AND mediatype:(movies)`);
        }
        
        const cleanTitle = options.title.replace(/[:"']/g, ' ').trim();
        if (options.year) {
            queries.push(`title:("${cleanTitle}") AND year:${options.year} AND mediatype:(movies)`);
            queries.push(`"${cleanTitle}" AND year:${options.year} AND mediatype:(movies)`);
        }
        queries.push(`title:("${cleanTitle}") AND mediatype:(movies)`);

        for (const q of queries) {
            const searchUrl = `https://archive.org/advancedsearch.php?q=${encodeURIComponent(q)}&fl[]=identifier,title,downloads,year&sort[]=downloads+desc&rows=5&output=json`;
            const res = await fetch(searchUrl);
            if (res.ok) {
                const json = await res.json();
                const docs = json.response?.docs || [];
                for (const doc of docs) {
                    if (doc.identifier && !candidateIdentifiers.includes(doc.identifier)) {
                        candidateIdentifiers.push(doc.identifier);
                    }
                }
            }
            if (candidateIdentifiers.length >= 3) break;
        }
    } catch (err) {
        console.warn("Archive.org search query error:", err);
    }

    // 3. For each candidate identifier, inspect files via Archive.org Metadata API
    for (const id of candidateIdentifiers) {
        try {
            const metaRes = await fetch(`https://archive.org/metadata/${encodeURIComponent(id)}`);
            if (!metaRes.ok) continue;
            const metaData = await metaRes.json();
            const files: any[] = metaData.files || [];

            // Find best playable video file (MP4 h.264 > standard MP4 > WebM > OGV)
            const videoFiles = files.filter(f => {
                const name = (f.name || '').toLowerCase();
                const isTrailer = name.includes('trailer') || name.includes('sample') || name.includes('preview');
                return !isTrailer && (name.endsWith('.mp4') || name.endsWith('.webm') || name.endsWith('.ogv'));
            });

            if (videoFiles.length > 0) {
                // Priority: h.264 mp4 -> any mp4 -> webm -> ogv
                let bestFile = videoFiles.find(f => f.format === 'h.264' && f.name.endsWith('.mp4'));
                if (!bestFile) bestFile = videoFiles.find(f => f.name.endsWith('.mp4'));
                if (!bestFile) bestFile = videoFiles.find(f => f.name.endsWith('.webm'));
                if (!bestFile) bestFile = videoFiles[0];

                const directUrl = `https://archive.org/download/${id}/${encodeURIComponent(bestFile.name)}`;
                return {
                    directUrl,
                    archiveId: id,
                    fileName: bestFile.name,
                    format: bestFile.format || 'mp4'
                };
            }
        } catch (fileErr) {
            console.warn(`Error resolving files for Archive.org ${id}:`, fileErr);
        }
    }

    return { directUrl: null, archiveId: null, fileName: null, format: null };
};

/**
 * Searches and extracts a direct playable video link from Wikimedia Commons using the official MediaWiki API
 */
export const searchWikimediaCommons = async (options: {
    title: string;
    originalTitle?: string;
    commonsUrl?: string | null;
}): Promise<{
    directUrl: string | null;
    fileName: string | null;
    pageUrl: string | null;
}> => {
    // 1. If we have a direct Special:FilePath or File: URL
    if (options.commonsUrl) {
        let fileName = '';
        if (options.commonsUrl.includes('Special:FilePath/')) {
            fileName = decodeURIComponent(options.commonsUrl.split('Special:FilePath/')[1] || '').split('?')[0];
        } else if (options.commonsUrl.includes('File:')) {
            fileName = decodeURIComponent(options.commonsUrl.split('File:')[1] || '').split('?')[0];
        }

        if (fileName) {
            try {
                const infoUrl = `https://commons.wikimedia.org/w/api.php?action=query&titles=File:${encodeURIComponent(fileName)}&prop=imageinfo&iiprop=url|mime|size&format=json&origin=*`;
                const infoRes = await fetch(infoUrl);
                if (infoRes.ok) {
                    const data = await infoRes.json();
                    const pages = data.query?.pages || {};
                    const firstPage: any = Object.values(pages)[0];
                    const info = firstPage?.imageinfo?.[0];
                    if (info?.url) {
                        return {
                            directUrl: info.url.replace('http://', 'https://'),
                            fileName,
                            pageUrl: `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(fileName)}`
                        };
                    }
                }
            } catch (err) {
                console.warn("Error resolving direct Commons URL:", err);
            }
        }
    }

    // 2. Query Wikimedia Commons search API
    try {
        const cleanTitle = options.title.replace(/[:"']/g, ' ').trim();
        const searchTerms = [
            `${cleanTitle} movie filetype:video`,
            `${cleanTitle} film filetype:video`,
            `${cleanTitle} filetype:video`
        ];

        for (const term of searchTerms) {
            const apiUrl = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(term)}&gsrnamespace=6&prop=imageinfo&iiprop=url|mime|size&format=json&origin=*`;
            const res = await fetch(apiUrl);
            if (!res.ok) continue;

            const data = await res.json();
            const pages = data.query?.pages || {};
            const pageList: any[] = Object.values(pages);

            for (const p of pageList) {
                const info = p.imageinfo?.[0];
                if (!info || !info.url) continue;

                const mime = (info.mime || '').toLowerCase();
                const url = (info.url || '').toLowerCase();
                const isVideo = mime.startsWith('video/') || url.endsWith('.webm') || url.endsWith('.mp4') || url.endsWith('.ogv');

                if (isVideo) {
                    const cleanName = (p.title || '').replace(/^File:/i, '');
                    return {
                        directUrl: info.url.replace('http://', 'https://'),
                        fileName: cleanName,
                        pageUrl: `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(cleanName)}`
                    };
                }
            }
        }
    } catch (searchErr) {
        console.warn("Wikimedia Commons search API error:", searchErr);
    }

    return { directUrl: null, fileName: null, pageUrl: null };
};

/**
 * Searches Archive.org & Wikimedia Commons for a direct movie stream link,
 * saves it to the database (Supabase movies & identifiers table),
 * and connects it to the movie.
 */
export const findAndSaveMovieVideoSource = async (movie: Movie): Promise<SearchVideoResult> => {
    try {
        let archiveId = movie.identifiers?.archiveId;
        let imdbId = movie.identifiers?.imdbId;
        let tmdbCompanyId = movie.identifiers?.tmdbCompanyId;
        let tmdbId = movie.identifiers?.tmdbId;
        let commonsVideo = movie.identifiers?.wikimediaCommons;
        let youtubeUrl: string | null = null;

        // 1. Fetch missing identifiers from Wikidata SPARQL if movie has a wikidataId
        if (movie.wikidataId && (!archiveId || !imdbId || !tmdbCompanyId || !tmdbId || !commonsVideo)) {
            const fetched = await fetchMovieIdentifiers(movie.wikidataId);
            if (fetched.archiveId && !archiveId) archiveId = fetched.archiveId;
            if (fetched.imdbId && !imdbId) imdbId = fetched.imdbId;
            if (fetched.tmdbCompanyId && !tmdbCompanyId) tmdbCompanyId = fetched.tmdbCompanyId;
            if (fetched.tmdbId && !tmdbId) tmdbId = fetched.tmdbId;
            if (fetched.commonsVideo && !commonsVideo) commonsVideo = fetched.commonsVideo;
            if (fetched.youtubeId) youtubeUrl = `https://www.youtube.com/watch?v=${fetched.youtubeId}`;
        }

        // 2. Search Archive.org
        const archiveResult = await searchArchiveOrg({
            title: movie.title,
            originalTitle: movie.originalTitle,
            year: movie.year,
            archiveId: archiveId || undefined,
            imdbId: imdbId || undefined
        });

        if (archiveResult.directUrl) {
            const directUrl = archiveResult.directUrl;
            const updatedArchiveId = archiveResult.archiveId || archiveId;

            // Save to database
            await persistVideoSource({
                movie,
                directUrl,
                archiveId: updatedArchiveId || undefined,
                imdbId: imdbId || undefined,
                tmdbCompanyId: tmdbCompanyId || undefined,
                tmdbId: tmdbId || undefined,
                youtube: youtubeUrl || undefined
            });

            return {
                success: true,
                directUrl,
                source: 'archive',
                archiveId: updatedArchiveId || undefined,
                imdbId: imdbId || undefined,
                tmdbCompanyId: tmdbCompanyId || undefined,
                tmdbId: tmdbId || undefined,
                message: `Vídeo encontrado no Internet Archive (${updatedArchiveId})!`
            };
        }

        // 3. Search Wikimedia Commons
        const commonsResult = await searchWikimediaCommons({
            title: movie.title,
            originalTitle: movie.originalTitle,
            commonsUrl: commonsVideo
        });

        if (commonsResult.directUrl) {
            const directUrl = commonsResult.directUrl;

            // Save to database
            await persistVideoSource({
                movie,
                directUrl,
                commons: directUrl,
                archiveId: archiveId || undefined,
                imdbId: imdbId || undefined,
                tmdbCompanyId: tmdbCompanyId || undefined,
                tmdbId: tmdbId || undefined,
                youtube: youtubeUrl || undefined
            });

            return {
                success: true,
                directUrl,
                source: 'commons',
                commonsTitle: commonsResult.fileName || undefined,
                archiveId: archiveId || undefined,
                imdbId: imdbId || undefined,
                tmdbCompanyId: tmdbCompanyId || undefined,
                tmdbId: tmdbId || undefined,
                message: `Vídeo encontrado no Wikimedia Commons (${commonsResult.fileName})!`
            };
        }

        // 4. If YouTube found from Wikidata as fallback
        if (youtubeUrl) {
            await persistVideoSource({
                movie,
                directUrl: youtubeUrl,
                youtube: youtubeUrl,
                archiveId: archiveId || undefined,
                imdbId: imdbId || undefined,
                tmdbCompanyId: tmdbCompanyId || undefined,
                tmdbId: tmdbId || undefined
            });

            return {
                success: true,
                directUrl: youtubeUrl,
                source: 'youtube',
                archiveId: archiveId || undefined,
                imdbId: imdbId || undefined,
                tmdbCompanyId: tmdbCompanyId || undefined,
                tmdbId: tmdbId || undefined,
                message: "Fonte encontrada no YouTube!"
            };
        }

        return {
            success: false,
            directUrl: null,
            source: null,
            archiveId: archiveId || undefined,
            imdbId: imdbId || undefined,
            tmdbCompanyId: tmdbCompanyId || undefined,
            tmdbId: tmdbId || undefined,
            message: "Nenhuma cópia de domínio público encontrada no Archive.org ou Wikimedia Commons."
        };
    } catch (err: any) {
        console.error("Error in findAndSaveMovieVideoSource:", err);
        return {
            success: false,
            directUrl: null,
            source: null,
            message: err.message || "Erro durante a busca da fonte de vídeo."
        };
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
    if (commons) movie.identifiers.wikimediaCommons = commons;

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
