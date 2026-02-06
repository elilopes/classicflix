
import { Movie } from '../types';

const API_KEY = 'dc3946fe'; // Key provided by user
const BASE_URL = 'https://www.omdbapi.com/';

export const searchOmdbMovies = async (query: string): Promise<Partial<Movie>[]> => {
    try {
        const response = await fetch(`${BASE_URL}?apikey=${API_KEY}&s=${encodeURIComponent(query)}&type=movie`);
        const data = await response.json();

        if (data.Response === "False" || !data.Search) return [];

        // OMDb search results are limited, we map what we can
        return data.Search.map((item: any) => ({
            id: `omdb-${item.imdbID}`,
            title: item.Title,
            year: parseInt(item.Year) || 0,
            posterUrl: item.Poster !== "N/A" ? item.Poster : "",
            type: 'Movie',
            // Store imdbID temporarily in wikidataId or specialized field if needed, 
            // but for now we use ID. We will fetch details later.
            wikidataId: item.imdbID 
        }));
    } catch (error) {
        console.error("OMDb Search Error:", error);
        return [];
    }
};

export const getOmdbMovieDetails = async (imdbId: string): Promise<any | null> => {
    try {
        const response = await fetch(`${BASE_URL}?apikey=${API_KEY}&i=${imdbId}&plot=full`);
        const data = await response.json();

        if (data.Response === "False") return null;

        // Convert "1h 30min" or "N/A" to clean string
        const duration = data.Runtime !== "N/A" ? data.Runtime : "";
        
        // Parse Ratings to find usable scores
        const imdbRating = data.imdbRating !== "N/A" ? data.imdbRating : "";

        return {
            title: data.Title,
            originalTitle: data.Title, // OMDb usually gives English/Original mixed
            description: data.Plot !== "N/A" ? data.Plot : "",
            year: parseInt(data.Year) || 0,
            posterUrl: data.Poster !== "N/A" ? data.Poster : "",
            language: data.Language !== "N/A" ? data.Language.split(',')[0] : "English",
            rating: imdbRating,
            duration: duration,
            director: data.Director !== "N/A" ? data.Director : "Unknown",
            cast: data.Actors !== "N/A" ? data.Actors.split(',').map((s: string) => s.trim()) : [],
            genres: data.Genre !== "N/A" ? data.Genre.split(',').map((s: string) => s.trim()) : [],
            type: 'Movie',
            awards: data.Awards !== "N/A" ? [data.Awards] : [],
            // Extra
            countries: data.Country !== "N/A" ? data.Country.split(',').map((s: string) => s.trim()) : [],
            production: data.Production !== "N/A" ? data.Production : ""
        };
    } catch (error) {
        console.error("OMDb Details Error:", error);
        return null;
    }
};
