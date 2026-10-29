
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
  subtitleUrl?: string; // New field for external subtitle file
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
  popularity?: number;
  license?: string;
  isIndependent?: boolean;
  identifiers?: {
    archiveId?: string;
    imdbId?: string;
    omdbId?: string;
    openMdbId?: string;
    ofdbId?: string;
    googleKnowId?: string;
    tmdbCompanyId?: string;
    tmdbId?: string;
    wikimediaCommons?: string;
  };
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
  hasPosterOnly: boolean;
  hasVideoOnly: boolean;
  selectedTop30: string | null;
}

export interface Review {
  id: string;
  wikidataid: string;
  userid: string;
  email: string;
  rating: number; // 1-10
  content: string;
  created_at: string;
  votes?: number;
  replies?: Comment[];
}

export interface Comment {
  id: string;
  reviewid: string;
  wikidataid: string;
  userid: string;
  email: string;
  content: string;
  created_at: string;
  parent_id?: string; // For nested threads
}

export interface UserMovieInteraction {
  wikidataid: string;
  isfavorite: boolean;
  iswatched: boolean;
  iswatchlist: boolean;
  progress_seconds: number;
  lastupdated?: string;
}

export type AppLanguage = 'en' | 'pt' | 'it' | 'hi' | 'ru';
