
import { movies as localMovies } from '../movies';
import { Movie, UserMovieInteraction } from '../types';
import { getSupabase, getCurrentUser as getSupabaseUser } from './bd';

// Re-export auth functions
export { signInUser, signUpUser, signOutUser, subscribeToAuthChanges, getCurrentUser, signInWithGoogle } from './bd';

// Helper to clean array input from Postgres
const cleanArray = (val: any): string[] => {
    if (Array.isArray(val)) {
        return val.map((s: any) => String(s).replace(/[\[\]\{\}"]/g, '').trim()).filter(Boolean);
    }
    if (typeof val === 'string') {
        let cleaned = val.trim();
        if ((cleaned.startsWith('{') && cleaned.endsWith('}')) || (cleaned.startsWith('[') && cleaned.endsWith(']'))) {
            cleaned = cleaned.slice(1, -1);
        }
        return cleaned.split(',').map((s: string) => s.replace(/[\[\]\{\}"]/g, '').trim()).filter(Boolean);
    }
    return [];
};

export const fetchSupabaseMovies = async (): Promise<Movie[]> => {
    try {
        const supabase = await getSupabase();
        if (!supabase) return localMovies;

        let allMovies: any[] = [];
        let from = 0;
        const step = 1000;
        let hasMore = true;

        while (hasMore) {
            const to = from + step - 1;
            let data = null;
            let error = null;
            let retries = 3;

            while (retries > 0) {
                const response = await supabase
                    .from('movies')
                    .select('*, technicaldetails(*), description(*)')
                    .range(from, to);
                
                data = response.data;
                error = response.error;

                if (!error) break;

                retries--;
                if (retries > 0) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }

            if (error) {
                console.warn(`Aviso: Não foi possível buscar o bloco ${from}-${to} após tentativas. Retornando os dados já carregados.`);
                hasMore = false;
                break;
            }

            if (data && data.length > 0) {
                allMovies = [...allMovies, ...data];
                if (data.length < step) hasMore = false;
                else from += step;
            } else {
                hasMore = false;
            }
        }

        if (allMovies.length === 0) {
            console.warn("Supabase returned 0 movies. Falling back to local movies.");
            return localMovies;
        }

        const moviesWithIds = allMovies.map(item => ({...item, id: String(item.id || `id-${Math.random()}`)}));
        const uniqueMovies = Array.from(new Map(moviesWithIds.map(item => [item.id, item])).values());

        return uniqueMovies.map((item: any) => {
            // Merge joined tables
            const td = Array.isArray(item.technicaldetails) ? item.technicaldetails[0] : (item.technicaldetails || {});
            const descObj = Array.isArray(item.description) ? item.description[0] : (item.description || {});
            
            const rawDesc = typeof item.description === 'string' ? item.description : item.descriptionen;
            const rawDescPt = typeof item.descriptionPt === 'string' ? item.descriptionPt : item.descriptionpt;

            return {
                id: item.id,
                wikidataId: item.wikidataid || item.wikidataId,
                title: item.title,
                titlePt: item.titlept || item.titlePt,
                originalTitle: item.originaltitle || item.originalTitle,
                year: item.year,
                language: item.language || "Unknown",
                hasSubtitles: item.hassubtitles || item.hasSubtitles,
                subtitleUrl: item.subtitleurl || item.subtitleUrl,
                posterUrl: item.posterurl || item.posterUrl,
                videoUrl: item.videourl || item.videoUrl,
                trailerUrl: item.trailerurl || item.trailerUrl,
                description: rawDesc || descObj.descriptionen || "",
                descriptionPt: rawDescPt || descObj.descriptionpt || "",
                duration: td.duration || item.duration || "",
                genres: cleanArray(td.genres || item.genres),
                director: td.director || item.director || "Unknown",
                directorId: td.directorid || td.directorId || item.directorid || item.directorId,
                type: item.type || "Movie",
                rating: td.rating || item.rating || "",
                cast: cleanArray(td.castmembers || td.cast_members || td.castMembers || item.cast_members || item.castmembers || item.castMembers),
                cinematographers: cleanArray(td.cinematographers || item.cinematographers),
                composers: cleanArray(td.composers || item.composers),
                themes: cleanArray(td.themes || item.themes),
                popularity: item.popularity || 0,
                awards: cleanArray(item.awards),
                license: td.sourcelabel || item.license || ""
            };
        });
    } catch (err) { 
        console.error("fetchSupabaseMovies error:", err);
        return localMovies; 
    }
};

// Fix: Implement addSupabaseMovie to persist new movies to the database
export const addSupabaseMovie = async (movie: Partial<Movie>) => {
    const supabase = await getSupabase();
    if (!supabase) return;
    
    // Generate id for movies if wikidataId is missing
    const isIndie = movie.genres?.includes('Independente') || movie.isIndependent;
    const prefix = isIndie ? 'indie' : 'manual';
    const finalWikidataId = movie.wikidataId || `${prefix}${Math.floor(Math.random() * 100000000)}`;
    
    if (!finalWikidataId) {
        throw new Error("Cannot add movie: missing wikidataId");
    }

    // We insert into the legacy_movies_sink view to trigger the split logic
    // which populates movies, description, and technicaldetails tables.
    const { error } = await supabase.from('legacy_movies_sink').insert([{
        wikidataid: finalWikidataId,
        title: movie.title,
        titlept: movie.titlePt,
        originaltitle: movie.originalTitle,
        descriptionen: movie.description,
        descriptionpt: movie.descriptionPt,
        genres: Array.isArray(movie.genres) ? movie.genres.join(', ') : movie.genres,
        year: movie.year,
        language: movie.language,
        hassubtitles: movie.hasSubtitles,
        posterurl: movie.posterUrl,
        videourl: movie.videoUrl,
        trailerurl: movie.trailerUrl,
        subtitleurl: movie.subtitleUrl,
        duration: movie.duration,
        director: movie.director,
        type: movie.type,
        rating: movie.rating,
        castmembers: Array.isArray(movie.cast) ? movie.cast : movie.cast,
        awards: Array.isArray(movie.awards) ? movie.awards : movie.awards,
        cinematographers: Array.isArray(movie.cinematographers) ? movie.cinematographers : movie.cinematographers,
        composers: Array.isArray(movie.composers) ? movie.composers : movie.composers,
        themes: Array.isArray(movie.themes) ? movie.themes : movie.themes,
        popularity: movie.popularity || 0
    }]);
    
    if (error) {
        console.error("Supabase Insert Error (via view):", error);
        // Fallback to direct movies table insert if view insert fails
        const { error: fallbackError } = await supabase.from('movies').upsert([{
            wikidataid: finalWikidataId,
            title: movie.title,
            titlept: movie.titlePt,
            originaltitle: movie.originalTitle,
            year: movie.year,
            language: movie.language,
            hassubtitles: movie.hasSubtitles,
            posterurl: movie.posterUrl,
            videourl: movie.videoUrl,
            trailerurl: movie.trailerUrl,
            subtitleurl: movie.subtitleUrl,
            awards: Array.isArray(movie.awards) ? movie.awards : movie.awards,
            popularity: movie.popularity || 0
        }], { onConflict: 'wikidataid' });
        
        if (fallbackError) {
            console.error("Supabase Fallback Error:", fallbackError);
            throw fallbackError;
        }
    }
};

// Fix: Implement updateSupabaseMovie to update existing movie records
export const updateSupabaseMovie = async (wikidataId: string, updates: any) => {
    const supabase = await getSupabase();
    if (!supabase) return;
    
    // Use legacy_movies_sink view to handle split table updates via trigger
    // We use wikidataid exclusively as the primary key
    const { error } = await supabase.from('legacy_movies_sink').update({
        title: updates.title,
        titlept: updates.titlePt,
        originaltitle: updates.originalTitle,
        descriptionen: updates.description,
        descriptionpt: updates.descriptionPt,
        genres: Array.isArray(updates.genres) ? updates.genres.join(', ') : updates.genres,
        year: updates.year,
        language: updates.language,
        hassubtitles: updates.hasSubtitles,
        posterurl: updates.posterUrl,
        videourl: updates.videoUrl,
        trailerurl: updates.trailerUrl,
        subtitleurl: updates.subtitleUrl,
        duration: updates.duration,
        director: updates.director,
        type: updates.type,
        rating: updates.rating,
        castmembers: Array.isArray(updates.cast) ? updates.cast : updates.cast,
        awards: Array.isArray(updates.awards) ? updates.awards : updates.awards,
        cinematographers: Array.isArray(updates.cinematographers) ? updates.cinematographers : updates.cinematographers,
        composers: Array.isArray(updates.composers) ? updates.composers : updates.composers,
        themes: Array.isArray(updates.themes) ? updates.themes : updates.themes,
        popularity: updates.popularity
    }).eq('wikidataid', wikidataId);
    
    if (error) {
        console.error("Supabase Update Error (via view):", error);
        // Fallback to direct movies table update using wikidataid
        const { error: fallbackError } = await supabase.from('movies').update({
            title: updates.title,
            titlept: updates.titlePt,
            originaltitle: updates.originalTitle,
            year: updates.year,
            language: updates.language,
            hassubtitles: updates.hasSubtitles,
            posterurl: updates.posterUrl,
            videourl: updates.videoUrl,
            trailerurl: updates.trailerUrl,
            subtitleurl: updates.subtitleUrl,
            awards: Array.isArray(updates.awards) ? updates.awards : updates.awards,
            popularity: updates.popularity
        }).eq('wikidataid', wikidataId);
        
        if (fallbackError) {
            console.error("Supabase Fallback Update Error:", fallbackError);
            throw fallbackError;
        }
    }
};

// Fix: Implement deleteSupabaseMovies to remove movie records
export const deleteSupabaseMovies = async (wikidataIds: string[]) => {
    const supabase = await getSupabase();
    if (!supabase) return;
    const { error } = await supabase.from('movies').delete().in('wikidataid', wikidataIds);
    if (error) throw error;
};

export const getExistingWikidataIds = async (): Promise<string[]> => {
    const supabase = await getSupabase();
    if (!supabase) return [];
    const { data, error } = await supabase.from('movies').select('wikidataid');
    if (error) return [];
    return data.map(m => m.wikidataid).filter(Boolean);
};

export const getUserInteractions = async (): Promise<UserMovieInteraction[]> => {
    const supabase = await getSupabase();
    if (!supabase) return [];
    const user = await getSupabaseUser();
    if (!user) return [];

    const { data, error } = await supabase.from('userlists').select('*').eq('userid', user.id);
    if (error) return [];
    return data || [];
};

export const updateInteraction = async (wikidataId: string, updates: Partial<UserMovieInteraction>) => {
    const supabase = await getSupabase();
    if (!supabase) return;
    const user = await getSupabaseUser();
    if (!user) return;

    await supabase.from('userlists').upsert({ 
        userid: user.id, 
        wikidataid: wikidataId, 
        ...updates,
        lastupdated: new Date().toISOString()
    });
};

export const incrementMoviePopularity = async (id: string) => {
    const supabase = await getSupabase();
    if (!supabase) return;
    await supabase.rpc('increment_popularity', { movie_id: id });
};

export const savePlaybackProgress = async (wikidataId: string, seconds: number) => {
    await updateInteraction(wikidataId, { progress_seconds: Math.floor(seconds) });
};

export const updateMoviePoster = async (id: string, posterUrl: string) => {
    const supabase = await getSupabase();
    if (!supabase) return;
    await supabase.from('movies').update({ posterurl: posterUrl }).eq('id', id);
};

/**
 * Salva a pontuação do quiz no Supabase
 * Usa upsert pois userid é a chave primária
 */
export const saveQuizScore = async (score: number, movieTitle: string) => {
    const supabase = await getSupabase();
    if (!supabase) return;
    const user = await getSupabaseUser();
    if (!user) return;

    // Busca o score atual para garantir que só salvamos se for maior (opcional, mas comum em rankings)
    const { data: currentEntry } = await supabase
        .from('quizranking')
        .select('score')
        .eq('userid', user.id)
        .single();

    if (currentEntry && currentEntry.score >= score) return;

    const { error } = await supabase.from('quizranking').upsert({
        userid: user.id,
        email: user.email || 'Anônimo',
        score: score,
        title: movieTitle,
        created_at: new Date().toISOString()
    });

    if (error) console.error("Erro ao salvar score:", error.message);
};

/**
 * Busca o ranking global do quiz
 */
export const getLeaderboard = async () => {
    const supabase = await getSupabase();
    if (!supabase) return [];

    const { data, error } = await supabase
        .from('quizranking')
        .select('*')
        .order('score', { ascending: false })
        .limit(50);

    if (error) {
        console.error("Erro ao buscar leaderboard:", error.message);
        return [];
    }
    return data;
};
