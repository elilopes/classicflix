
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { DECADES, RATING_CATEGORIES, APP_TRANSLATIONS } from './constants';
import { Movie, FilterState, AppLanguage, UserMovieInteraction } from './types';
import { AppModals } from './components/AppModals';
import { ConvertPage } from './components/ConvertPage';
import { HomeInterface, HOME_UI_CONFIG } from './components/HomeInterface';
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

import { searchCatalogWithAI } from './services/geminiService';
import { GalaxyView } from './components/GalaxyView';
import { TimelineModal } from './components/TimelineModal';
import { AdminDeleteModal } from './components/AdminDeleteModal';
import EmojiGame from './components/EmojiGame';
import MosaicGame from './components/MosaicGame';
import { AdedonhaGame } from './components/AdedonhaGame';
import NosferatuGame from './components/NosferatuGame';
import { MiniGamesModal } from './components/MiniGamesModal';
import { BestReviewsModal } from './components/BestReviewsModal';
import { McpConnectedAppsModal } from './components/McpConnectedAppsModal';
import { WikipediaAuthModal } from './components/WikipediaAuthModal';
import { getWikipediaAuthUrl, saveWikipediaUser } from './services/wikipediaAuthService';
import { connectGoogleDrive, getGoogleDriveAccessToken } from './firebase';
import { UserListsModal, UserListTab } from './components/UserListsModal';

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
  const [showBestReviewsModal, setShowBestReviewsModal] = useState(false);
  const [showMcpModal, setShowMcpModal] = useState(false);
  const [showWikipediaModal, setShowWikipediaModal] = useState(false);
  const [wikipediaAuthData, setWikipediaAuthData] = useState<any>(null);
  const [showUserListsModal, setShowUserListsModal] = useState(false);
  const [userListsTab, setUserListsTab] = useState<UserListTab>('favorites');
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [authUsername, setAuthUsername] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');
  const [visibleCount, setVisibleCount] = useState(48);
  const [isExporting, setIsExporting] = useState(false);

  const [aiMatchedIds, setAiMatchedIds] = useState<string[] | null>(null);
  const [aiSearchReasoning, setAiSearchReasoning] = useState<string | null>(null);
  const [aiSearchError, setAiSearchError] = useState<string | null>(null);
  const [isAiSearching, setIsAiSearching] = useState(false);

  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isLangMenuOpen, setIsLangMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const langMenuRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

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
    selectedTop30: null,
    selectedType: null
  });

  const t = APP_TRANSLATIONS[appLanguage] || APP_TRANSLATIONS['en'];

  const [showGalaxyView, setShowGalaxyView] = useState(false);

  const isFiltering = useMemo(() => {
    return !!(aiMatchedIds !== null || filters.searchQuery || filters.selectedGenre || filters.selectedLanguage || filters.selectedYear || filters.selectedDecade || filters.selectedRating || filters.selectedColor || filters.selectedTheme || filters.selectedDuration || filters.hasSubtitles !== null || filters.selectedDirector || filters.selectedAward || filters.hasPosterOnly || filters.hasVideoOnly || filters.selectedTop30 || filters.selectedType);
  }, [filters, aiMatchedIds]);

  const handleAiCatalogSearch = async () => {
    const q = filters.searchQuery.trim();
    if (!q || isAiSearching) return;
    setIsAiSearching(true);
    setAiSearchError(null);
    setShowSuggestions(false);
    try {
      const result = await searchCatalogWithAI(q, databaseMovies);
      setAiMatchedIds(Array.isArray(result.matchedIds) ? result.matchedIds : []);
      setAiSearchReasoning(result.reasoning || null);
    } catch (err: any) {
      setAiSearchError(err?.message || 'Erro ao executar pesquisa com IA.');
      setAiMatchedIds(null);
      setAiSearchReasoning(null);
    } finally {
      setIsAiSearching(false);
    }
  };

  useEffect(() => { setVisibleCount(48); }, [filters]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
        if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
            setShowSuggestions(false);
        }
        if (langMenuRef.current && !langMenuRef.current.contains(event.target as Node)) {
            setIsLangMenuOpen(false);
        }
        if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
            setIsUserMenuOpen(false);
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
      if (user) {
        try {
          setInteractions(await getUserInteractions());
        } catch (interactionErr) {
          console.warn("Aviso ao carregar listas do usuário:", interactionErr);
        }
      }
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
        if (currentUser) {
          getUserInteractions()
            .then(setInteractions)
            .catch((err) => console.warn("Aviso ao carregar listas do usuário:", err));
        } else {
          setInteractions([]);
        }
    });

    const handleOAuthMessage = async (event: MessageEvent) => {
      const origin = event.origin;
      if (!origin.endsWith('.run.app') && !origin.includes('localhost') && origin !== window.location.origin) {
        return;
      }
      if (event.data?.type === 'WIKIPEDIA_AUTH_SUCCESS') {
        const wikiUser = event.data.user;
        if (wikiUser) {
          await saveWikipediaUser(wikiUser);
          setUser(wikiUser);
          setShowAuthModal(false);
          setShowWikipediaModal(false);
          refreshData();
        }
      } else if (event.data?.type === 'WIKIPEDIA_AUTH_ERROR') {
        setAuthError(event.data.error || 'Erro na autenticação da Wikipedia');
      }
    };

    window.addEventListener('message', handleOAuthMessage);
    return () => window.removeEventListener('message', handleOAuthMessage);
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
      const matchesSearch = aiMatchedIds !== null
        ? aiMatchedIds.includes(movie.id)
        : !filters.searchQuery || 
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
      const matchesType = !filters.selectedType || movie.type === filters.selectedType;
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
      return matchesSearch && matchesGenre && matchesLang && matchesYear && matchesDecade && matchesDirector && matchesTheme && matchesSubtitles && matchesAward && matchesRating && matchesDuration && matchesColor && matchesType;
    });
  }, [databaseMovies, filters, isFiltering, aiMatchedIds]);

  const displayedMovies = useMemo(() => filteredMovies.slice(0, visibleCount), [filteredMovies, visibleCount]);
  
  const getState = (movieIdOrWikidataId: string): UserMovieInteraction => {
      const movieObj = databaseMovies.find(m => m.id === movieIdOrWikidataId || m.wikidataId === movieIdOrWikidataId);
      const found = interactions.find(i =>
        i.wikidataid === movieIdOrWikidataId ||
        (movieObj?.wikidataId && i.wikidataid === movieObj.wikidataId) ||
        (movieObj?.id && i.wikidataid === movieObj.id)
      );
      return found || {
        wikidataid: movieObj?.wikidataId || movieIdOrWikidataId,
        isfavorite: false,
        iswatched: false,
        watchlater: false,
        iswatchlist: false,
        progress_seconds: 0
      };
  };

  const handlePosterFound = (id: string, url: string) => {
    setDatabaseMovies(prev => prev.map(m => m.id === id ? { ...m, posterUrl: url } : m));
  };

  const handleMovieOpen = (movie: Movie) => {
      setSelectedMovie(movie);
      incrementMoviePopularity(movie.id); 
      setShowSuggestions(false);
  };

  const toggleList = async (movieIdOrWikidataId: string, field: keyof UserMovieInteraction) => {
    if (!user) { setShowAuthModal(true); return; }
    const movieObj = databaseMovies.find(m => m.id === movieIdOrWikidataId || m.wikidataId === movieIdOrWikidataId);
    const targetKey = movieObj?.wikidataId || movieIdOrWikidataId;
    const normalizedField = field === 'iswatchlist' ? 'watchlater' : field;
    const existing = interactions.find(i =>
      i.wikidataid === targetKey ||
      (movieObj?.id && i.wikidataid === movieObj.id)
    );
    const currentVal = existing
      ? Boolean((existing as any)[normalizedField] ?? (normalizedField === 'watchlater' ? existing.iswatchlist : false))
      : false;
    const newValue = !currentVal;
    try {
      await updateInteraction(targetKey, { [normalizedField]: newValue });
      setInteractions(await getUserInteractions());
    } catch (err) {
      console.error("Erro ao salvar lista do usuário:", err);
    }
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

  const handleWikipediaAuth = async () => {
    setAuthLoading(true);
    setAuthError('');
    try {
      const authData = await getWikipediaAuthUrl();
      setWikipediaAuthData(authData);

      if (authData.configured && authData.url) {
        // Direct OAuth popup following SKILL.md
        const width = 650;
        const height = 750;
        const left = window.screen.width / 2 - width / 2;
        const top = window.screen.height / 2 - height / 2;
        const popup = window.open(
          authData.url,
          'wikipedia_oauth_popup',
          `width=${width},height=${height},left=${left},top=${top},scrollbars=yes`
        );

        if (!popup) {
          alert(appLanguage === 'pt' 
            ? 'Por favor, habilite popups no seu navegador para conectar com a Wikipedia.' 
            : 'Please allow popups for this site to connect with Wikipedia.');
        }
      } else {
        // Show configuration / instant verification modal
        setShowAuthModal(false);
        setShowWikipediaModal(true);
      }
    } catch (err: any) {
      console.error("Wikipedia OAuth error:", err);
      setAuthError(err.message || 'Falha ao iniciar autenticação com a Wikipedia');
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

  const resetFilters = () => {
    setFilters({
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
      selectedTop30: null,
      selectedType: null
    });
    setAiMatchedIds(null);
    setAiSearchReasoning(null);
    setAiSearchError(null);
  };

  return (
    <div className="min-vh-100 bg-black text-white d-flex flex-column">
      <HomeInterface
        appLanguage={appLanguage}
        setAppLanguage={setAppLanguage}
        t={t}
        filters={filters}
        setFilters={setFilters}
        onResetFilters={resetFilters}
        isFiltering={isFiltering}
        isLoading={isLoading}
        databaseMovies={databaseMovies}
        filteredMovies={filteredMovies}
        displayedMovies={displayedMovies}
        mostPopularMovies={mostPopularMovies}
        visibleCount={visibleCount}
        onLoadMore={() => setVisibleCount(v => v + HOME_UI_CONFIG.loadMoreBatchSize)}
        viewMode={viewMode}
        setViewMode={setViewMode}
        uniqueDirectors={uniqueDirectors}
        uniqueAwards={uniqueAwards}
        stats={stats}
        getState={getState}
        onOpenMovie={handleMovieOpen}
        onPosterFound={handlePosterFound}
        onRefreshData={refreshData}
        isExporting={isExporting}
        onExportPDF={handleExportPDF}
        aiMatchedIds={aiMatchedIds}
        aiSearchReasoning={aiSearchReasoning}
        aiSearchError={aiSearchError}
        isAiSearching={isAiSearching}
        onAiCatalogSearch={handleAiCatalogSearch}
        onClearAiSearch={() => {
          setAiMatchedIds(null);
          setAiSearchReasoning(null);
          setAiSearchError(null);
        }}
        onDismissAiError={() => setAiSearchError(null)}
        showSuggestions={showSuggestions}
        setShowSuggestions={setShowSuggestions}
        isLangMenuOpen={isLangMenuOpen}
        setIsLangMenuOpen={setIsLangMenuOpen}
        isUserMenuOpen={isUserMenuOpen}
        setIsUserMenuOpen={setIsUserMenuOpen}
        searchContainerRef={searchContainerRef}
        langMenuRef={langMenuRef}
        userMenuRef={userMenuRef}
        user={user}
        interactions={interactions}
        onOpenAuth={() => setShowAuthModal(true)}
        onLogout={async () => {
          await signOutUser();
          setUser(null);
          setInteractions([]);
        }}
        onOpenTimeline={() => setShowTimelineModal(true)}
        onOpenConverter={() => setShowConverterModal(true)}
        onOpenBestReviews={() => setShowBestReviewsModal(true)}
        onOpenAddMovie={() => setShowAddModal(true)}
        onOpenMcp={() => setShowMcpModal(true)}
        onOpenAdmin={() => {
          setShowAdminDeleteModal(true);
          if (!getGoogleDriveAccessToken()) {
            void connectGoogleDrive().catch(() => {});
          }
        }}
        onOpenUserLists={(tab) => {
          setUserListsTab(tab);
          setShowUserListsModal(true);
        }}
        onOpenMiniGames={() => setShowMiniGamesModal(true)}
        onOpenGalaxyView={() => setShowGalaxyView(true)}
        showMiniGamesModal={showMiniGamesModal}
      />

      <TimelineModal isOpen={showTimelineModal} onClose={() => setShowTimelineModal(false)} movies={databaseMovies} language={appLanguage} />
      {showConverterModal && <ConvertPage onClose={() => setShowConverterModal(false)} language={appLanguage} />}
      
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
          language={appLanguage}
        />
      )}

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
        handleWikipediaAuth={handleWikipediaAuth}
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
        onOpenGalaxy={() => setShowGalaxyView(true)}
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

      <WikipediaAuthModal 
        isOpen={showWikipediaModal}
        onClose={() => setShowWikipediaModal(false)}
        onSuccess={(wikiUser) => {
          setUser(wikiUser);
          refreshData();
        }}
        appLanguage={appLanguage}
        authUrlData={wikipediaAuthData}
      />

      <UserListsModal
        isOpen={showUserListsModal}
        onClose={() => setShowUserListsModal(false)}
        initialTab={userListsTab}
        interactions={interactions}
        movies={databaseMovies}
        onSelectMovie={(movie) => handleMovieOpen(movie)}
        onToggleInteraction={toggleList}
        onRefreshLists={async () => {
          if (user) {
            setInteractions(await getUserInteractions());
          }
        }}
        t={t}
        language={appLanguage}
      />
    </div>
  );
}
