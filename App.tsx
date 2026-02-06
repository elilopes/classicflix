import React, { useState, useEffect, useMemo } from 'react';
import { INITIAL_MOVIES, DECADES, RATING_CATEGORIES, APP_TRANSLATIONS } from './constants';
import { Movie, FilterState, AppLanguage, UserMovieInteraction } from './types';
import { VideoPlayer } from './components/VideoPlayer';
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
  Search, Film, User, LogOut, Loader2, Globe, Sparkles, Plus, RefreshCw
} from 'lucide-react';

// Helper to normalize language strings from DB to UI constants
const getCanonicalLanguage = (rawLang: string | undefined): string => {
    if (!rawLang || rawLang === 'null' || rawLang === 'undefined') return 'Unknown';
    
    // 1. Direct Match: Prioritize exact values from your DB
    // This ensures "English" stays "English" and "Portuguese" stays "Portuguese"
    if (['English', 'Portuguese', 'French', 'Spanish', 'German', 'Italian', 'Russian', 'Japanese', 'Chinese', 'Hindi', 'Silent', 'Unknown'].includes(rawLang)) {
        return rawLang;
    }

    const lower = rawLang.toLowerCase().trim();
    
    // 2. Fallback normalization for variations (only if exact match fails)
    if (lower.startsWith('pt') || lower.includes('portug')) return 'Portuguese';
    if (lower.startsWith('en') || lower.includes('engl') || lower.includes('ingl')) return 'English';
    if (lower.startsWith('es') || lower.includes('span') || lower.includes('espan')) return 'Spanish';
    if (lower.startsWith('fr') || lower.includes('fren') || lower.includes('franc')) return 'French';
    if (lower.startsWith('de') || lower.includes('germ') || lower.includes('alem')) return 'German';
    if (lower.startsWith('it') || lower.includes('ital')) return 'Italian';
    if (lower.startsWith('ru') || lower.includes('russ')) return 'Russian';
    if (lower.startsWith('ja') || lower.includes('japan')) return 'Japanese';
    if (lower.startsWith('zh') || lower.includes('chin')) return 'Chinese';
    if (lower.startsWith('hi') || lower.includes('hind')) return 'Hindi';
    if (lower.includes('silent') || lower.includes('mudo')) return 'Silent';
    
    // 3. Last Resort: Capitalize first letter
    return rawLang.charAt(0).toUpperCase() + rawLang.slice(1);
};

export default function App() {
  const [appLanguage, setAppLanguage] = useState<AppLanguage>('pt');
  const [viewMode, setViewMode] = useState<'image' | 'text'>('image');
  
  const [databaseMovies, setDatabaseMovies] = useState<Movie[]>(INITIAL_MOVIES || []); 
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
  });

  const t = APP_TRANSLATIONS[appLanguage] || APP_TRANSLATIONS['pt'];

  const isFiltering = useMemo(() => {
    return !!(
      filters.searchQuery || 
      filters.selectedGenre || 
      filters.selectedLanguage || 
      filters.selectedYear || 
      filters.selectedDecade || 
      filters.selectedRating || 
      filters.selectedColor || 
      filters.selectedTheme || 
      filters.selectedDuration || 
      filters.hasSubtitles !== null ||
      filters.selectedDirector ||
      filters.selectedAward
    );
  }, [filters]);

  const refreshData = async () => {
    setIsLoading(true);
    try {
      const moviesFromDb = await fetchSupabaseMovies();
      console.log(`Supabase Load: Fetched ${moviesFromDb?.length} movies.`);
      
      const safeMovies = (moviesFromDb && moviesFromDb.length > 0) 
        ? moviesFromDb 
        : (INITIAL_MOVIES || []);
      
      if (!moviesFromDb || moviesFromDb.length === 0) {
          console.warn("Using fallback INITIAL_MOVIES (Supabase returned 0 or error).");
      }

      setDatabaseMovies(safeMovies);
      
      if (user) {
          const userInteractions = await getUserInteractions();
          setInteractions(userInteractions || []);
      }
    } catch (e) {
      console.error("Failed to refresh data", e);
      setDatabaseMovies(INITIAL_MOVIES || []);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshData();
    
    let unsubscribe: () => void;

    const initAuth = async () => {
        try {
            const unsub = await subscribeToAuthChanges((currentUser) => {
                setUser(currentUser);
                if (currentUser) {
                    getUserInteractions().then(res => setInteractions(res || []));
                } else {
                    setInteractions([]);
                }
            });
            unsubscribe = unsub;
        } catch (e) {
            console.warn("Auth subscription failed", e);
        }
    };

    initAuth();

    return () => {
        if (unsubscribe) unsubscribe();
    };
  }, []);

  const uniqueDirectors = useMemo(() => {
    const directors = new Set<string>();
    if (Array.isArray(databaseMovies)) {
      databaseMovies.forEach(m => {
        if (m && m.director && m.director !== 'Unknown') directors.add(m.director);
      });
    }
    return Array.from(directors).sort();
  }, [databaseMovies]);

  const uniqueAwards = useMemo(() => {
    const awards = new Set<string>();
    if (Array.isArray(databaseMovies)) {
      databaseMovies.forEach(m => {
        if (m && m.awards && Array.isArray(m.awards)) m.awards.forEach(a => awards.add(a));
      });
    }
    return Array.from(awards).sort();
  }, [databaseMovies]);

  // Dynamic Language Counting
  const languageCounts = useMemo(() => {
      const counts: Record<string, number> = {};
      
      databaseMovies.forEach(movie => {
          let canonical = getCanonicalLanguage(movie.language);
          counts[canonical] = (counts[canonical] || 0) + 1;

          // Special Handling: Silent genre
          const isSilentGenre = Array.isArray(movie.genres) && movie.genres.includes('Silent');
          if (isSilentGenre && canonical !== 'Silent') {
              counts['Silent'] = (counts['Silent'] || 0) + 1;
          }
      });
      return counts;
  }, [databaseMovies]);

  // Dynamic Genre Counting
  const genreCounts = useMemo(() => {
      const counts: Record<string, number> = {};
      databaseMovies.forEach(movie => {
          if (Array.isArray(movie.genres)) {
              movie.genres.forEach(g => {
                  const clean = g.trim();
                  if (clean) counts[clean] = (counts[clean] || 0) + 1;
              });
          }
      });
      return counts;
  }, [databaseMovies]);

  // Dynamic Theme Counting
  const themeCounts = useMemo(() => {
      const counts: Record<string, number> = {};
      databaseMovies.forEach(movie => {
          if (Array.isArray(movie.themes)) {
              movie.themes.forEach(t => {
                  const clean = t.trim();
                  if (clean) counts[clean] = (counts[clean] || 0) + 1;
              });
          }
      });
      return counts;
  }, [databaseMovies]);

  const availableLanguages = useMemo(() => {
      const langs = Object.keys(languageCounts).sort();
      // Ensure Unknown is available if needed, though languageCounts should cover it
      return langs;
  }, [languageCounts]);

  const parseDuration = (dur: string): number => {
    if (!dur || typeof dur !== 'string') return 0;
    
    let total = 0;
    const hMatch = dur.match(/(\d+)\s*h/);
    if (hMatch) total += parseInt(hMatch[1]) * 60;
    
    const mMatch = dur.match(/(\d+)\s*m/);
    if (mMatch) total += parseInt(mMatch[1]);
    
    if (total === 0 && !hMatch && !mMatch) {
        const simpleNum = parseInt(dur.replace(/\D/g, ''));
        if (!isNaN(simpleNum)) total = simpleNum;
    }
    return total;
  };

  const filteredMovies = useMemo(() => {
    if (!databaseMovies || !Array.isArray(databaseMovies)) return [];
    if (!isFiltering) return databaseMovies;
    
    return databaseMovies.filter(movie => {
      if (!movie) return false;

      const searchLower = (filters.searchQuery || '').toLowerCase();
      const matchesSearch = !filters.searchQuery || 
        (movie.title || '').toLowerCase().includes(searchLower) || 
        (movie.titlePt && movie.titlePt.toLowerCase().includes(searchLower)) ||
        (movie.description && movie.description.toLowerCase().includes(searchLower));
      
      const genres = Array.isArray(movie.genres) ? movie.genres : [];
      const themes = Array.isArray(movie.themes) ? movie.themes : [];
      const awards = Array.isArray(movie.awards) ? movie.awards : [];

      const matchesGenre = !filters.selectedGenre || genres.includes(filters.selectedGenre);
      
      // Robust Language Matching
      let matchesLang = true;
      if (filters.selectedLanguage) {
          const canonicalMovieLang = getCanonicalLanguage(movie.language);
          
          if (filters.selectedLanguage === 'Silent') {
              matchesLang = canonicalMovieLang === 'Silent' || genres.includes('Silent');
          } else {
              matchesLang = canonicalMovieLang === filters.selectedLanguage;
          }
      }
      
      const matchesColor = !filters.selectedColor || movie.color === filters.selectedColor;
      const matchesTheme = !filters.selectedTheme || themes.includes(filters.selectedTheme);
      const matchesYear = !filters.selectedYear || movie.year === filters.selectedYear;
      const matchesSubs = filters.hasSubtitles === null || movie.hasSubtitles === filters.hasSubtitles;
      const matchesDirector = !filters.selectedDirector || movie.director === filters.selectedDirector;
      const matchesAward = !filters.selectedAward || awards.includes(filters.selectedAward);
      const matchesDecade = !filters.selectedDecade || (movie.year >= filters.selectedDecade && movie.year < filters.selectedDecade + 10);

      let matchesRating = true;
      if (filters.selectedRating) {
        const cat = RATING_CATEGORIES.find(c => c.id === filters.selectedRating);
        if (cat) {
          const numRating = parseFloat(movie.rating) || 0;
          matchesRating = numRating >= cat.min && numRating <= cat.max;
        }
      }

      let matchesDuration = true;
      if (filters.selectedDuration) {
        const mins = parseDuration(movie.duration);
        if (filters.selectedDuration === 'very_short') matchesDuration = mins <= 5;
        else if (filters.selectedDuration === 'short') matchesDuration = mins > 5 && mins <= 20;
        else if (filters.selectedDuration === 'medium') matchesDuration = mins > 20 && mins <= 40;
        else if (filters.selectedDuration === 'long') matchesDuration = mins > 40 && mins <= 120;
        else if (filters.selectedDuration === 'giant') matchesDuration = mins > 120;
      }

      return matchesSearch && matchesGenre && matchesLang && matchesDuration && matchesColor && matchesTheme && matchesYear && matchesSubs && matchesDecade && matchesRating && matchesDirector && matchesAward;
    });
  }, [databaseMovies, filters, isFiltering]);

  const getState = (movieId: string) => interactions.find(i => i.movie_id === movieId) || { is_favorite: false, is_watched: false, watch_later: false, progress_seconds: 0 };

  const toggleList = async (movieId: string, field: keyof UserMovieInteraction) => {
    if (!user) { setShowAuthModal(true); return; }
    const existing = interactions.find(i => i.movie_id === movieId);
    const newValue = existing ? !existing[field] : true;
    await updateInteraction(movieId, { [field]: newValue });
    setInteractions(await getUserInteractions());
  };

  const handleAuth = async () => {
    if (!authUsername || !authPassword) return;
    setAuthLoading(true);
    try {
      if (authMode === 'login') {
        const { error } = await signInUser(authUsername, authPassword);
        if (error) throw error;
      } else {
        const { error } = await signUpUser(authUsername, authPassword);
        if (error) throw error;
      }
      setShowAuthModal(false);
    } catch (err: any) {
      alert(err.message || "Falha na autenticação");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
      await signOutUser();
  };

  return (
    <div className="min-vh-100 bg-black text-white d-flex flex-column">
      <nav className="navbar navbar-expand-lg navbar-dark bg-surface sticky-top border-bottom border-secondary px-3 shadow">
        <div className="container-fluid">
          <a className="navbar-brand fw-bold text-danger d-flex align-items-center gap-2" href="#" onClick={() => setFilters({searchQuery: '', selectedGenre: null, selectedLanguage: null, selectedYear: null, selectedDecade: null, selectedRating: null, selectedColor: null, selectedTheme: null, selectedSource: null, selectedDuration: null, hasSubtitles: null, selectedDirector: null, selectedAward: null})}>
            <Film size={26} /> <span style={{letterSpacing: '1px'}}>CLASSICFLIX</span>
          </a>

          <div className="d-flex flex-grow-1 mx-4 max-w-lg position-relative">
            <input 
              className="form-control bg-dark text-white border-secondary rounded ps-4 shadow-sm" 
              placeholder={t.searchPlaceholder} 
              value={filters.searchQuery} 
              onChange={e => setFilters({...filters, searchQuery: e.target.value})} 
            />
            <Search className="position-absolute end-0 top-50 translate-middle-y me-3 text-secondary" size={18} />
          </div>

          <div className="d-flex gap-2 align-items-center">
            <button className="btn btn-outline-success btn-sm d-flex align-items-center gap-1 shadow-sm" title={t.addMovie} onClick={() => setShowAddModal(true)}>
              <Plus size={16} /> <span className="d-none d-lg-inline">{t.addMovie}</span>
            </button>
            <button className="btn btn-outline-primary btn-sm d-flex align-items-center gap-1 shadow-sm" onClick={refreshData} title={t.updateSupabase}>
              <RefreshCw size={16} />
            </button>

            <div className="vr mx-2 bg-secondary d-none d-md-block"></div>

            {user ? (
              <div className="dropdown">
                <button className="btn btn-dark dropdown-toggle d-flex align-items-center gap-2 border-secondary" data-bs-toggle="dropdown">
                  <User size={18} className="text-danger" /> {user.email.split('@')[0]}
                </button>
                <ul className="dropdown-menu dropdown-menu-dark dropdown-menu-end shadow border-secondary">
                  <li><button className="dropdown-item py-2" onClick={handleLogout}><LogOut size={16} className="me-2" /> {t.logout}</button></li>
                </ul>
              </div>
            ) : (
              <button className="btn btn-danger fw-bold btn-sm px-3 shadow" onClick={() => setShowAuthModal(true)}>{t.login}</button>
            )}

            <div className="dropdown">
              <button className="btn btn-outline-secondary btn-sm dropdown-toggle" data-bs-toggle="dropdown"><Globe size={16} className="me-1" /> {appLanguage.toUpperCase()}</button>
              <ul className="dropdown-menu dropdown-menu-dark border-secondary">
                {['en', 'pt', 'it', 'hi', 'ru'].map(lang => (<li key={lang}><button className="dropdown-item" onClick={() => setAppLanguage(lang as any)}>{lang.toUpperCase()}</button></li>))}
              </ul>
            </div>
          </div>
        </div>
      </nav>

      <main className="flex-grow-1">
        <FilterBar 
          filters={filters}
          setFilters={setFilters}
          appLanguage={appLanguage}
          t={t}
          uniqueDirectors={uniqueDirectors}
          uniqueAwards={uniqueAwards}
          viewMode={viewMode}
          setViewMode={setViewMode}
          languageCounts={languageCounts}
          genreCounts={genreCounts}
          themeCounts={themeCounts}
        />

        {isFiltering ? (
            <div className="container-fluid p-4">
                <div className="d-flex justify-content-between align-items-center mb-4">
                    <h5 className="m-0 text-secondary">
                        {filters.searchQuery ? `Pesquisando: "${filters.searchQuery}"` : "Filtros Ativos"} 
                        <span className="ms-2 badge bg-dark border border-secondary text-secondary fw-normal">{filteredMovies.length} títulos encontrados</span>
                    </h5>
                    <button className="btn btn-sm btn-outline-secondary" onClick={() => setFilters({searchQuery: '', selectedGenre: null, selectedLanguage: null, selectedYear: null, selectedDecade: null, selectedRating: null, selectedColor: null, selectedTheme: null, selectedSource: null, selectedDuration: null, hasSubtitles: null, selectedDirector: null, selectedAward: null})}>Limpar Tudo</button>
                </div>
                
                {isLoading ? (
                    <div className="text-center py-5"><Loader2 className="animate-spin text-danger mx-auto" size={50} /></div>
                ) : filteredMovies.length > 0 ? (
                    <div className="row row-cols-2 row-cols-md-4 row-cols-lg-6 g-3">
                        {filteredMovies.map(movie => (
                            <MovieCard key={movie.id} movie={movie} state={getState(movie.id)} onOpen={() => setSelectedMovie(movie)} viewMode={viewMode} />
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-5 border border-secondary rounded bg-surface">
                        <Film size={48} className="text-secondary mb-3 opacity-25" />
                        <h5 className="text-secondary">Nenhum filme encontrado com estes critérios.</h5>
                    </div>
                )}
            </div>
        ) : (
            <div className="container text-center py-5">
                <Sparkles size={40} className="text-secondary mb-3 opacity-25" />
                <h2 className="text-white fw-bold mb-2">Bem vindo ao classicflix</h2>
                <p className="text-white-50 mb-4">Portal sobre a história do cinema. Todos os títulos são livres com um catálogo de {(databaseMovies || []).length} vídeos.</p>
                <p className="text-secondary lead">Selecione um filtro acima para começar a explorar o catálogo.</p>
            </div>
        )}
      </main>

      <footer className="bg-surface border-top border-secondary p-5 mt-5 shadow">
        <div className="container text-center">
            <Film size={36} className="text-danger mb-3 mx-auto" />
            <h5 className="fw-bold mb-3" style={{letterSpacing: '2px'}}>CLASSICFLIX</h5>
            <p className="text-secondary small max-w-lg mx-auto mb-4">{t.footerText}</p>
        </div>
      </footer>

      {/* AI CONCIERGE FLOATING BUTTON */}
      <AiConcierge catalog={databaseMovies} language={appLanguage} />

      <AppModals 
        showAddModal={showAddModal}
        setShowAddModal={setShowAddModal}
        selectedMovie={selectedMovie}
        setSelectedMovie={setSelectedMovie}
        appLanguage={appLanguage}
        getState={getState}
        onToggleInteraction={toggleList}
        showAuthModal={showAuthModal}
        setShowAuthModal={setShowAuthModal}
        authMode={authMode}
        setAuthMode={setAuthMode}
        authUsername={authUsername}
        setAuthUsername={setAuthUsername}
        authPassword={authPassword}
        setAuthPassword={setAuthPassword}
        handleAuth={handleAuth}
        authLoading={authLoading}
        onRefresh={refreshData}
        t={t}
      />
    </div>
  );
}