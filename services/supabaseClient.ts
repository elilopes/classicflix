import { Movie, UserMovieInteraction } from '../types';
import { getSupabase } from './bd';

// Re-export auth functions for backward compatibility with existing imports in App.tsx
// or clean them up later. For now, we import the connection from bd.ts
export { signInUser, signUpUser, signOutUser, subscribeToAuthChanges, getCurrentUser } from './bd';

// --- HELPER: Fetch All Rows (Pagination) ---
// Supabase API defaults to 1000 rows max. This function loops to get everything.
const fetchAllRows = async (supabase: any, tableName: string) => {
    let allData: any[] = [];
    let from = 0;
    const step = 1000;
    let keepFetching = true;

    while (keepFetching) {
        const { data, error } = await supabase
            .from(tableName)
            .select('*')
            .range(from, from + step - 1);

        if (error) {
            console.error(`Error fetching ${tableName}:`, error);
            keepFetching = false;
        } else if (data && data.length > 0) {
            allData = allData.concat(data);
            from += step;
            // If we got fewer than the step, we reached the end
            if (data.length < step) {
                keepFetching = false;
            }
        } else {
            keepFetching = false;
        }
    }
    return allData;
};

// --- DATA FUNCTIONS (CRUD) ---

export const fetchSupabaseMovies = async (): Promise<Movie[]> => {
    try {
        const supabase = await getSupabase();
        if (!supabase) return [];

        // 1. Fetch ALL Data (Paginated)
        // Using Promise.all to fetch tables in parallel for speed
        const [moviesData, techData, descData] = await Promise.all([
            fetchAllRows(supabase, 'movies'),
            fetchAllRows(supabase, 'technicaldetails'),
            fetchAllRows(supabase, 'description')
        ]);

        if (!moviesData || moviesData.length === 0) {
            return [];
        }

        // 2. Index Joined Data by wikidataId
        // We use Map for O(1) lookup performance
        const techMap = new Map(techData.map((t: any) => [t.wikidataId, t]));
        const descMap = new Map(descData.map((d: any) => [d.wikidataId, d]));

        // 3. Merge and Normalize
        return moviesData.map((item: any) => {
            // FIX: Safely retrieve joined data using wikidataId
            const tech: any = (item.wikidataId && techMap.get(item.wikidataId)) || {};
            const desc: any = (item.wikidataId && descMap.get(item.wikidataId)) || {};

            const ensureArray = (val: any) => {
                if (Array.isArray(val)) return val;
                if (typeof val === 'string') {
                    if (val.startsWith('{') && val.endsWith('}')) {
                        return val.slice(1, -1).split(',').map((s: string) => s.replace(/"/g, '').trim()).filter(Boolean);
                    }
                    return val.split(',').map((s: string) => s.trim()).filter(Boolean);
                }
                return [];
            };

            // Helper to enforce HTTPS and fix mixed content warnings
            const toHttps = (url: string | null) => {
                if (!url) return "";
                if (url.startsWith('http://')) return url.replace('http://', 'https://');
                return url;
            };

            return {
                id: item.id || `db-${Math.random()}`,
                wikidataId: item.wikidataId,
                title: item.title, 
                titlePt: item.titlePt,
                originalTitle: item.originalTitle,
                year: item.year,
                // Ensure Language uses the main table source, defaulting to 'Unknown' if missing
                language: item.language || "Unknown", 
                hasSubtitles: item.hasSubtitles,
                posterUrl: toHttps(item.posterUrl),
                videoUrl: toHttps(item.videoUrl),
                trailerUrl: toHttps(item.trailerUrl),
                awards: ensureArray(item.awards || []),
                description: desc.description || item.description || "", // Fallback to item.description if available
                descriptionPt: desc.descriptionPt || "",
                descriptionHi: desc.descriptionHi || "",
                descriptionRu: desc.descriptionRu || "",
                descriptionIt: desc.descriptionIt || "",
                duration: tech.duration || "",
                genres: ensureArray(tech.genres || []),
                director: tech.director || "Unknown",
                type: (tech.type as 'Movie' | 'Series') || "Movie",
                sourceLabel: tech.sourceLabel || "",
                rating: tech.rating || "",
                cast: ensureArray(tech.cast_members || []),
                cinematographers: ensureArray(tech.cinematographers || []),
                composers: ensureArray(tech.composers || []),
                themes: ensureArray(tech.themes || []),
            };
        });
    } catch (err) { 
        console.warn("Fetch Supabase Movies failed (using local):", err);
        return []; 
    }
};

export const addSupabaseMovie = async (movie: Partial<Movie>) => {
    const supabase = await getSupabase();
    if (!supabase) throw new Error("Offline mode");

    try {
        const movieId = movie.id || `db-${Date.now()}`;
        const wikidataId = movie.wikidataId || `custom-${Date.now()}`;

        await supabase.from('movies').insert([{
            id: movieId,
            wikidataId,
            title: movie.title,
            titlePt: movie.titlePt,
            originalTitle: movie.originalTitle,
            year: movie.year,
            language: movie.language,
            hasSubtitles: movie.hasSubtitles,
            posterUrl: movie.posterUrl,
            videoUrl: movie.videoUrl,
            trailerUrl: movie.trailerUrl,
            awards: movie.awards
        }]);

        await supabase.from('description').insert([{
            wikidataId,
            title: movie.title,
            description: movie.description,
            descriptionPt: movie.descriptionPt,
            descriptionHi: movie.descriptionHi,
            descriptionRu: movie.descriptionRu,
            descriptionIt: movie.descriptionIt
        }]);

        await supabase.from('technicaldetails').insert([{
            wikidataId,
            title: movie.title,
            duration: movie.duration,
            genres: movie.genres,
            director: movie.director,
            type: movie.type,
            sourceLabel: movie.sourceLabel,
            cast_members: movie.cast,
            cinematographers: movie.cinematographers,
            composers: movie.composers,
            themes: movie.themes,
            rating: movie.rating
        }]);
    } catch (e) {
        console.error("Add movie failed", e);
        throw e;
    }
};

export const updateSupabaseMovie = async (movieId: string, wikidataId: string | undefined, updates: any) => {
    const supabase = await getSupabase();
    if (!supabase) return;

    try {
        const movieFields = ['title', 'titlePt', 'originalTitle', 'year', 'language', 'hasSubtitles', 'posterUrl', 'videoUrl', 'trailerUrl', 'awards', 'wikidataId'];
        const descFields = ['description', 'descriptionPt', 'descriptionHi', 'descriptionRu', 'descriptionIt', 'wikidataId'];
        const techFields = ['duration', 'genres', 'director', 'type', 'sourceLabel', 'cast', 'cinematographers', 'composers', 'themes', 'rating', 'wikidataId'];
        const colMap: any = { 'cast': 'cast_members' };

        const movieUpdates: any = {};
        const descUpdates: any = {};
        const techUpdates: any = {};

        Object.keys(updates).forEach(key => {
            if (movieFields.includes(key)) movieUpdates[key] = updates[key];
            if (descFields.includes(key)) descUpdates[key] = updates[key];
            if (techFields.includes(key)) {
                const dbKey = colMap[key] || key;
                techUpdates[dbKey] = updates[key];
            }
        });

        if (updates.title) {
            movieUpdates.title = updates.title;
            descUpdates.title = updates.title;
            techUpdates.title = updates.title;
        }
        
        if (Object.keys(movieUpdates).length > 0) {
            await supabase.from('movies').update(movieUpdates).eq('id', movieId);
        }

        if (wikidataId) {
            if (Object.keys(descUpdates).length > 0) {
                await supabase.from('description').update(descUpdates).eq('wikidataId', wikidataId);
            }
            if (Object.keys(techUpdates).length > 0) {
                await supabase.from('technicaldetails').update(techUpdates).eq('wikidataId', wikidataId);
            }
        }
    } catch (e) {
        console.error("Update failed", e);
    }
};

export const getUserInteractions = async (): Promise<UserMovieInteraction[]> => {
    try {
        const supabase = await getSupabase();
        if (!supabase) return [];

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return [];

        const { data, error } = await supabase
            .from('user_movie_interactions')
            .select('*')
            .eq('user_id', user.id);

        if (error) {
             const { data: fallbackData } = await supabase.from('user_interactions').select('*').eq('user_id', user.id);
             return fallbackData || [];
        }
        return data || [];
    } catch (e) {
        return [];
    }
};

export const updateInteraction = async (movieId: string, updates: Partial<UserMovieInteraction>) => {
    try {
        const supabase = await getSupabase();
        if (!supabase) return;

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { error } = await supabase
            .from('user_movie_interactions')
            .upsert({
                user_id: user.id,
                movie_id: movieId,
                ...updates,
                last_updated_at: new Date().toISOString()
            });
            
        if (error && error.code === '42P01') {
             await supabase.from('user_interactions').upsert({
                user_id: user.id,
                movie_id: movieId,
                ...updates
            });
        }
    } catch (e) {
        console.error("Update interaction failed", e);
    }
};

export const savePlaybackProgress = async (movieId: string, seconds: number) => {
    await updateInteraction(movieId, { progress_seconds: Math.floor(seconds) });
};