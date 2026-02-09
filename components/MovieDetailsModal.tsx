
import { Movie } from '../types';
import { getOmdbMovieDetails } from './omdbService';
import { fetchExtendedWikidataDetails } from './wikidataService';
import { getTvMazeByImdbId } from './tvmazeService';
import { getTmdbByImdbId } from './tmdbService';

export interface AggregatedMovieDetails {
    title: string;
    description: string;
    year: number;
    posterUrl: string;
    director: string;
    cast: string[];
    genres: string[];
    themes: string[];
    duration: string;
    rating: string;
    cinematographers: string[];
    composers: string[];
    awards: string[];
    // New Fields
    originalTitle?: string;
    countries?: string[];
    producers?: string[];
    artDirectors?: string[];
    distributors?: string[];
    basedOn?: string[];
    color?: string;
    boxOffice?: string;
}

/**
 * Aggregates data from multiple sources (Local DB, OMDb, Wikidata, TVMaze, TMDb)
 * to provide the most complete set of details possible.
 */
export const getAggregatedMovieDetails = async (movie: Movie): Promise<AggregatedMovieDetails> => {
    // 1. Start with Local Data (Supabase/JSON)
    const baseDetails: AggregatedMovieDetails = {
        title: movie.title,
        originalTitle: movie.originalTitle || movie.title,
        description: movie.description || "",
        year: movie.year,
        posterUrl: movie.posterUrl,
        director: movie.director || "Unknown",
        cast: Array.isArray(movie.cast) ? movie.cast : [],
        genres: Array.isArray(movie.genres) ? movie.genres : [],
        themes: Array.isArray(movie.themes) ? movie.themes : [],
        duration: movie.duration || "",
        rating: movie.rating || "",
        cinematographers: Array.isArray(movie.cinematographers) ? movie.cinematographers : [],
        composers: Array.isArray(movie.composers) ? movie.composers : [],
        awards: Array.isArray(movie.awards) ? movie.awards : [],
        // Initialize new fields
        countries: [],
        producers: [],
        artDirectors: [],
        distributors: [],
        basedOn: [],
        color: movie.color || undefined
    };

    // Parallel Fetching
    const promises: Promise<any>[] = [];

    // 2. Fetch Wikidata (if we have a QID or Title)
    const query = movie.wikidataId || movie.title;
    promises.push(fetchExtendedWikidataDetails(query));

    // 3. IMDb Based Lookups (TVMaze & TMDb) & OMDb
    // We check if wikidataId looks like 'tt1234567'
    if (movie.wikidataId && movie.wikidataId.startsWith('tt')) {
        promises.push(getTvMazeByImdbId(movie.wikidataId)); // Index 1
        promises.push(getTmdbByImdbId(movie.wikidataId));   // Index 2
        promises.push(getOmdbMovieDetails(movie.wikidataId)); // Index 3
    } else {
        promises.push(Promise.resolve(null));
        promises.push(Promise.resolve(null));
        promises.push(Promise.resolve(null));
    }

    try {
        const results = await Promise.all(promises);
        const wikiData = results[0];
        const tvMazeData = results[1];
        const tmdbData = results[2];
        const omdbData = results[3];

        // --- MERGE LOGIC ---
        // Helper to merge arrays
        const merge = (base: string[] | undefined, newItems: string[] | undefined) => {
            if (!newItems || newItems.length === 0) return base || [];
            return Array.from(new Set([...(base || []), ...newItems])).slice(0, 10);
        };

        // 1. WIKIDATA MERGE
        if (wikiData) {
            baseDetails.cast = merge(baseDetails.cast, wikiData.cast);
            baseDetails.cinematographers = merge(baseDetails.cinematographers, wikiData.cinematographers);
            baseDetails.composers = merge(baseDetails.composers, wikiData.composers);
            baseDetails.themes = merge(baseDetails.themes, wikiData.themes);
            
            baseDetails.producers = merge(baseDetails.producers, wikiData.producers);
            baseDetails.artDirectors = merge(baseDetails.artDirectors, wikiData.artDirectors);
            baseDetails.distributors = merge(baseDetails.distributors, wikiData.distributors);
            baseDetails.countries = merge(baseDetails.countries, wikiData.countries);
            baseDetails.basedOn = merge(baseDetails.basedOn, wikiData.basedOn);
            
            if (wikiData.originalTitle && !baseDetails.originalTitle) baseDetails.originalTitle = wikiData.originalTitle;
            if (wikiData.color && !baseDetails.color) baseDetails.color = wikiData.color;
        }

        // 2. TMDB MERGE
        if (tmdbData) {
            if (tmdbData.description && tmdbData.description.length > baseDetails.description.length) {
                baseDetails.description = tmdbData.description;
            }
            if (tmdbData.director && baseDetails.director === "Unknown") baseDetails.director = tmdbData.director;
            if (tmdbData.rating && (!baseDetails.rating || baseDetails.rating === "N/A")) baseDetails.rating = tmdbData.rating;
            if (tmdbData.originalTitle) baseDetails.originalTitle = tmdbData.originalTitle;

            baseDetails.cinematographers = merge(baseDetails.cinematographers, tmdbData.cinematographers);
            baseDetails.composers = merge(baseDetails.composers, tmdbData.composers);
            
            // Map TMDb specific extra fields
            baseDetails.producers = merge(baseDetails.producers, tmdbData.producers);
            baseDetails.artDirectors = merge(baseDetails.artDirectors, tmdbData.artDirectors);
            baseDetails.distributors = merge(baseDetails.distributors, tmdbData.productionCompanies); // Use Production Companies as Distributors/Studios
            baseDetails.countries = merge(baseDetails.countries, tmdbData.countries);
        }

        // 3. OMDB MERGE
        if (omdbData) {
            if (omdbData.countries) baseDetails.countries = merge(baseDetails.countries, omdbData.countries);
            // OMDb 'Production' often lists the distributor/studio
            if (omdbData.production) baseDetails.distributors = merge(baseDetails.distributors, [omdbData.production]);
        }

        // 4. TVMAZE MERGE
        if (tvMazeData) {
            if ((!baseDetails.rating || baseDetails.rating === "N/A") && tvMazeData.rating) baseDetails.rating = tvMazeData.rating;
            if (baseDetails.genres.length === 0 && tvMazeData.genres) baseDetails.genres = tvMazeData.genres;
            if (!baseDetails.description && tvMazeData.description) baseDetails.description = tvMazeData.description;
        }

    } catch (error) {
        console.warn("Error aggregating movie details:", error);
    }

    return baseDetails;
};
