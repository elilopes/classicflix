
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion } from 'motion/react';
import { DECADES, RATING_CATEGORIES, APP_TRANSLATIONS } from './constants';
import { Movie, FilterState, AppLanguage, UserMovieInteraction } from './types';
import { AppModals } from './components/AppModals';
import { FilterBar } from './components/FilterBar';
import { AiConcierge } from './components/AiConcierge';
import { VideoConverter } from './components/VideoConverter';
import { MovieCard, SkeletonCard } from './components/MovieCard'; 
// @ts-ignore
import jsPDF from 'jspdf';
// @ts-ignore
import autoTable from 'jspdf-autotable';

import { movies as localMovies } from './movies';
import { 
    fetchSupabaseMovies, 
    getUserInteractions, 
    updateInteraction, 
    subscribeToAuthChanges, 
    signInUser, 
    signUpUser, 
    signOutUser,
    incrementMoviePopularity,
    signInWithGoogle
} from './services/supabaseClient';

import { 
  Search, Film, User, LogOut, Loader2, Plus, RefreshCw, ChevronDown, Clapperboard, Globe, TrendingUp, Download, FileText, CheckCircle, X,
  History, Trash2, Orbit, Trophy, Cpu
} from 'lucide-react';
import { GalaxyView } from './components/GalaxyView';
import { TimelineModal } from './components/TimelineModal';
import { AdminDeleteModal } from './components/AdminDeleteModal';
import EmojiGame from './components/EmojiGame';
import MosaicGame from './components/MosaicGame';
import { AdedonhaGame } from './components/AdedonhaGame';
import NosferatuGame from './components/NosferatuGame';
import { MiniGamesModal } from './components/MiniGamesModal';
import { Gamepad2, HardDrive } from 'lucide-react';
import { GoogleDriveModal } from './components/GoogleDriveModal';
import { BestReviewsModal } from './components/BestReviewsModal';
import { McpConnectedAppsModal } from './components/McpConnectedAppsModal';

const getCanonicalLanguage = (rawLang: string | undefined): string => {
    if (!rawLang || rawLang === 'null' || rawLang === 'undefined') return 'Unknown';
    const lower = rawLang.toLowerCase().trim();
    if (lower.startsWith('pt') || lower.includes('portug')) return 'Portuguese';
    if (lower.startsWith('en') || lower.includes('engl') || lower.includes('ingl')) return 'English';
    if (lower.includes('silent') || lower.includes('mudo')) return 'Silent';
    return rawLang.charAt(0).toUpperCase() + rawLang.slice(1);
};

export default function App() {
  const [appLanguage, setAppLanguage] = useState<AppLanguage>('en'); 
  const [viewMode, setViewMode] = useState<'image' | 'text'>('image');
  const [databaseMovies, setDatabaseMovies] = useState<Movie[]>([]); 
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [interactions, setInteractions] = useState<UserMovieInteraction[]>([]);
  const [selectedMovie, setSelectedMovie] = useState<Movie | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showConverterModal, setShowConverterModal] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showTimelineModal, setShowTimelineModal] = useState(false);
  const [showLeaderboardModal, setShowLeaderboardModal] = useState(false);
  const [showAdminDeleteModal, setShowAdminDeleteModal] = useState(false);
  const [showEmojiGame, setShowEmojiGame] = useState(false);
  const [showMosaicGame, setShowMosaicGame] = useState(false);
  const [showAdedonhaGame, setShowAdedonhaGame] = useState(false);
  const [showNosferatuGame, setShowNosferatuGame] = useState(false);
  const [showMiniGamesModal, setShowMiniGamesModal] = useState(false);
  const [showDriveModal, setShowDriveModal] = useState(false);
  const [showBestReviewsModal, setShowBestReviewsModal] = useState(false);
  const [showMcpModal, setShowMcpModal] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [authUsername, setAuthUsername] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');
  const [visibleCount, setVisibleCount] = useState(48);
  const [isExporting, setIsExporting] = useState(false);

  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);

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
    hasVideoOnly: false,
    selectedTop30: null
  });

  const t = APP_TRANSLATIONS[appLanguage] || APP_TRANSLATIONS['en'];

  const [showGalaxyView, setShowGalaxyView] = useState(false);

  const isFiltering = useMemo(() => {
    return !!(filters.searchQuery || filters.selectedGenre || filters.selectedLanguage || filters.selectedYear || filters.selectedDecade || filters.selectedRating || filters.selectedColor || filters.selectedTheme || filters.selectedDuration || filters.hasSubtitles !== null || filters.selectedDirector || filters.selectedAward || filters.hasPosterOnly || filters.hasVideoOnly || filters.selectedTop30);
  }, [filters]);

  useEffect(() => { setVisibleCount(48); }, [filters]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
        if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
            setShowSuggestions(false);
        }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const refreshData = async () => {
    setIsLoading(true);
    try {
      const moviesFromDb = await fetchSupabaseMovies();
      setDatabaseMovies(moviesFromDb && moviesFromDb.length > 0 ? moviesFromDb : localMovies);
      if (user) setInteractions(await getUserInteractions());
    } catch (e) {
      console.error("Refresh Error:", e);
      setDatabaseMovies(localMovies);
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

  const mostPopularMovies = useMemo(() => {
     return [...databaseMovies]
        .sort((a, b) => (b.popularity || 0) - (a.popularity || 0))
        .slice(0, 5);
  }, [databaseMovies]);

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
      if (filters.hasPosterOnly) {
        if (!movie.posterUrl || movie.posterUrl === 'null' || movie.posterUrl === 'undefined' || movie.posterUrl.trim() === '') return false;
        const url = movie.posterUrl.toLowerCase();
        if (url.includes('placehold.co') || url.includes('ui-avatars.com')) return false;
      }
      if (filters.selectedTop30) {
        const cleanTopTitle = filters.selectedTop30.replace(/^\d+\.\s+/, '').toLowerCase();
        const movieTitle = (movie.titlePt || movie.title || '').toLowerCase();
        if (!movieTitle.includes(cleanTopTitle)) return false;
      }
      if (filters.hasVideoOnly && (!movie.videoUrl || movie.videoUrl === 'null' || movie.videoUrl === 'undefined' || movie.videoUrl.trim() === '')) return false;
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
      const matchesTheme = !filters.selectedTheme || (movie.themes || []).includes(filters.selectedTheme);
      const matchesSubtitles = filters.hasSubtitles === null || movie.hasSubtitles === filters.hasSubtitles;
      const matchesAward = !filters.selectedAward || (movie.awards || []).includes(filters.selectedAward);
      let matchesRating = true;
      if (filters.selectedRating) {
          const cat = RATING_CATEGORIES.find(c => c.id === filters.selectedRating);
          if (cat) {
              const rawRating = movie.rating || '0';
              const r = parseFloat(rawRating);
              const safeR = isNaN(r) ? 0 : r;
              matchesRating = safeR >= cat.min && safeR <= cat.max;
          }
      }
      let matchesDuration = true;
      if (filters.selectedDuration) {
         let minutes = 0;
         const d = movie.duration || "";
         const hMatch = d.match(/(\d+)h/);
         const mMatch = d.match(/(\d+)m/);
         if (hMatch) minutes += parseInt(hMatch[1]) * 60;
         if (mMatch) minutes += parseInt(mMatch[1]);
         if (!hMatch && !mMatch && !isNaN(parseInt(d))) minutes = parseInt(d);
         if (filters.selectedDuration === 'very_short') matchesDuration = minutes <= 5;
         else if (filters.selectedDuration === 'short') matchesDuration = minutes <= 20;
         else if (filters.selectedDuration === 'medium') matchesDuration = minutes <= 40;
         else if (filters.selectedDuration === 'long') matchesDuration = minutes <= 120;
         else if (filters.selectedDuration === 'giant') matchesDuration = minutes > 120;
      }
      const matchesColor = !filters.selectedColor || movie.color === filters.selectedColor;
      return matchesSearch && matchesGenre && matchesLang && matchesYear && matchesDecade && matchesDirector && matchesTheme && matchesSubtitles && matchesAward && matchesRating && matchesDuration && matchesColor;
    });
  }, [databaseMovies, filters, isFiltering]);

  const displayedMovies = useMemo(() => filteredMovies.slice(0, visibleCount), [filteredMovies, visibleCount]);
  
  const getState = (movieId: string) => {
      return interactions.find(i => i.wikidataid === movieId) || { wikidataid: movieId, isfavorite: false, iswatched: false, iswatchlist: false, progress_seconds: 0 };
  };

  const handlePosterFound = (id: string, url: string) => {
    setDatabaseMovies(prev => prev.map(m => m.id === id ? { ...m, posterUrl: url } : m));
  };

  const handleMovieOpen = (movie: Movie) => {
      setSelectedMovie(movie);
      incrementMoviePopularity(movie.id); 
      setShowSuggestions(false);
  };

  const toggleList = async (wikidataId: string, field: keyof UserMovieInteraction) => {
    if (!user) { setShowAuthModal(true); return; }
    const existing = interactions.find(i => i.wikidataid === wikidataId);
    const newValue = existing ? !existing[field as 'isfavorite' | 'iswatched' | 'iswatchlist'] : true;
    await updateInteraction(wikidataId, { [field]: newValue });
    setInteractions(await getUserInteractions());
  };

  const handleAuth = async () => {
    if (!authUsername || !authPassword) return;
    setAuthLoading(true);
    setAuthError('');
    try {
      const result = authMode === 'login' 
        ? await signInUser(authUsername, authPassword)
        : await signUpUser(authUsername, authPassword);
      
      if (result.error) {
        setAuthError(result.error.message);
      } else {
        setShowAuthModal(false);
        setAuthUsername('');
        setAuthPassword('');
        setAuthError('');
        refreshData();
      }
    } catch (error: any) {
      console.error("Auth error:", error);
      setAuthError(error.message || "Unknown error");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    setAuthLoading(true);
    setAuthError('');
    try {
      const result = await signInWithGoogle();
      if (result.error) {
        setAuthError(result.error.message);
      } else {
        setShowAuthModal(false);
        setAuthUsername('');
        setAuthPassword('');
        setAuthError('');
        refreshData();
      }
    } catch (error: any) {
      console.error("Google auth error:", error);
      setAuthError(error.message || "Erro no login com Google");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleExportPDF = () => {
      setIsExporting(true);
      try {
          const doc = new jsPDF();
          const tableData = filteredMovies.map(m => [
              m.wikidataId || m.id,
              m.titlePt || m.title,
              m.year?.toString() || "",
              m.language
          ]);
          doc.setFontSize(18);
          doc.text("ClassicFlix - Movie List", 14, 22);
          doc.setFontSize(11);
          doc.text(`Export Date: ${new Date().toLocaleDateString()}`, 14, 30);
          doc.text(`Total: ${filteredMovies.length} items`, 14, 35);
          autoTable(doc, {
              startY: 40,
              head: [['QID', 'Título', 'Ano', 'Idioma']],
              body: tableData,
              headStyles: { fillColor: [229, 9, 20] }, 
          });
          doc.save(`classicflix-export-${new Date().toISOString().split('T')[0]}.pdf`);
      } catch (error) {
          console.error("PDF Export failed", error);
          alert("Failed to export PDF.");
      } finally {
          setIsExporting(false);
      }
  };

  const MotionClapperboard = motion(Clapperboard);

  return (
    <div className="min-vh-100 bg-black text-white d-flex flex-column">
      <nav className="navbar navbar-expand-lg navbar-dark bg-surface sticky-top border-bottom border-secondary px-3 shadow">
        <div className="container-fluid">
          <a className="navbar-brand fw-bold text-danger d-flex align-items-center gap-2" href="#" onClick={() => setFilters({searchQuery: '', selectedGenre: null, selectedLanguage: null, selectedYear: null, selectedDecade: null, selectedRating: null, selectedColor: null, selectedTheme: null, selectedSource: null, selectedDuration: null, hasSubtitles: null, selectedDirector: null, selectedAward: null, hasPosterOnly: false, hasVideoOnly: false, selectedTop30: null})}>
            <Film size={26} /> <span>CLASSICFLIX</span>
          </a>
          
          <div className="d-flex flex-grow-1 mx-4 max-w-lg position-relative" ref={searchContainerRef}>
            <input 
                className="form-control bg-dark text-white border-secondary rounded ps-4 pe-5 shadow-sm" 
                placeholder={t.searchPlaceholder} 
                value={filters.searchQuery} 
                onChange={e => setFilters({...filters, searchQuery: e.target.value})}
                onFocus={() => setShowSuggestions(true)}
            />
            <div className="position-absolute end-0 top-50 translate-middle-y d-flex align-items-center gap-2 me-3">
              {filters.searchQuery && (
                <button 
                  className="btn btn-link p-0 text-secondary hover-white border-0 shadow-none d-flex align-items-center"
                  onClick={() => setFilters({...filters, searchQuery: ''})}
                  title="Limpar pesquisa"
                >
                  <X size={18} />
                </button>
              )}
              <Search className="text-secondary" size={18} />
            </div>
            
            {showSuggestions && !filters.searchQuery && mostPopularMovies.length > 0 && (
                <div className="position-absolute top-100 start-0 w-100 bg-dark border border-secondary rounded-bottom shadow-lg mt-1" style={{ zIndex: 1000 }}>
                    <h6 className="px-3 py-2 m-0 text-white-50 small border-bottom border-secondary fw-bold d-flex align-items-center gap-2">
                        <TrendingUp size={14} className="text-danger" /> {appLanguage === 'pt' ? 'Mais Pesquisados' : 'Most Popular'}
                    </h6>
                    <div className="list-group list-group-flush">
                        {mostPopularMovies.map(movie => (
                            <button 
                                key={movie.id} 
                                className="list-group-item list-group-item-action bg-dark text-white border-0 d-flex gap-2 align-items-center py-2"
                                onClick={() => handleMovieOpen(movie)}
                            >
                                <div style={{ width: '30px', height: '45px', background: '#333', backgroundImage: `url(${movie.posterUrl})`, backgroundSize: 'cover' }} className="rounded"></div>
                                <div className="text-truncate">
                                    <div className="fw-bold small">{movie.titlePt || movie.title}</div>
                                    <div className="text-white-50 xsmall">{movie.year}</div>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            )}
          </div>

          <div className="d-flex gap-2 align-items-center">
            <div className="dropdown me-1">
              <button className="btn btn-dark btn-sm dropdown-toggle border-secondary d-flex align-items-center gap-2" data-bs-toggle="dropdown">
                <Globe size={16} className="text-info" /> <span className="d-none d-sm-inline">{appLanguage.toUpperCase()}</span>
              </button>
              <ul className="dropdown-menu dropdown-menu-dark dropdown-menu-end shadow border-secondary">
                 <li><button className="dropdown-item py-2" onClick={() => setAppLanguage('en')}>🇺🇸 English</button></li>
                 <li><button className="dropdown-item py-2" onClick={() => setAppLanguage('pt')}>🇧🇷 Português</button></li>
                 <li><button className="dropdown-item py-2" onClick={() => setAppLanguage('it')}>🇮🇹 Italiano</button></li>
                 <li><button className="dropdown-item py-2" onClick={() => setAppLanguage('hi')}>🇮🇳 हिन्दी</button></li>
                 <li><button className="dropdown-item py-2" onClick={() => setAppLanguage('ru')}>🇷🇺 Русский</button></li>
              </ul>
            </div>

            <button className="btn btn-outline-success btn-sm d-flex align-items-center gap-1" onClick={() => setShowAddModal(true)}><Plus size={16} /><span className="d-none d-lg-inline">{t.addMovie}</span></button>
            <button className="btn btn-outline-danger btn-sm d-flex align-items-center gap-1" onClick={() => setShowTimelineModal(true)}><History size={16} /><span className="d-none d-lg-inline">{t.timeline}</span></button>
            <button className="btn btn-outline-warning btn-sm d-flex align-items-center gap-1" onClick={() => setShowConverterModal(true)}><RefreshCw size={16} /><span className="d-none d-lg-inline">{t.videoConverter}</span></button>
            <button className="btn btn-outline-info btn-sm d-flex align-items-center gap-1" onClick={() => setShowDriveModal(true)}>
              <HardDrive size={16} />
              <span className="d-none d-lg-inline">Google Drive</span>
            </button>
            <button className="btn btn-outline-warning btn-sm d-flex align-items-center gap-1" onClick={() => setShowBestReviewsModal(true)}>
              <Trophy size={16} />
              <span className="d-none d-lg-inline">{appLanguage === 'pt' ? 'Melhores Críticas' : 'Top Reviews'}</span>
            </button>
            <button 
              className="btn btn-outline-info btn-sm d-flex align-items-center gap-1" 
              onClick={() => setShowMcpModal(true)}
              title="Model Context Protocol & Google Connected Apps Platform"
            >
              <Cpu size={16} />
              <span className="d-none d-lg-inline">MCP / Connected Apps</span>
            </button>
            
            {user?.email === 'liclopes@gmail.com' && (
              <button 
                className="btn btn-outline-danger btn-sm d-flex align-items-center gap-1" 
                onClick={() => setShowAdminDeleteModal(true)}
                title="Painel Admin - Excluir Produções"
              >
                <Trash2 size={16} />
                <span className="d-none d-lg-inline">Admin</span>
              </button>
            )}

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
          {isLoading ? (
            <div className="row row-cols-5 row-cols-sm-6 row-cols-md-8 row-cols-lg-10 row-cols-xl-12 g-2">
              {[...Array(24)].map((_, i) => <SkeletonCard key={i} />)}
            </div>
          ) : databaseMovies.length === 0 ? (
             <div className="text-center py-5 my-5 animate-in">
              <MotionClapperboard 
                size={64} 
                className="text-danger mb-4 opacity-75 mx-auto"
                animate={{ 
                  rotate: [0, -20, 0, 0, 360, 360, -5, 5, -5, 5, 0],
                  scale: [1, 1.1, 1, 1.3, 1, 1, 1, 1.1, 1, 1.1, 1]
                }}
                transition={{ 
                  duration: 10, 
                  repeat: Infinity,
                  ease: "easeInOut",
                  times: [0, 0.1, 0.2, 0.3, 0.5, 0.6, 0.7, 0.75, 0.8, 0.85, 1]
                }}
              />
              <h2 className="fw-bold mb-3">Banco de Dados Off-line ou Vazio</h2>
              <p className="text-secondary lead mx-auto" style={{ maxWidth: '600px' }}>
                Não foi possível conectar ao catálogo do Supabase. Verifique a chave Anon JWT e a URL do projeto.
              </p>
              <button className="btn btn-danger mt-3" onClick={refreshData}>Tentar Novamente</button>
            </div>
          ) : !isFiltering ? (
            <div className="text-center py-5 my-5 animate-in old-film-bg">
              <div className="old-film-scratch"></div>
              <div className="old-film-scratch-2"></div>
              <div className="old-film-content">
                <MotionClapperboard 
                  size={64} 
                  className="text-danger mb-4 opacity-75 mx-auto"
                  animate={{ 
                    rotate: [0, -20, 0, 0, 360, 360, -5, 5, -5, 5, 0],
                    scale: [1, 1.1, 1, 1.3, 1, 1, 1, 1.1, 1, 1.1, 1]
                  }}
                  transition={{ 
                    duration: 10, 
                    repeat: Infinity,
                    ease: "easeInOut",
                    times: [0, 0.1, 0.2, 0.3, 0.5, 0.6, 0.7, 0.75, 0.8, 0.85, 1]
                  }}
                />
                <h2 className="fw-bold mb-3">{t.welcomeTitle || "Welcome to ClassicFlix"}</h2>
                <p className="text-secondary lead mx-auto" style={{ maxWidth: '600px' }}>
                  {t.welcomeText || "Explore the golden age of cinema in public domain. To start, use the search bar or pick a filter."}
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="d-flex justify-content-between align-items-center mb-4 px-1 animate-in">
                  <span className="text-white-50 d-flex align-items-center gap-2">
                     <CheckCircle size={16} className="text-success" />
                     {t.foundVideos.replace('{count}', filteredMovies.length.toString())}
                  </span>
                  
                  {filteredMovies.length > 0 && (
                      <button 
                        className="btn btn-sm btn-outline-light d-flex align-items-center gap-2" 
                        onClick={handleExportPDF}
                        disabled={isExporting}
                      >
                         {isExporting ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
                         {isExporting ? t.downloading : t.exportPdf}
                      </button>
                  )}
              </div>

              {/* GRID ATUALIZADO: 5 (XS), 6 (SM), 8 (MD), 10 (LG), 12 (XL/XXL) */}
              <motion.div 
                key={filters.searchQuery + filters.selectedGenre + filters.selectedLanguage + filters.selectedYear + filters.selectedDecade + filters.selectedRating + filters.selectedColor + filters.selectedTheme + filters.selectedDuration + filters.hasSubtitles + filters.selectedDirector + filters.selectedAward + filters.hasPosterOnly + filters.hasVideoOnly + filters.selectedTop30}
                initial="hidden"
                animate="visible"
                variants={{
                  hidden: { opacity: 0 },
                  visible: {
                    opacity: 1,
                    transition: {
                      staggerChildren: 0.05
                    }
                  }
                }}
                className="row row-cols-5 row-cols-sm-6 row-cols-md-8 row-cols-lg-10 row-cols-xl-12 g-2"
              >
                {displayedMovies.map(movie => (
                  <MovieCard 
                    key={movie.id} 
                    movie={movie} 
                    state={getState(movie.id)} 
                    onOpen={() => handleMovieOpen(movie)} 
                    viewMode={viewMode} 
                    onPosterFound={handlePosterFound}
                  />
                ))}
              </motion.div>
              {visibleCount < filteredMovies.length && (
                <div className="text-center mt-5 mb-3">
                  <button className="btn btn-outline-light px-5 py-2" onClick={() => setVisibleCount(v => v + 48)}><ChevronDown size={20} /> {t.loadMore || "Load More"}</button>
                </div>
              )}
              {filteredMovies.length === 0 && <div className="text-center py-5 opacity-50"><Film size={48} className="mb-3 mx-auto" /><h5>{t.noTitlesFound || "No titles found."}</h5></div>}
            </>
          )}
        </div>
      </main>
      <footer className="bg-surface border-top border-secondary p-5 mt-5 text-center shadow">
        <h5 className="fw-bold mb-3 text-danger">LIBRARY CLASSICFLIX</h5>
        <p className="text-secondary small mb-2">{t.footerText}</p>
        <p className="text-white-50 small m-0 fw-bold">{t.totalMovies}: {databaseMovies.length}</p>
      </footer>
      
      <AiConcierge catalog={databaseMovies} language={appLanguage} />

      {/* Floating Mini Games Button */}
      {!showMiniGamesModal && (
        <button 
          onClick={() => setShowMiniGamesModal(true)}
          className="position-fixed bg-transparent border-0 text-white hover-scale p-0 d-flex align-items-center justify-content-center"
          style={{ bottom: '100px', right: '1.5rem', zIndex: 9998, filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.5))' }}
          title="Mini Jogos"
        >
          <Gamepad2 size={42} />
        </button>
      )}

      <TimelineModal isOpen={showTimelineModal} onClose={() => setShowTimelineModal(false)} movies={databaseMovies} language={appLanguage} />
      <VideoConverter isOpen={showConverterModal} onClose={() => setShowConverterModal(false)} language={appLanguage} />
      <GoogleDriveModal isOpen={showDriveModal} onClose={() => setShowDriveModal(false)} appLanguage={appLanguage} />
      
      {showEmojiGame && (
        <EmojiGame 
          movies={databaseMovies} 
          onClose={() => setShowEmojiGame(false)} 
          currentUser={user}
          onOpenLogin={() => {
            setShowEmojiGame(false);
            setShowAuthModal(true);
          }}
        />
      )}

      {showMosaicGame && (
        <MosaicGame 
          onClose={() => setShowMosaicGame(false)} 
          currentUser={user}
          onOpenLogin={() => {
            setShowMosaicGame(false);
            setShowAuthModal(true);
          }}
          onMoreInfo={(title) => {
            if (!title) return;
            // Find the movie in databaseMovies by matching the title (ignoring year in parentheses if needed)
            const cleanTitle = title.split(' (')[0].toLowerCase();
            const movie = databaseMovies.find(m => {
              const matchTitle = m.title ? m.title.toLowerCase().includes(cleanTitle) : false;
              const matchTitlePt = m.titlePt ? m.titlePt.toLowerCase().includes(cleanTitle) : false;
              return matchTitle || matchTitlePt;
            });
            
            if (movie) {
              setShowMosaicGame(false);
              handleMovieOpen(movie);
            } else {
              alert('Filme não encontrado no banco de dados.');
            }
          }}
        />
      )}

      {showAdminDeleteModal && user?.email === 'liclopes@gmail.com' && (
        <AdminDeleteModal 
          movies={databaseMovies} 
          currentUserEmail={user.email} 
          onClose={() => setShowAdminDeleteModal(false)} 
          onRefresh={refreshData} 
        />
      )}

      {/* Floating button for Galaxy View */}
      <button
        className="btn btn-dark position-fixed rounded-circle shadow-lg d-flex align-items-center justify-content-center p-3 border border-secondary"
        style={{ left: '20px', bottom: '100px', zIndex: 1040, width: '60px', height: '60px' }}
        onClick={() => setShowGalaxyView(true)}
        title={t.galaxyOfDirectors || "Galáxia de Diretores"}
      >
        <Orbit size={28} className="text-info" />
      </button>

      {showGalaxyView && (
        <GalaxyView 
          movies={databaseMovies} 
          onMovieClick={(movie) => {
            setShowGalaxyView(false);
            handleMovieOpen(movie);
          }}
          onClose={() => setShowGalaxyView(false)}
          t={t}
        />
      )}

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
        showLeaderboardModal={showLeaderboardModal}
        setShowLeaderboardModal={setShowLeaderboardModal}
        isUserLoggedIn={!!user}
        currentUser={user}
        authMode={authMode} 
        setAuthMode={setAuthMode} 
        authUsername={authUsername} 
        setAuthUsername={setAuthUsername} 
        authPassword={authPassword} 
        setAuthPassword={setAuthPassword} 
        handleAuth={handleAuth} 
        handleGoogleAuth={handleGoogleAuth}
        authLoading={authLoading} 
        authError={authError}
        setAuthError={setAuthError}
        onRefresh={refreshData} 
        t={t} 
        onFilterDirector={(director) => {
          setFilters(prev => ({ ...prev, selectedDirector: director }));
          setSelectedMovie(null); // Fecha o modal de detalhes
        }}
      />
      <AdedonhaGame isOpen={showAdedonhaGame} onClose={() => setShowAdedonhaGame(false)} currentUser={user} />
      
      {showNosferatuGame && (
        <NosferatuGame 
          onClose={() => setShowNosferatuGame(false)} 
          currentUser={user}
          onOpenLogin={() => {
            setShowNosferatuGame(false);
            setShowAuthModal(true);
          }}
        />
      )}

      <MiniGamesModal 
        isOpen={showMiniGamesModal} 
        onClose={() => setShowMiniGamesModal(false)}
        onOpenEmoji={() => setShowEmojiGame(true)}
        onOpenMosaic={() => setShowMosaicGame(true)}
        onOpenAdedonha={() => setShowAdedonhaGame(true)}
        onOpenRanking={() => setShowLeaderboardModal(true)}
        onOpenNosferatu={() => setShowNosferatuGame(true)}
      />

      <BestReviewsModal 
        isOpen={showBestReviewsModal} 
        onClose={() => setShowBestReviewsModal(false)} 
        movies={databaseMovies} 
        language={appLanguage} 
        onSelectMovie={(m) => setSelectedMovie(m)} 
      />

      <McpConnectedAppsModal 
        isOpen={showMcpModal} 
        onClose={() => setShowMcpModal(false)} 
        appLanguage={appLanguage} 
        moviesList={databaseMovies} 
      />
    </div>
  );
}
