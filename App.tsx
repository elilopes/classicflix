
import React, { useState, useEffect, useMemo } from 'react';
import { INITIAL_MOVIES, DECADES, RATING_CATEGORIES, APP_TRANSLATIONS } from './constants';
import { Movie, FilterState, AppLanguage, UserMovieInteraction } from './types';
import { AppModals } from './components/AppModals';
import { FilterBar } from './components/FilterBar';
import { AiConcierge } from './components/AiConcierge';
import { MovieCard } from './components/MovieCard'; 

import { 
    fetchSupabaseMovies, 
    getUserInteractions, 
    updateInteraction, 
    subscribeToAuthChanges, 
    signInUser, 
    signUpUser, 
    signOutUser 
} from './services/supabaseClient';

import { 
  Search, Film, User, LogOut, Loader2, Plus, RefreshCw, ChevronDown
} from 'lucide-react';

const getCanonicalLanguage = (rawLang: string | undefined): string => {
    if (!rawLang || rawLang === 'null' || rawLang === 'undefined') return 'Unknown';
    const lower = rawLang.toLowerCase().trim();
    if (lower.startsWith('pt') || lower.includes('portug')) return 'Portuguese';
    if (lower.startsWith('en') || lower.includes('engl') || lower.includes('ingl')) return 'English';
    if (lower.includes('silent') || lower.includes('mudo')) return 'Silent';
    return rawLang.charAt(0).toUpperCase() + rawLang.slice(1);
};

export default function App() {
  const [appLanguage, setAppLanguage] = useState<AppLanguage>('pt');
  const [viewMode, setViewMode] = useState<'image' | 'text'>('image');
  const [databaseMovies, setDatabaseMovies] = useState<Movie[]>([]); 
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [interactions, setInteractions] = useState<UserMovieInteraction[]>([]);
  const [selectedMovie, setSelectedMovie] = useState<Movie | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [authUsername, setAuthUsername] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [visibleCount, setVisibleCount] = useState(48);

  const [filters, setFilters] = useState<FilterState>({
    searchQuery: '',
    selectedGenre: null,
    selectedLanguage: null,
    selectedYear: null,
    selectedDecade: null,
    selectedRating: null,
    selectedColor: null,
    selectedTheme: null,
    selectedSource: null,
    selectedDuration: null,
    hasSubtitles: null,
    selectedDirector: null,
    selectedAward: null,
    hasPosterOnly: false,
    selectedTop30: null
  });

  const t = APP_TRANSLATIONS[appLanguage] || APP_TRANSLATIONS['pt'];

  const isFiltering = useMemo(() => {
    return !!(filters.searchQuery || filters.selectedGenre || filters.selectedLanguage || filters.selectedYear || filters.selectedDecade || filters.selectedRating || filters.selectedColor || filters.selectedTheme || filters.selectedDuration || filters.hasSubtitles !== null || filters.selectedDirector || filters.selectedAward || filters.hasPosterOnly || filters.selectedTop30);
  }, [filters]);

  useEffect(() => { setVisibleCount(48); }, [filters]);

  const refreshData = async () => {
    setIsLoading(true);
    try {
      const moviesFromDb = await fetchSupabaseMovies();
      setDatabaseMovies(moviesFromDb && moviesFromDb.length > 0 ? moviesFromDb : INITIAL_MOVIES);
      if (user) setInteractions(await getUserInteractions());
    } catch (e) {
      setDatabaseMovies(INITIAL_MOVIES);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshData();
    subscribeToAuthChanges((currentUser) => {
        setUser(currentUser);
        if (currentUser) getUserInteractions().then(setInteractions);
        else setInteractions([]);
    });
  }, []);

  const uniqueDirectors = useMemo(() => {
    const directors = new Set<string>();
    databaseMovies.forEach(m => { if (m.director && m.director !== 'Unknown') directors.add(m.director); });
    return Array.from(directors).sort();
  }, [databaseMovies]);

  const uniqueAwards = useMemo(() => {
    const awards = new Set<string>();
    databaseMovies.forEach(m => { if (m.awards) m.awards.forEach(a => awards.add(a)); });
    return Array.from(awards).sort();
  }, [databaseMovies]);

  const stats = useMemo(() => {
      const lang: Record<string, number> = {};
      const gen: Record<string, number> = {};
      const th: Record<string, number> = {};
      databaseMovies.forEach(m => {
          const l = getCanonicalLanguage(m.language); lang[l] = (lang[l] || 0) + 1;
          if (m.genres) m.genres.forEach(g => { gen[g] = (gen[g] || 0) + 1; });
          if (m.themes) m.themes.forEach(t => { th[t] = (th[t] || 0) + 1; });
      });
      return { lang, gen, th };
  }, [databaseMovies]);

  const filteredMovies = useMemo(() => {
    return databaseMovies.filter(movie => {
      if (filters.hasPosterOnly && (!movie.posterUrl || movie.posterUrl.includes('placehold.co'))) return false;
      if (filters.selectedTop30) {
        const cleanTopTitle = filters.selectedTop30.replace(/^\d+\.\s+/, '').toLowerCase();
        const movieTitle = (movie.titlePt || movie.title || '').toLowerCase();
        if (!movieTitle.includes(cleanTopTitle)) return false;
      }
      if (!isFiltering) return true;

      const searchLower = (filters.searchQuery || '').toLowerCase();
      const matchesSearch = !filters.searchQuery || 
        (movie.title || '').toLowerCase().includes(searchLower) || 
        (movie.titlePt && movie.titlePt.toLowerCase().includes(searchLower)) ||
        (movie.description && movie.description.toLowerCase().includes(searchLower));
      
      const matchesGenre = !filters.selectedGenre || (movie.genres || []).includes(filters.selectedGenre);
      const matchesLang = !filters.selectedLanguage || getCanonicalLanguage(movie.language) === filters.selectedLanguage;
      const matchesYear = !filters.selectedYear || movie.year === filters.selectedYear;
      const matchesDirector = !filters.selectedDirector || movie.director === filters.selectedDirector;
      const matchesDecade = !filters.selectedDecade || (movie.year >= filters.selectedDecade && movie.year < filters.selectedDecade + 10);

      return matchesSearch && matchesGenre && matchesLang && matchesYear && matchesDecade && matchesDirector;
    });
  }, [databaseMovies, filters, isFiltering]);

  const displayedMovies = useMemo(() => filteredMovies.slice(0, visibleCount), [filteredMovies, visibleCount]);
  const getState = (movieId: string) => interactions.find(i => i.movie_id === movieId) || { movie_id: movieId, is_favorite: false, is_watched: false, watch_later: false, progress_seconds: 0 };

  const toggleList = async (movieId: string, field: keyof UserMovieInteraction) => {
    if (!user) { setShowAuthModal(true); return; }
    const existing = interactions.find(i => i.movie_id === movieId);
    const newValue = existing ? !existing[field] : true;
    await updateInteraction(movieId, { [field]: newValue });
    setInteractions(await getUserInteractions());
  };

  const handleAuth = async () => {
    setAuthLoading(true);
    try {
      const { error } = (authMode === 'login') ? await signInUser(authUsername, authPassword) : await signUpUser(authUsername, authPassword);
      if (error) throw error;
      setShowAuthModal(false);
    } catch (err: any) { alert(err.message); } finally { setAuthLoading(false); }
  };

  return (
    <div className="min-vh-100 bg-black text-white d-flex flex-column">
      <nav className="navbar navbar-expand-lg navbar-dark bg-surface sticky-top border-bottom border-secondary px-3 shadow">
        <div className="container-fluid">
          <a className="navbar-brand fw-bold text-danger d-flex align-items-center gap-2" href="#" onClick={() => setFilters({searchQuery: '', selectedGenre: null, selectedLanguage: null, selectedYear: null, selectedDecade: null, selectedRating: null, selectedColor: null, selectedTheme: null, selectedSource: null, selectedDuration: null, hasSubtitles: null, selectedDirector: null, selectedAward: null, hasPosterOnly: false, selectedTop30: null})}>
            <Film size={26} /> <span>CLASSICFLIX</span>
          </a>
          <div className="d-flex flex-grow-1 mx-4 max-w-lg position-relative">
            <input className="form-control bg-dark text-white border-secondary rounded ps-4 shadow-sm" placeholder={t.searchPlaceholder} value={filters.searchQuery} onChange={e => setFilters({...filters, searchQuery: e.target.value})} />
            <Search className="position-absolute end-0 top-50 translate-middle-y me-3 text-secondary" size={18} />
          </div>
          <div className="d-flex gap-2 align-items-center">
            <button className="btn btn-outline-success btn-sm d-flex align-items-center gap-1" onClick={() => setShowAddModal(true)}><Plus size={16} /><span className="d-none d-lg-inline">{t.addMovie}</span></button>
            <button className="btn btn-outline-primary btn-sm" onClick={refreshData}><RefreshCw size={16} /></button>
            {user ? (
              <div className="dropdown">
                <button className="btn btn-dark dropdown-toggle border-secondary" data-bs-toggle="dropdown"><User size={18} className="text-danger" /> {user.email.split('@')[0]}</button>
                <ul className="dropdown-menu dropdown-menu-dark dropdown-menu-end shadow border-secondary">
                  <li><button className="dropdown-item py-2" onClick={() => signOutUser()}><LogOut size={16} className="me-2" /> {t.logout}</button></li>
                </ul>
              </div>
            ) : <button className="btn btn-danger btn-sm px-3 shadow" onClick={() => setShowAuthModal(true)}>{t.login}</button>}
          </div>
        </div>
      </nav>

      <main className="flex-grow-1">
        <FilterBar filters={filters} setFilters={setFilters} appLanguage={appLanguage} t={t} uniqueDirectors={uniqueDirectors} uniqueAwards={uniqueAwards} viewMode={viewMode} setViewMode={setViewMode} languageCounts={stats.lang} genreCounts={stats.gen} themeCounts={stats.th} />
        <div className="container-fluid p-4">
          {isLoading ? <div className="text-center py-5"><Loader2 className="animate-spin text-danger mx-auto" size={50} /></div> : (
            <>
              <div className="row row-cols-2 row-cols-md-4 row-cols-lg-6 g-3">
                {displayedMovies.map(movie => <MovieCard key={movie.id} movie={movie} state={getState(movie.id)} onOpen={() => setSelectedMovie(movie)} viewMode={viewMode} />)}
              </div>
              {visibleCount < filteredMovies.length && (
                <div className="text-center mt-5 mb-3">
                  <button className="btn btn-outline-light px-5 py-2" onClick={() => setVisibleCount(v => v + 48)}><ChevronDown size={20} /> Carregar Mais</button>
                </div>
              )}
              {filteredMovies.length === 0 && <div className="text-center py-5 opacity-50"><Film size={48} className="mb-3 mx-auto" /><h5>Nenhum título encontrado.</h5></div>}
            </>
          )}
        </div>
      </main>
      <footer className="bg-surface border-top border-secondary p-5 mt-5 text-center shadow">
        <h5 className="fw-bold mb-3 text-danger">CLASSICFLIX</h5>
        <p className="text-secondary small">{t.footerText}</p>
      </footer>
      <AiConcierge catalog={databaseMovies} language={appLanguage} />
      <AppModals showAddModal={showAddModal} setShowAddModal={setShowAddModal} selectedMovie={selectedMovie} setSelectedMovie={setSelectedMovie} appLanguage={appLanguage} getState={getState} onToggleInteraction={toggleList} showAuthModal={showAuthModal} setShowAuthModal={setShowAuthModal} authMode={authMode} setAuthMode={setAuthMode} authUsername={authUsername} setAuthUsername={setAuthUsername} authPassword={authPassword} setAuthPassword={setAuthPassword} handleAuth={handleAuth} authLoading={authLoading} onRefresh={refreshData} t={t} />
    </div>
  );
}
