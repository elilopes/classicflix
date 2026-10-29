
/// <reference types="vite/client" />
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

const OMDB_KEY = import.meta.env.VITE_OMDB_KEY;
const TMDB_KEY = import.meta.env.VITE_TMDB_API_KEY;
const RAPID_KEY = import.meta.env.VITE_RAPID_API_KEY;

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
  const host = import.meta.env.VITE_RAPID_API_HOST_ROTTEN;
  if (!RAPID_KEY || !host) return null;

  try {
    const response = await fetch(`https://${host}/search?q=${encodeURIComponent(title)}`, {
      headers: {
        'x-rapidapi-key': RAPID_KEY,
        'x-rapidapi-host': host
      }
    });
    const data = await response.json();
    // Logic to extract rating depends on the specific API response structure
    return data?.rating || null;
  } catch (error) {
    console.error('Error fetching RT rating:', error);
    return null;
  }
}

/**
 * Fetches cinematic data from Cinema API via RapidAPI
 */
export async function fetchCinemaData(title: string): Promise<any> {
  const host = import.meta.env.VITE_RAPID_API_HOST_CINEMA;
  if (!RAPID_KEY || !host) return null;

  try {
    const response = await fetch(`https://${host}/search?query=${encodeURIComponent(title)}`, {
      headers: {
        'x-rapidapi-key': RAPID_KEY,
        'x-rapidapi-host': host
      }
    });
    return await response.json();
  } catch (error) {
    console.error('Error fetching Cinema data:', error);
    return null;
  }
}

/**
 * Fetches data from Sora Cinematic API via RapidAPI
 */
export async function fetchSoraCinematicData(title: string): Promise<any> {
  const host = import.meta.env.VITE_RAPID_API_HOST_SORA;
  if (!RAPID_KEY || !host) return null;

  try {
    const response = await fetch(`https://${host}/generate?prompt=${encodeURIComponent(`Cinematic details for ${title}`)}`, {
      headers: {
        'x-rapidapi-key': RAPID_KEY,
        'x-rapidapi-host': host
      }
    });
    return await response.json();
  } catch (error) {
    console.error('Error fetching Sora data:', error);
    return null;
  }
}

/**
 * Aggregates data from multiple external sources
 */
export async function getAggregatedMovieData(title: string, year?: string, language: string = 'en'): Promise<ExternalMovieData> {
  const [omdb, tmdb] = await Promise.all([
    fetchOMDBData(title, year),
    fetchTMDBData(title, year, language)
  ]);

  const ratings: ExternalRatings = {};

  if (omdb && omdb.Response !== 'False') {
    ratings.imdb = omdb.imdbRating;
    const rtRating = omdb.Ratings?.find((r: any) => r.Source === 'Rotten Tomatoes');
    if (rtRating) ratings.rottenTomatoes = rtRating.Value;
    ratings.metacritic = omdb.Metascore;
  }

  if (tmdb) {
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
