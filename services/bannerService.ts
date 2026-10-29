import { Movie } from '../types';
import { getSupabase } from './bd';
import { updateSupabaseMovie } from './supabaseClient';
import { fetchMovieIdentifiers } from './videoSourceService';

const TMDB_API_KEY = 'e6a44aa8865934c03ad582bc72c5b85d';
const OMDB_API_KEY = 'dc3946fe';

export interface BannerSearchResult {
    success: boolean;
    source: 'tmdb' | 'archive' | 'commons' | 'imdb' | null;
    imageUrl: string | null;
    localUrl: string | null;
    imageType: 'banner' | 'poster' | 'backdrop';
    message: string;
    details?: {
        tmdbBackdrop?: string;
        tmdbPoster?: string;
        archiveImage?: string;
        commonsImage?: string;
        imdbPoster?: string;
    };
}

/**
 * Searches Archive.org for images (posters, banners, scans, thumbnails)
 */
export const searchArchiveOrgImages = async (archiveId: string, title?: string): Promise<string | null> => {
    try {
        let candidateId = archiveId;

        // If no direct archiveId, search by title
        if (!candidateId && title) {
            const cleanTitle = title.replace(/[:"']/g, ' ').trim();
            const searchUrl = `https://archive.org/advancedsearch.php?q=title:("${cleanTitle}") AND mediatype:(movies)&fl[]=identifier&rows=1&output=json`;
            const res = await fetch(searchUrl);
            if (res.ok) {
                const data = await res.json();
                candidateId = data.response?.docs?.[0]?.identifier;
            }
        }

        if (!candidateId) return null;

        const metaUrl = `https://archive.org/metadata/${encodeURIComponent(candidateId)}`;
        const metaRes = await fetch(metaUrl);
        if (!metaRes.ok) return null;

        const data = await metaRes.json();
        const files: any[] = data.files || [];

        // Look for image files (.jpg, .jpeg, .png)
        const imageFiles = files.filter(f => {
            const name = (f.name || '').toLowerCase();
            return name.endsWith('.jpg') || name.endsWith('.jpeg') || name.endsWith('.png') || name.endsWith('.webp');
        });

        if (imageFiles.length === 0) return null;

        // Priority: files with "poster", "banner", "front", "cover", then __ia_thumb.jpg, then largest file
        let bestFile = imageFiles.find(f => {
            const name = f.name.toLowerCase();
            return name.includes('poster') || name.includes('banner') || name.includes('front') || name.includes('cover');
        });

        if (!bestFile) {
            bestFile = imageFiles.find(f => f.name.toLowerCase().includes('thumb'));
        }

        if (!bestFile) {
            // Sort by size descending if available
            imageFiles.sort((a, b) => (parseInt(b.size) || 0) - (parseInt(a.size) || 0));
            bestFile = imageFiles[0];
        }

        if (bestFile) {
            return `https://archive.org/download/${candidateId}/${encodeURIComponent(bestFile.name)}`;
        }
    } catch (e) {
        console.warn("Error searching Archive.org images:", e);
    }
    return null;
};

/**
 * Searches Wikimedia Commons for images/posters
 */
export const searchWikimediaCommonsImages = async (options: {
    title: string;
    wikidataId?: string;
}): Promise<string | null> => {
    // 1. If wikidataId exists, check P18 (image) via SPARQL
    if (options.wikidataId && options.wikidataId.startsWith('Q')) {
        try {
            const sparql = `SELECT ?img WHERE { wd:${options.wikidataId} wdt:P18 ?img. } LIMIT 1`;
            const sparqlUrl = `https://query.wikidata.org/sparql?query=${encodeURIComponent(sparql)}&format=json&origin=*`;
            const sRes = await fetch(sparqlUrl);
            if (sRes.ok) {
                const sData = await sRes.json();
                const imgUri = sData.results?.bindings?.[0]?.img?.value;
                if (imgUri) {
                    return imgUri.replace('http://', 'https://');
                }
            }
        } catch (e) {
            console.warn("SPARQL Commons image search error:", e);
        }
    }

    // 2. Search Wikimedia Commons MediaWiki API
    try {
        const cleanTitle = options.title.replace(/[:"']/g, ' ').trim();
        const queries = [
            `${cleanTitle} movie poster filetype:bitmap`,
            `${cleanTitle} film poster filetype:bitmap`,
            `${cleanTitle} poster filetype:bitmap`
        ];

        for (const q of queries) {
            const apiUrl = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(q)}&gsrnamespace=6&prop=imageinfo&iiprop=url|mime|size&format=json&origin=*`;
            const res = await fetch(apiUrl);
            if (!res.ok) continue;

            const data = await res.json();
            const pages = Object.values(data.query?.pages || {}) as any[];
            for (const page of pages) {
                const info = page.imageinfo?.[0];
                if (info?.url) {
                    const mime = (info.mime || '').toLowerCase();
                    if (mime.startsWith('image/')) {
                        return info.url.replace('http://', 'https://');
                    }
                }
            }
        }
    } catch (e) {
        console.warn("Wikimedia Commons image search error:", e);
    }
    return null;
};

/**
 * Searches TMDB for high resolution backdrops and posters
 */
export const searchTmdbImages = async (options: {
    title: string;
    year?: number;
    imdbId?: string;
    tmdbId?: string;
}): Promise<{ backdrop: string | null; poster: string | null }> => {
    try {
        let tmdbMovieId: string | null = options.tmdbId || null;

        // 1. Search by IMDb ID if available
        if (!tmdbMovieId && options.imdbId) {
            const findUrl = `https://api.themoviedb.org/3/find/${encodeURIComponent(options.imdbId)}?api_key=${TMDB_API_KEY}&external_source=imdb_id`;
            const findRes = await fetch(findUrl);
            if (findRes.ok) {
                const findData = await findRes.json();
                if (findData.movie_results?.length > 0) {
                    tmdbMovieId = findData.movie_results[0].id.toString();
                }
            }
        }

        // 2. Search by title and year
        if (!tmdbMovieId && options.title) {
            const searchUrl = `https://api.themoviedb.org/3/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(options.title)}${options.year ? `&year=${options.year}` : ''}`;
            const sRes = await fetch(searchUrl);
            if (sRes.ok) {
                const sData = await sRes.json();
                if (sData.results?.length > 0) {
                    tmdbMovieId = sData.results[0].id.toString();
                }
            }
        }

        if (!tmdbMovieId) return { backdrop: null, poster: null };

        // 3. Fetch image gallery from TMDB
        const imagesUrl = `https://api.themoviedb.org/3/movie/${tmdbMovieId}/images?api_key=${TMDB_API_KEY}`;
        const imgRes = await fetch(imagesUrl);
        if (imgRes.ok) {
            const imgData = await imgRes.json();
            const backdrops: any[] = imgData.backdrops || [];
            const posters: any[] = imgData.posters || [];

            const bestBackdrop = backdrops.length > 0 
                ? `https://image.tmdb.org/t/p/original${backdrops[0].file_path}` 
                : null;
            const bestPoster = posters.length > 0 
                ? `https://image.tmdb.org/t/p/original${posters[0].file_path}` 
                : null;

            return { backdrop: bestBackdrop, poster: bestPoster };
        }
    } catch (e) {
        console.warn("TMDB image search error:", e);
    }
    return { backdrop: null, poster: null };
};

/**
 * Searches IMDb (via OMDb API) for official poster
 */
export const searchImdbPoster = async (options: {
    imdbId?: string;
    title: string;
    year?: number;
}): Promise<string | null> => {
    try {
        let url = '';
        if (options.imdbId) {
            url = `https://www.omdbapi.com/?apikey=${OMDB_API_KEY}&i=${encodeURIComponent(options.imdbId)}`;
        } else if (options.title) {
            url = `https://www.omdbapi.com/?apikey=${OMDB_API_KEY}&t=${encodeURIComponent(options.title)}${options.year ? `&y=${options.year}` : ''}`;
        }

        if (!url) return null;

        const res = await fetch(url);
        if (res.ok) {
            const data = await res.json();
            if (data.Response !== 'False' && data.Poster && data.Poster !== 'N/A') {
                return data.Poster;
            }
        }
    } catch (e) {
        console.warn("IMDb/OMDb poster search error:", e);
    }
    return null;
};

/**
 * Downloads image and saves it to local banner directory via Express backend (/api/banner/save)
 */
export const saveBannerToFolder = async (imageUrl: string, filename: string): Promise<string> => {
    try {
        const response = await fetch('/api/banner/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ imageUrl, filename })
        });

        if (response.ok) {
            const data = await response.json();
            if (data.localPath) {
                return data.localPath;
            }
        }
    } catch (err) {
        console.warn("Backend banner save failed, using direct URL:", err);
    }
    return imageUrl;
};

/**
 * Searches Archive.org, Wikimedia Commons, IMDb, and TMDB for movie poster or banner,
 * saves it into the 'banner' directory, and updates the database record.
 */
export const findAndSaveMovieBannerOrPoster = async (movie: Movie): Promise<BannerSearchResult> => {
    try {
        let archiveId = movie.identifiers?.archiveId;
        let imdbId = movie.identifiers?.imdbId;
        let tmdbId = movie.identifiers?.tmdbId;

        // Fetch missing identifiers from Wikidata SPARQL if available
        if (movie.wikidataId && (!archiveId || !imdbId || !tmdbId)) {
            const ids = await fetchMovieIdentifiers(movie.wikidataId);
            if (ids.archiveId && !archiveId) archiveId = ids.archiveId;
            if (ids.imdbId && !imdbId) imdbId = ids.imdbId;
            if (ids.tmdbId && !tmdbId) tmdbId = ids.tmdbId;
        }

        // Parallel searches across TMDB, Archive.org, Commons, and IMDb
        const [tmdbImages, archiveImage, commonsImage, imdbPoster] = await Promise.all([
            searchTmdbImages({ title: movie.title, year: movie.year, imdbId, tmdbId }),
            searchArchiveOrgImages(archiveId || '', movie.title),
            searchWikimediaCommonsImages({ title: movie.title, wikidataId: movie.wikidataId }),
            searchImdbPoster({ imdbId, title: movie.title, year: movie.year })
        ]);

        // Prioritize highest quality banner/backdrop or poster
        let chosenUrl: string | null = null;
        let chosenSource: 'tmdb' | 'archive' | 'commons' | 'imdb' | null = null;
        let imageType: 'banner' | 'poster' | 'backdrop' = 'banner';

        if (tmdbImages.backdrop) {
            chosenUrl = tmdbImages.backdrop;
            chosenSource = 'tmdb';
            imageType = 'backdrop';
        } else if (tmdbImages.poster) {
            chosenUrl = tmdbImages.poster;
            chosenSource = 'tmdb';
            imageType = 'poster';
        } else if (commonsImage) {
            chosenUrl = commonsImage;
            chosenSource = 'commons';
            imageType = 'banner';
        } else if (archiveImage) {
            chosenUrl = archiveImage;
            chosenSource = 'archive';
            imageType = 'poster';
        } else if (imdbPoster) {
            chosenUrl = imdbPoster;
            chosenSource = 'imdb';
            imageType = 'poster';
        }

        if (!chosenUrl || !chosenSource) {
            return {
                success: false,
                source: null,
                imageUrl: null,
                localUrl: null,
                imageType: 'banner',
                message: 'Nenhuma imagem de banner ou poster encontrada nos repositórios (Archive.org, Commons, IMDb, TMDB).'
            };
        }

        // Generate clean filename for the banner directory
        const sanitizedId = (movie.wikidataId || movie.id || 'movie').replace(/[^a-zA-Z0-9_-]/g, '_');
        const filename = `${sanitizedId}_${imageType}_${Date.now()}.jpg`;

        // Save locally to the banner directory
        const localPath = await saveBannerToFolder(chosenUrl, filename);

        // Update movie record in memory and database
        movie.posterUrl = localPath || chosenUrl;

        try {
            const supabase = await getSupabase();
            if (supabase) {
                if (movie.wikidataId) {
                    await updateSupabaseMovie(movie.wikidataId, {
                        ...movie,
                        posterUrl: localPath || chosenUrl
                    });
                } else if (movie.id) {
                    await supabase.from('movies').update({
                        posterurl: localPath || chosenUrl
                    }).eq('id', movie.id);
                }
            }
        } catch (dbErr) {
            console.warn("Could not persist updated banner to Supabase:", dbErr);
        }

        const sourceNames = {
            tmdb: 'TMDB (The Movie Database)',
            archive: 'Internet Archive (Archive.org)',
            commons: 'Wikimedia Commons',
            imdb: 'IMDb'
        };

        return {
            success: true,
            source: chosenSource,
            imageUrl: chosenUrl,
            localUrl: localPath,
            imageType,
            message: `Imagem (${imageType}) encontrada com sucesso via ${sourceNames[chosenSource]} e salva na pasta banner!`,
            details: {
                tmdbBackdrop: tmdbImages.backdrop || undefined,
                tmdbPoster: tmdbImages.poster || undefined,
                archiveImage: archiveImage || undefined,
                commonsImage: commonsImage || undefined,
                imdbPoster: imdbPoster || undefined
            }
        };
    } catch (err: any) {
        console.error("Error in findAndSaveMovieBannerOrPoster:", err);
        return {
            success: false,
            source: null,
            imageUrl: null,
            localUrl: null,
            imageType: 'banner',
            message: err.message || 'Erro durante a pesquisa de banner/poster.'
        };
    }
};
