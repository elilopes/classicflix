
import { Movie } from '../types';

// Helper to safely get env vars
const getEnv = (key: string) => {
    try {
        // @ts-ignore
        if (typeof process !== 'undefined' && process.env) {
            // @ts-ignore
            return process.env[key];
        }
    } catch (e) { }
    return '';
};

// Use provided key as fallback
const TMDB_API_KEY = getEnv('TMDB_API_KEY') || 'e6a44aa8865934c03ad582bc72c5b85d';
const BASE_URL = 'https://api.themoviedb.org/3';
const IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';

export const searchTmdbMovies = async (query: string, language: string = 'pt-BR'): Promise<Partial<Movie>[]> => {
    if (!TMDB_API_KEY) {
        console.warn("TMDB API Key is missing.");
        return [];
    }

    try {
        // Search for both movies and tv shows (multi-search) or just movies
        // For classic catalog, usually movies, but let's stick to movie endpoint for now to match interface
        const response = await fetch(`${BASE_URL}/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}&language=${language}`);
        const data = await response.json();

        if (!data.results) return [];

        return data.results.map((item: any) => ({
            id: `tmdb-${item.id}`,
            title: item.title,
            originalTitle: item.original_title,
            description: item.overview,
            year: item.release_date ? new Date(item.release_date).getFullYear() : 0,
            posterUrl: item.poster_path ? `${IMAGE_BASE_URL}${item.poster_path}` : '',
            language: 'Portuguese', 
            rating: item.vote_average ? item.vote_average.toFixed(1) : 'N/A',
            hasSubtitles: false,
            genres: [], 
            type: 'Movie',
            wikidataId: '' // Need details to get external IDs
        }));
    } catch (error) {
        console.error("TMDB Search Error:", error);
        return [];
    }
};

export const getTmdbMovieDetails = async (tmdbId: string, language: string = 'pt-BR'): Promise<any | null> => {
    if (!TMDB_API_KEY) return null;
    
    // clean ID if it comes with prefix
    const cleanId = tmdbId.replace('tmdb-', '');

    try {
        const response = await fetch(`${BASE_URL}/movie/${cleanId}?api_key=${TMDB_API_KEY}&language=${language}&append_to_response=credits,external_ids`);
        const data = await response.json();

        if (data.success === false) return null;

        const director = data.credits?.crew?.find((p: any) => p.job === 'Director')?.name || 'Unknown';
        const cast = data.credits?.cast?.slice(0, 8).map((c: any) => c.name) || [];
        const genres = data.genres?.map((g: any) => g.name) || [];
        const cinematographers = data.credits?.crew?.filter((p: any) => p.job === 'Director of Photography').map((p: any) => p.name) || [];
        const composers = data.credits?.crew?.filter((p: any) => p.job === 'Original Music Composer' || p.job === 'Music').map((p: any) => p.name) || [];
        
        // New Extended Fields
        const producers = data.credits?.crew?.filter((p: any) => p.job === 'Producer').map((p: any) => p.name) || [];
        const artDirectors = data.credits?.crew?.filter((p: any) => p.job === 'Art Direction' || p.job === 'Production Design').map((p: any) => p.name) || [];
        const countries = data.production_countries?.map((c: any) => c.name) || [];
        const productionCompanies = data.production_companies?.map((c: any) => c.name) || [];

        return {
            title: data.title,
            originalTitle: data.original_title,
            description: data.overview,
            year: data.release_date ? new Date(data.release_date).getFullYear() : 0,
            posterUrl: data.poster_path ? `${IMAGE_BASE_URL}${data.poster_path}` : '',
            language: 'Portuguese',
            rating: data.vote_average ? data.vote_average.toFixed(1) : 'N/A',
            duration: data.runtime ? `${Math.floor(data.runtime / 60)}h ${data.runtime % 60}m` : '',
            director,
            cast,
            genres,
            cinematographers,
            composers,
            // Extended
            producers,
            artDirectors,
            countries,
            productionCompanies,
            type: 'Movie',
            wikidataId: data.external_ids?.imdb_id || data.imdb_id || ''
        };
    } catch (error) {
        console.error("TMDB Details Error:", error);
        return null;
    }
};

export const getTmdbByImdbId = async (imdbId: string, language: string = 'pt-BR'): Promise<any | null> => {
    if (!TMDB_API_KEY || !imdbId) return null;

    try {
        const response = await fetch(`${BASE_URL}/find/${imdbId}?api_key=${TMDB_API_KEY}&external_source=imdb_id&language=${language}`);
        const data = await response.json();

        // Check movie results
        if (data.movie_results && data.movie_results.length > 0) {
            return getTmdbMovieDetails(data.movie_results[0].id.toString(), language);
        }
        
        // We could also check tv_results here if needed
        return null;
    } catch (e) {
        return null;
    }
};
