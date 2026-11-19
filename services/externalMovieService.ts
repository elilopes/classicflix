
/// <reference types="vite/client" />
import { fetchRottenTomatoesData } from './rottenTomatoesService';

export interface ExternalRatings {
  imdb?: string;
  rottenTomatoes?: string;
  metacritic?: string;
  tmdb?: number;
}

export interface ExternalMovieData {
  ratings: ExternalRatings;
  posterPath?: string;
  backdropPath?: string;
  overview?: string;
  tagline?: string;
}

const OMDB_KEY = import.meta.env.VITE_OMDB_KEY || 'dc3946fe';
const TMDB_KEY = import.meta.env.VITE_TMDB_API_KEY || 'e6a44aa8865934c03ad582bc72c5b85d';
const RAPID_KEY = import.meta.env.VITE_RAPID_API_KEY || '8d0b2005e5msh7794ca50aee0eb4p14f460jsn249cb3b9d70b';

/**
 * Fetches movie data from OMDB API
 */
export async function fetchOMDBData(title: string, year?: string): Promise<any> {
  if (!OMDB_KEY) return null;
  try {
    const yearParam = year ? `&y=${year}` : '';
    const response = await fetch(`https://www.omdbapi.com/?apikey=${OMDB_KEY}&t=${encodeURIComponent(title)}${yearParam}`);
    return await response.json();
  } catch (error) {
    console.error('Error fetching OMDB data:', error);
    return null;
  }
}

/**
 * Fetches movie data from TMDB API
 */
export async function fetchTMDBData(title: string, year?: string, language: string = 'en'): Promise<any> {
  if (!TMDB_KEY) return null;
  try {
    const yearParam = year ? `&year=${year}` : '';
    const response = await fetch(`https://api.themoviedb.org/3/search/movie?api_key=${TMDB_KEY}&query=${encodeURIComponent(title)}${yearParam}&language=${language}`);
    const data = await response.json();
    if (data.results && data.results.length > 0) {
      return data.results[0];
    }
    return null;
  } catch (error) {
    console.error('Error fetching TMDB data:', error);
    return null;
  }
}

/**
 * Fetches ratings from Rotten Tomatoes via RapidAPI
 */
export async function fetchRottenTomatoesRating(title: string): Promise<string | null> {
  const host = import.meta.env.VITE_RAPID_API_HOST_ROTTEN || 'rottentomato.p.rapidapi.com';
  if (!RAPID_KEY || !host) return null;

  try {
    const rtData = await fetchRottenTomatoesData(title);
    if (rtData?.tomatometer !== undefined && rtData.tomatometer !== null) {
      return `${rtData.tomatometer}%`;
    }
    return null;
  } catch (error) {
    console.error('Error fetching RT rating:', error);
    return null;
  }
}

/**
 * Aggregates data from multiple external sources (OMDB, TMDB, Rotten Tomatoes RapidAPI)
 */
export async function getAggregatedMovieData(title: string, year?: string, language: string = 'en'): Promise<ExternalMovieData> {
  const [omdb, tmdb] = await Promise.all([
    fetchOMDBData(title, year),
    fetchTMDBData(title, year, language)
  ]);

  const ratings: ExternalRatings = {};

  if (omdb && omdb.Response !== 'False') {
    if (omdb.imdbRating && omdb.imdbRating !== 'N/A') {
      ratings.imdb = omdb.imdbRating;
    }
    const rtRating = omdb.Ratings?.find((r: any) => r.Source === 'Rotten Tomatoes');
    if (rtRating?.Value) ratings.rottenTomatoes = rtRating.Value;
    if (omdb.Metascore && omdb.Metascore !== 'N/A') {
      ratings.metacritic = omdb.Metascore;
    }
  }

  if (!ratings.rottenTomatoes) {
    const rtFallback = await fetchRottenTomatoesRating(title);
    if (rtFallback) ratings.rottenTomatoes = rtFallback;
  }

  if (tmdb?.vote_average) {
    ratings.tmdb = tmdb.vote_average;
  }

  return {
    ratings,
    posterPath: tmdb?.poster_path ? `https://image.tmdb.org/t/p/w342${tmdb.poster_path}` : undefined,
    backdropPath: tmdb?.backdrop_path ? `https://image.tmdb.org/t/p/w780${tmdb.backdrop_path}` : undefined,
    overview: tmdb?.overview,
    tagline: tmdb?.tagline
  };
}
