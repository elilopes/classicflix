
/// <reference types="vite/client" />
import { Movie } from '../types';

const API_KEY = import.meta.env.VITE_OMDB_KEY || 'dc3946fe'; 
const BASE_URL = 'https://www.omdbapi.com/';

export const searchOmdbMovies = async (query: string): Promise<Partial<Movie>[]> => {
    try {
        const response = await fetch(`${BASE_URL}?apikey=${API_KEY}&s=${encodeURIComponent(query)}&type=movie`);
        const data = await response.json();

        if (data.Response === "False" || !data.Search) return [];

        // OMDb search results are limited, we map what we can
        const results = data.Search.map((item: any) => ({
            id: `omdb-${item.imdbID}`,
            title: item.Title,
            year: parseInt(item.Year) || 0,
            posterUrl: item.Poster !== "N/A" ? item.Poster : "",
            type: 'Movie',
            // Store imdbID temporarily in wikidataId or specialized field if needed, 
            // but for now we use ID. We will fetch details later.
            wikidataId: item.imdbID 
        }));
        return Array.from(new Map(results.map((item: any) => [item.id, item])).values());
    } catch (error) {
        console.error("OMDb Search Error:", error);
        return [];
    }
};

const extractOmdbRating = (data: any): string => {
    const direct = Number(data?.imdbRating);
    if (Number.isFinite(direct) && direct > 0 && direct <= 10) {
        return direct.toFixed(1);
    }
    const ratings: any[] = Array.isArray(data?.Ratings) ? data.Ratings : [];
    for (const r of ratings) {
        const src = String(r?.Source || '');
        const val = String(r?.Value || '').trim();
        if (src.includes('Internet Movie Database')) {
            const m = val.match(/^([\d.]+)\s*\/\s*10/);
            if (m && Number(m[1]) > 0) return Number(m[1]).toFixed(1);
        }
        if (src.includes('Rotten Tomatoes')) {
            const m = val.match(/^(\d+)%/);
            if (m && Number(m[1]) > 0) return (Number(m[1]) / 10).toFixed(1);
        }
        if (src.includes('Metacritic')) {
            const m = val.match(/^(\d+)\s*\/\s*100/);
            if (m && Number(m[1]) > 0) return (Number(m[1]) / 10).toFixed(1);
        }
    }
    const metascore = Number(data?.Metascore);
    if (Number.isFinite(metascore) && metascore > 0 && metascore <= 100) {
        return (metascore / 10).toFixed(1);
    }
    return "";
};

const mapOmdbDetails = (data: any) => {
    const duration = data.Runtime && data.Runtime !== "N/A" ? data.Runtime : "";
    const rating = extractOmdbRating(data);

    return {
        title: data.Title,
        originalTitle: data.Title,
        description: data.Plot && data.Plot !== "N/A" ? data.Plot : "",
        year: parseInt(data.Year) || 0,
        posterUrl: data.Poster && data.Poster !== "N/A" ? data.Poster : "",
        language: data.Language && data.Language !== "N/A" ? data.Language.split(',')[0] : "English",
        rating,
        imdbId: data.imdbID && data.imdbID !== "N/A" ? data.imdbID : "",
        duration,
        director: data.Director && data.Director !== "N/A" ? data.Director : "Unknown",
        cast: data.Actors && data.Actors !== "N/A" ? data.Actors.split(',').map((s: string) => s.trim()) : [],
        genres: data.Genre && data.Genre !== "N/A" ? data.Genre.split(',').map((s: string) => s.trim()) : [],
        type: data.Type === 'series' ? 'Series' : 'Movie',
        awards: data.Awards && data.Awards !== "N/A" ? [data.Awards] : [],
        countries: data.Country && data.Country !== "N/A" ? data.Country.split(',').map((s: string) => s.trim()) : [],
        production: data.Production && data.Production !== "N/A" ? data.Production : ""
    };
};

export const getOmdbMovieDetails = async (imdbId: string): Promise<any | null> => {
    try {
        const response = await fetch(`${BASE_URL}?apikey=${API_KEY}&i=${encodeURIComponent(imdbId)}&plot=full`);
        const data = await response.json();

        if (data.Response === "False") return null;
        return mapOmdbDetails(data);
    } catch (error) {
        console.error("OMDb Details Error:", error);
        return null;
    }
};

export const getOmdbByTitleAndYear = async (title: string, year?: number): Promise<any | null> => {
    const cleanTitle = String(title || '').trim();
    if (!cleanTitle) return null;
    try {
        const yearParam = year && year > 1880 ? `&y=${encodeURIComponent(String(year))}` : '';
        const response = await fetch(`${BASE_URL}?apikey=${API_KEY}&t=${encodeURIComponent(cleanTitle)}${yearParam}`);
        const data = await response.json();
        if (data?.Response !== "False") {
            return mapOmdbDetails(data);
        }
        if (yearParam) {
            const fallbackRes = await fetch(`${BASE_URL}?apikey=${API_KEY}&t=${encodeURIComponent(cleanTitle)}`);
            const fallbackData = await fallbackRes.json();
            if (fallbackData?.Response !== "False") {
                return mapOmdbDetails(fallbackData);
            }
        }
        return null;
    } catch (error) {
        console.error("OMDb Title Lookup Error:", error);
        return null;
    }
};
