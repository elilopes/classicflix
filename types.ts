
export interface Movie {
  id: string;
  wikidataId?: string;
  title: string;
  titlePt?: string;
  originalTitle?: string;
  description: string;
  descriptionPt?: string;
  descriptionHi?: string;
  descriptionRu?: string;
  descriptionIt?: string;
  genres: string[];
  year: number;
  language: string;
  hasSubtitles: boolean;
  posterUrl: string;
  videoUrl: string | null;
  trailerUrl?: string;
  rating: string;
  duration: string;
  director: string;
  directorId?: string; // New: Wikidata QID for the director
  type: 'Movie' | 'Series';
  sourceLabel?: string;
  cast?: string[];
  writers?: string[];
  awards?: string[];
  cinematographers?: string[];
  composers?: string[];
  color?: 'Color' | 'Black & White' | 'Mixed';
  themes?: string[];
}

export type DurationCategory = 'very_short' | 'short' | 'medium' | 'long' | 'giant';

export interface FilterState {
  searchQuery: string;
  selectedGenre: string | null;
  selectedLanguage: string | null;
  selectedYear: number | null;
  selectedDecade: number | null;
  selectedRating: string | null;
  selectedColor: string | null;
  selectedTheme: string | null;
  selectedSource: string | null;
  selectedDuration: DurationCategory | null;
  hasSubtitles: boolean | null;
  selectedDirector: string | null;
  selectedAward: string | null;
}

export interface UserMovieInteraction {
  movie_id: string;
  is_favorite: boolean;
  is_watched: boolean;
  watch_later: boolean;
  progress_seconds: number;
}

export type AppLanguage = 'en' | 'pt' | 'it' | 'hi' | 'ru';
