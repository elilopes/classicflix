import React from 'react';
import { motion } from 'motion/react';
import {
  Search,
  Film,
  User,
  LogOut,
  Loader2,
  Plus,
  RefreshCw,
  ChevronDown,
  Clapperboard,
  Globe,
  TrendingUp,
  FileText,
  CheckCircle,
  X,
  History,
  ShieldAlert,
  Orbit,
  Trophy,
  Cpu,
  Heart,
  Clock,
  Sparkles,
  Gamepad2,
} from 'lucide-react';
import { AppLanguage, FilterState, Movie, UserMovieInteraction } from '../types';
import { FilterBar } from './FilterBar';
import { MovieCard, SkeletonCard } from './MovieCard';
import { AiConcierge } from './AiConcierge';
import { UserListTab } from './UserListsModal';

/**
 * ============================================================================
 * CONFIGURAÇÕES RÁPIDAS DA INTERFACE INICIAL
 * Edite este bloco para alterar marca, idiomas disponíveis, e-mail admin,
 * quantidade de skeletons e textos padrão sem precisar mexer na lógica do App.
 * ============================================================================
 */
export const HOME_UI_CONFIG = {
  brandName: 'CLASSICFLIX',
  footerBrandName: 'LIBRARY CLASSICFLIX',
  adminEmail: 'liclopes@gmail.com',
  skeletonCount: 24,
  loadMoreBatchSize: 48,
  languages: [
    { code: 'en' as AppLanguage, label: '🇺🇸 English' },
    { code: 'pt' as AppLanguage, label: '🇧🇷 Português' },
    { code: 'it' as AppLanguage, label: '🇮🇹 Italiano' },
    { code: 'hi' as AppLanguage, label: '🇮🇳 हिन्दी' },
    { code: 'ru' as AppLanguage, label: '🇷🇺 Русский' },
    { code: 'zh' as AppLanguage, label: '🇨🇳 中文' },
  ],
};

const MotionClapperboard = motion(Clapperboard);

export interface HomeInterfaceProps {
  appLanguage: AppLanguage;
  setAppLanguage: (lang: AppLanguage) => void;
  t: any;

  filters: FilterState;
  setFilters: React.Dispatch<React.SetStateAction<FilterState>>;
  onResetFilters: () => void;
  isFiltering: boolean;

  isLoading: boolean;
  databaseMovies: Movie[];
  filteredMovies: Movie[];
  displayedMovies: Movie[];
  mostPopularMovies: Movie[];
  visibleCount: number;
  onLoadMore: () => void;

  viewMode: 'image' | 'text';
  setViewMode: (mode: 'image' | 'text') => void;
  uniqueDirectors: string[];
  uniqueAwards: string[];
  stats: {
    lang: Record<string, number>;
    gen: Record<string, number>;
    th: Record<string, number>;
  };

  getState: (movieIdOrWikidataId: string) => UserMovieInteraction;
  onOpenMovie: (movie: Movie) => void;
  onPosterFound: (id: string, url: string) => void;
  onRefreshData: () => void;

  isExporting: boolean;
  onExportPDF: () => void;

  // Pesquisa com IA
  aiMatchedIds: string[] | null;
  aiSearchReasoning: string | null;
  aiSearchError: string | null;
  isAiSearching: boolean;
  onAiCatalogSearch: () => void;
  onClearAiSearch: () => void;
  onDismissAiError: () => void;

  // Refs e estados de menus/sugestões
  showSuggestions: boolean;
  setShowSuggestions: React.Dispatch<React.SetStateAction<boolean>>;
  isLangMenuOpen: boolean;
  setIsLangMenuOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isUserMenuOpen: boolean;
  setIsUserMenuOpen: React.Dispatch<React.SetStateAction<boolean>>;
  searchContainerRef: React.RefObject<HTMLDivElement | null>;
  langMenuRef: React.RefObject<HTMLDivElement | null>;
  userMenuRef: React.RefObject<HTMLDivElement | null>;

  // Usuário e Listas
  user: any;
  interactions: UserMovieInteraction[];
  onOpenAuth: () => void;
  onLogout: () => Promise<void> | void;

  // Ações da barra e modais da tela inicial
  onOpenTimeline: () => void;
  onOpenConverter: () => void;
  onOpenBestReviews: () => void;
  onOpenAddMovie: () => void;
  onOpenMcp: () => void;
  onOpenAdmin: () => void;
  onOpenUserLists: (tab: UserListTab) => void;
  onOpenMiniGames: () => void;
  onOpenGalaxyView: () => void;
  showMiniGamesModal: boolean;
}

/**
 * 1. CABEÇALHO / NAVBAR (Logo, Busca + IA, Idiomas, Ações Rápidas, Menu do Usuário)
 */
export const HomeNavbar: React.FC<HomeInterfaceProps> = ({
  appLanguage,
  setAppLanguage,
  t,
  filters,
  setFilters,
  onResetFilters,
  mostPopularMovies,
  onOpenMovie,
  onRefreshData,
  aiMatchedIds,
  isAiSearching,
  onAiCatalogSearch,
  onClearAiSearch,
  showSuggestions,
  setShowSuggestions,
  isLangMenuOpen,
  setIsLangMenuOpen,
  isUserMenuOpen,
  setIsUserMenuOpen,
  searchContainerRef,
  langMenuRef,
  userMenuRef,
  user,
  interactions,
  onOpenAuth,
  onLogout,
  onOpenTimeline,
  onOpenConverter,
  onOpenBestReviews,
  onOpenAddMovie,
  onOpenMcp,
  onOpenAdmin,
  onOpenUserLists,
}) => {
  return (
    <nav
      className="navbar navbar-expand-lg navbar-dark bg-surface sticky-top border-bottom border-secondary px-3 shadow"
      style={{ zIndex: 1020 }}
    >
      <div className="container-fluid">
        {/* Marca / Logo */}
        <a
          className="navbar-brand fw-bold text-danger d-flex align-items-center gap-2"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            onResetFilters();
          }}
        >
          <Film size={26} /> <span>{HOME_UI_CONFIG.brandName}</span>
        </a>

        {/* Barra de Pesquisa + Botão IA + Sugestões Mais Populares */}
        <div className="d-flex flex-grow-1 mx-4 max-w-lg position-relative" ref={searchContainerRef}>
          <div className="input-group">
            <div className="position-relative flex-grow-1">
              <input
                className="form-control bg-dark text-white border-secondary rounded-start ps-4 pe-5 shadow-sm"
                placeholder={t.searchPlaceholder}
                value={filters.searchQuery}
                onChange={(e) => {
                  setFilters({ ...filters, searchQuery: e.target.value });
                  onClearAiSearch();
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && filters.searchQuery.trim()) {
                    setShowSuggestions(false);
                  }
                }}
                onFocus={() => setShowSuggestions(true)}
              />
              <div className="position-absolute end-0 top-50 translate-middle-y d-flex align-items-center gap-2 me-3">
                {filters.searchQuery && (
                  <button
                    type="button"
                    className="btn btn-link p-0 text-secondary hover-white border-0 shadow-none d-flex align-items-center"
                    onClick={() => {
                      setFilters({ ...filters, searchQuery: '' });
                      onClearAiSearch();
                    }}
                    title={t.clearSearch || 'Clear search'}
                  >
                    <X size={18} />
                  </button>
                )}
                <Search className="text-secondary" size={18} />
              </div>
            </div>

            <button
              type="button"
              className={`btn btn-sm d-flex align-items-center gap-1 fw-bold px-3 border-secondary ${
                aiMatchedIds !== null ? 'btn-warning text-dark' : 'btn-outline-warning'
              }`}
              onClick={onAiCatalogSearch}
              disabled={isAiSearching || !filters.searchQuery.trim()}
              title={t.aiSearchTooltip || 'Semantic search with Gemini AI'}
            >
              {isAiSearching ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
              <span>{t.aiSearchBtn || 'IA'}</span>
            </button>
          </div>

          {showSuggestions && !filters.searchQuery && mostPopularMovies.length > 0 && (
            <div
              className="position-absolute top-100 start-0 w-100 bg-dark border border-secondary rounded-bottom shadow-lg mt-1"
              style={{ zIndex: 1500 }}
            >
              <h6 className="px-3 py-2 m-0 text-white-50 small border-bottom border-secondary fw-bold d-flex align-items-center gap-2">
                <TrendingUp size={14} className="text-danger" /> {t.mostPopular || 'Most Popular'}
              </h6>
              <div className="list-group list-group-flush">
                {mostPopularMovies.map((movie) => (
                  <button
                    key={movie.id}
                    className="list-group-item list-group-item-action bg-dark text-white border-0 d-flex gap-2 align-items-center py-2"
                    onClick={() => onOpenMovie(movie)}
                  >
                    <div
                      style={{
                        width: '30px',
                        height: '45px',
                        background: '#333',
                        backgroundImage: `url(${movie.posterUrl})`,
                        backgroundSize: 'cover',
                      }}
                      className="rounded"
                    />
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

        {/* Controles à direita: Idioma, Botões Principais e Menu do Usuário */}
        <div className="d-flex gap-2 align-items-center flex-nowrap py-1" style={{ maxWidth: '100%' }}>
          {/* Seletor de Idioma */}
          <div className="position-relative flex-shrink-0" ref={langMenuRef}>
            <button
              type="button"
              className="btn btn-dark btn-sm dropdown-toggle border-secondary d-flex align-items-center gap-2"
              onClick={() => setIsLangMenuOpen((prev) => !prev)}
              aria-expanded={isLangMenuOpen}
            >
              <Globe size={16} className="text-info" />{' '}
              <span className="d-none d-sm-inline">{appLanguage.toUpperCase()}</span>
            </button>
            {isLangMenuOpen && (
              <ul
                className="dropdown-menu dropdown-menu-dark dropdown-menu-end shadow-lg border-secondary show"
                style={{ position: 'absolute', right: 0, top: '100%', marginTop: '4px', zIndex: 2500 }}
              >
                {HOME_UI_CONFIG.languages.map((lang) => (
                  <li key={lang.code}>
                    <button
                      className={`dropdown-item py-2 ${appLanguage === lang.code ? 'active' : ''}`}
                      onClick={() => {
                        setAppLanguage(lang.code);
                        setIsLangMenuOpen(false);
                      }}
                    >
                      {lang.label}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Botões Visíveis da Barra Superior */}
          <div
            className="d-flex gap-2 align-items-center overflow-x-auto text-nowrap flex-nowrap no-scrollbar"
            style={{ WebkitOverflowScrolling: 'touch' }}
          >
            <button
              className="btn btn-outline-danger btn-sm d-flex align-items-center gap-1 flex-shrink-0"
              onClick={onOpenTimeline}
            >
              <History size={16} />
              <span className="d-none d-lg-inline">{t.timeline}</span>
            </button>

            <button
              className="btn btn-outline-warning btn-sm d-flex align-items-center gap-1 flex-shrink-0"
              onClick={onOpenConverter}
            >
              <RefreshCw size={16} />
              <span className="d-none d-lg-inline">{t.videoConverter || 'Converter'}</span>
            </button>

            <button
              className="btn btn-outline-warning btn-sm d-flex align-items-center gap-1 flex-shrink-0"
              onClick={onOpenBestReviews}
            >
              <Trophy size={16} />
              <span className="d-none d-lg-inline">{t.topReviews || 'Top Reviews'}</span>
            </button>

            <button
              className="btn btn-outline-primary btn-sm flex-shrink-0"
              onClick={onRefreshData}
              title={appLanguage === 'pt' ? 'Atualizar catálogo' : 'Refresh catalog'}
            >
              <RefreshCw size={16} />
            </button>
          </div>

          {/* Menu do Usuário / Botão de Login */}
          {user ? (
            <div className="position-relative flex-shrink-0" ref={userMenuRef}>
              <button
                type="button"
                className="btn btn-dark btn-sm dropdown-toggle border-secondary d-flex align-items-center gap-2"
                onClick={() => setIsUserMenuOpen((prev) => !prev)}
                aria-expanded={isUserMenuOpen}
              >
                {user.provider === 'wikipedia' ? (
                  <div
                    className="bg-white rounded-circle p-1 d-flex align-items-center justify-content-center"
                    style={{ width: '20px', height: '20px' }}
                  >
                    <img
                      src="https://upload.wikimedia.org/wikipedia/commons/6/63/Wikipedia-logo-en-big.png"
                      alt="Wikipedia"
                      style={{ width: '14px', height: '14px', objectFit: 'contain' }}
                    />
                  </div>
                ) : (
                  <User size={18} className="text-danger" />
                )}
                <span className="d-none d-sm-inline">
                  {user.displayName || user.email?.split('@')[0]}
                </span>
              </button>

              {isUserMenuOpen && (
                <ul
                  className="dropdown-menu dropdown-menu-dark dropdown-menu-end shadow-lg border-secondary show"
                  style={{
                    position: 'absolute',
                    right: 0,
                    top: '100%',
                    marginTop: '4px',
                    zIndex: 2500,
                    minWidth: '240px',
                  }}
                >
                  {user.provider === 'wikipedia' && (
                    <li className="px-3 py-2 border-bottom border-secondary small">
                      <div className="text-white-50 xsmall text-uppercase">
                        {appLanguage === 'pt' ? 'Conta Wikipedia' : 'Wikipedia Account'}
                      </div>
                      <div className="fw-bold text-info">@{user.displayName}</div>
                      {user.user_metadata?.edit_count !== undefined && (
                        <div className="text-white-50 xsmall">
                          {user.user_metadata.edit_count}{' '}
                          {appLanguage === 'pt' ? 'edições' : 'edits'}
                        </div>
                      )}
                    </li>
                  )}

                  <li>
                    <button
                      className="dropdown-item py-2 d-flex align-items-center gap-2 text-success"
                      onClick={() => {
                        onOpenAddMovie();
                        setIsUserMenuOpen(false);
                      }}
                    >
                      <Plus size={16} />
                      <span>{t.addMovie || 'Add Movie'}</span>
                    </button>
                  </li>

                  <li>
                    <button
                      className="dropdown-item py-2 d-flex align-items-center gap-2 text-info"
                      onClick={() => {
                        onOpenMcp();
                        setIsUserMenuOpen(false);
                      }}
                    >
                      <Cpu size={16} />
                      <span>MCP</span>
                    </button>
                  </li>

                  {user?.email === HOME_UI_CONFIG.adminEmail && (
                    <li>
                      <button
                        className="dropdown-item py-2 d-flex align-items-center gap-2 text-danger"
                        onClick={() => {
                          onOpenAdmin();
                          setIsUserMenuOpen(false);
                        }}
                      >
                        <ShieldAlert size={16} />
                        <span>Admin</span>
                      </button>
                    </li>
                  )}

                  <li>
                    <hr className="dropdown-divider border-secondary" />
                  </li>

                  <li>
                    <button
                      className="dropdown-item py-2 d-flex align-items-center justify-content-between gap-2"
                      onClick={() => {
                        onOpenUserLists('favorites');
                        setIsUserMenuOpen(false);
                      }}
                    >
                      <span className="d-flex align-items-center gap-2">
                        <Heart size={15} className="text-danger" fill="currentColor" />
                        <span>{t.favorites || 'Favoritos'}</span>
                      </span>
                      <span className="badge bg-danger rounded-pill">
                        {interactions.filter((i) => i.isfavorite).length}
                      </span>
                    </button>
                  </li>

                  <li>
                    <button
                      className="dropdown-item py-2 d-flex align-items-center justify-content-between gap-2"
                      onClick={() => {
                        onOpenUserLists('watchlater');
                        setIsUserMenuOpen(false);
                      }}
                    >
                      <span className="d-flex align-items-center gap-2">
                        <Clock size={15} className="text-primary" />
                        <span>{t.watchLater || 'Ver Depois'}</span>
                      </span>
                      <span className="badge bg-primary rounded-pill">
                        {interactions.filter((i) => i.watchlater || i.iswatchlist).length}
                      </span>
                    </button>
                  </li>

                  <li>
                    <button
                      className="dropdown-item py-2 d-flex align-items-center justify-content-between gap-2"
                      onClick={() => {
                        onOpenUserLists('watched');
                        setIsUserMenuOpen(false);
                      }}
                    >
                      <span className="d-flex align-items-center gap-2">
                        <CheckCircle size={15} className="text-success" />
                        <span>{t.alreadyWatched || 'Já Assistidos'}</span>
                      </span>
                      <span className="badge bg-success rounded-pill">
                        {interactions.filter((i) => i.iswatched).length}
                      </span>
                    </button>
                  </li>

                  <li>
                    <hr className="dropdown-divider border-secondary my-1" />
                  </li>

                  <li>
                    <button
                      className="dropdown-item py-2"
                      onClick={async () => {
                        setIsUserMenuOpen(false);
                        await onLogout();
                      }}
                    >
                      <LogOut size={16} className="me-2" /> {t.logout}
                    </button>
                  </li>
                </ul>
              )}
            </div>
          ) : (
            <button
              className="btn btn-danger btn-sm px-3 shadow flex-shrink-0"
              onClick={onOpenAuth}
            >
              {t.login}
            </button>
          )}
        </div>
      </div>
    </nav>
  );
};

/**
 * 2. TELA DE BOAS-VINDAS (Exibida quando nenhum filtro/busca está ativo)
 */
export const HomeWelcomeHero: React.FC<{ t: any }> = ({ t }) => (
  <div className="text-center py-5 my-5 animate-in old-film-bg">
    <div className="old-film-scratch"></div>
    <div className="old-film-scratch-2"></div>
    <div className="old-film-content">
      <MotionClapperboard
        size={64}
        className="text-danger mb-4 opacity-75 mx-auto"
        animate={{
          rotate: [0, -20, 0, 0, 360, 360, -5, 5, -5, 5, 0],
          scale: [1, 1.1, 1, 1.3, 1, 1, 1, 1.1, 1, 1.1, 1],
        }}
        transition={{
          duration: 10,
          repeat: Infinity,
          ease: 'easeInOut',
          times: [0, 0.1, 0.2, 0.3, 0.5, 0.6, 0.7, 0.75, 0.8, 0.85, 1],
        }}
      />
      <h2 className="fw-bold mb-3">{t.welcomeTitle || 'Welcome to ClassicFlix'}</h2>
      <p className="text-secondary lead mx-auto" style={{ maxWidth: '600px' }}>
        {t.welcomeText ||
          'Explore the golden age of cinema in public domain. To start, use the search bar or pick a filter.'}
      </p>
    </div>
  </div>
);

/**
 * 3. ESTADO OFFLINE / BANCO VAZIO
 */
export const HomeOfflineState: React.FC<{ onRetry: () => void }> = ({ onRetry }) => (
  <div className="text-center py-5 my-5 animate-in">
    <MotionClapperboard
      size={64}
      className="text-danger mb-4 opacity-75 mx-auto"
      animate={{
        rotate: [0, -20, 0, 0, 360, 360, -5, 5, -5, 5, 0],
        scale: [1, 1.1, 1, 1.3, 1, 1, 1, 1.1, 1, 1.1, 1],
      }}
      transition={{
        duration: 10,
        repeat: Infinity,
        ease: 'easeInOut',
        times: [0, 0.1, 0.2, 0.3, 0.5, 0.6, 0.7, 0.75, 0.8, 0.85, 1],
      }}
    />
    <h2 className="fw-bold mb-3">Banco de Dados Off-line ou Vazio</h2>
    <p className="text-secondary lead mx-auto" style={{ maxWidth: '600px' }}>
      Não foi possível conectar ao catálogo do Supabase. Verifique a chave Anon JWT e a URL do
      projeto.
    </p>
    <button className="btn btn-danger mt-3" onClick={onRetry}>
      Tentar Novamente
    </button>
  </div>
);

/**
 * 4. CATÁLOGO / GRADE DE PRODUÇÕES E AVISOS DE BUSCA IA
 */
export const HomeCatalogSection: React.FC<HomeInterfaceProps> = ({
  t,
  filters,
  filteredMovies,
  displayedMovies,
  visibleCount,
  onLoadMore,
  viewMode,
  getState,
  onOpenMovie,
  onPosterFound,
  isExporting,
  onExportPDF,
  aiMatchedIds,
  aiSearchReasoning,
  aiSearchError,
  onClearAiSearch,
  onDismissAiError,
}) => {
  return (
    <>
      {aiSearchError && (
        <div className="alert alert-danger border-danger d-flex justify-content-between align-items-center py-2 px-3 mb-3">
          <span className="small">{aiSearchError}</span>
          <button
            type="button"
            className="btn-close btn-close-white btn-sm"
            onClick={onDismissAiError}
          ></button>
        </div>
      )}

      {aiMatchedIds !== null && (
        <div className="alert alert-warning bg-warning bg-opacity-10 border-warning text-white d-flex justify-content-between align-items-center gap-3 py-2 px-3 mb-3">
          <div className="d-flex align-items-center gap-2 small">
            <Sparkles size={16} className="text-warning flex-shrink-0" />
            <div>
              <strong className="text-warning me-2">{t.aiSearchResults || 'Busca IA'}:</strong>
              <span>{aiSearchReasoning || `${aiMatchedIds.length} resultados`}</span>
            </div>
          </div>
          <button
            type="button"
            className="btn btn-sm btn-outline-warning py-0 px-2 flex-shrink-0"
            onClick={onClearAiSearch}
          >
            {t.aiClearFilter || 'Limpar filtro IA'}
          </button>
        </div>
      )}

      <div className="d-flex justify-content-between align-items-center mb-4 px-1 animate-in">
        <span className="text-white-50 d-flex align-items-center gap-2">
          <CheckCircle size={16} className="text-success" />
          {t.foundVideos.replace('{count}', filteredMovies.length.toString())}
        </span>

        {filteredMovies.length > 0 && (
          <button
            className="btn btn-sm btn-outline-light d-flex align-items-center gap-2"
            onClick={onExportPDF}
            disabled={isExporting}
          >
            {isExporting ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
            {isExporting ? t.downloading : t.exportPdf}
          </button>
        )}
      </div>

      {/* GRID: 5 (XS), 6 (SM), 8 (MD), 10 (LG), 12 (XL/XXL) */}
      <motion.div
        key={
          filters.searchQuery +
          filters.selectedGenre +
          filters.selectedLanguage +
          filters.selectedYear +
          filters.selectedDecade +
          filters.selectedRating +
          filters.selectedColor +
          filters.selectedTheme +
          filters.selectedDuration +
          filters.hasSubtitles +
          filters.selectedDirector +
          filters.selectedAward +
          filters.hasPosterOnly +
          filters.hasVideoOnly +
          filters.selectedTop30 +
          filters.selectedType
        }
        initial="hidden"
        animate="visible"
        variants={{
          hidden: { opacity: 0 },
          visible: {
            opacity: 1,
            transition: { staggerChildren: 0.05 },
          },
        }}
        className="row row-cols-5 row-cols-sm-6 row-cols-md-8 row-cols-lg-10 row-cols-xl-12 g-2"
      >
        {displayedMovies.map((movie) => (
          <MovieCard
            key={movie.id}
            movie={movie}
            state={getState(movie.id)}
            onOpen={() => onOpenMovie(movie)}
            viewMode={viewMode}
            onPosterFound={onPosterFound}
          />
        ))}
      </motion.div>

      {visibleCount < filteredMovies.length && (
        <div className="text-center mt-5 mb-3">
          <button className="btn btn-outline-light px-5 py-2" onClick={onLoadMore}>
            <ChevronDown size={20} /> {t.loadMore || 'Load More'}
          </button>
        </div>
      )}

      {filteredMovies.length === 0 && (
        <div className="text-center py-5 opacity-50">
          <Film size={48} className="mb-3 mx-auto" />
          <h5>{t.noTitlesFound || 'No titles found.'}</h5>
        </div>
      )}
    </>
  );
};

/**
 * 5. RODAPÉ DA INTERFACE INICIAL
 */
export const HomeFooter: React.FC<{ t: any; databaseMovies: Movie[] }> = ({
  t,
  databaseMovies,
}) => {
  const posterCount = databaseMovies.filter(
    (m) =>
      m.posterUrl &&
      !m.posterUrl.includes('placehold.co') &&
      !m.posterUrl.includes('ui-avatars.com')
  ).length;

  return (
    <footer className="bg-surface border-top border-secondary p-5 mt-5 text-center shadow">
      <h5 className="fw-bold mb-3 text-danger">{HOME_UI_CONFIG.footerBrandName}</h5>
      <p className="text-secondary small mb-2">{t.footerText}</p>
      <p className="text-white-50 small m-0 fw-bold">
        {t.totalMovies}: {databaseMovies.length} | {t.postersMovies || "Poster's Movies"}:{' '}
        {posterCount}
      </p>
    </footer>
  );
};

/**
 * 6. BOTÕES FLUTUANTES DA TELA INICIAL (Assistente IA, Mini Games, Galáxia 3D)
 */
export const HomeFloatingButtons: React.FC<{
  databaseMovies: Movie[];
  appLanguage: AppLanguage;
  t: any;
  showMiniGamesModal: boolean;
  onOpenMiniGames: () => void;
  onOpenGalaxyView: () => void;
}> = ({
  databaseMovies,
  appLanguage,
  t,
  showMiniGamesModal,
  onOpenMiniGames,
  onOpenGalaxyView,
}) => (
  <>
    <AiConcierge catalog={databaseMovies} language={appLanguage} />

    {!showMiniGamesModal && (
      <button
        onClick={onOpenMiniGames}
        className="btn btn-dark position-fixed rounded-pill shadow-lg d-flex align-items-center gap-2 border border-success hover-scale side-collapsible-btn"
        style={{
          right: '16px',
          bottom: '90px',
          zIndex: 9998,
          padding: '8px 16px',
          boxShadow: '0 4px 20px rgba(40, 167, 69, 0.45)',
          background: 'rgba(10, 30, 20, 0.95)',
        }}
        title={t.miniGames || 'Mini Games'}
      >
        <Gamepad2 size={20} className="text-success flex-shrink-0" />
        <span className="fw-bold text-white small text-nowrap label-text">
          🎮 {t.miniGames || 'Mini Games'}
        </span>
      </button>
    )}

    <button
      className="btn btn-dark position-fixed rounded-pill shadow-lg d-flex align-items-center gap-2 border border-info hover-scale side-collapsible-btn"
      style={{
        left: '16px',
        bottom: '24px',
        zIndex: 9998,
        padding: '8px 16px',
        boxShadow: '0 4px 20px rgba(0, 200, 255, 0.45)',
        background: 'rgba(10, 15, 30, 0.95)',
      }}
      onClick={onOpenGalaxyView}
      title={t.galaxyOfDirectors || 'Galáxia de Diretores'}
      aria-label="Galáxia de Diretores"
    >
      <Orbit size={20} className="text-info flex-shrink-0" />
      <span className="fw-bold text-white small text-nowrap label-text">
        🌌 {t.galaxyOfDirectors || 'Galáxia 3D'}
      </span>
    </button>
  </>
);

/**
 * COMPONENTE PRINCIPAL DA INTERFACE INICIAL
 * Reúne Navbar + FilterBar + Área Central (Loading / Offline / Welcome / Catálogo) + Rodapé + Flutuantes.
 */
export const HomeInterface: React.FC<HomeInterfaceProps> = (props) => {
  const {
    appLanguage,
    t,
    filters,
    setFilters,
    isFiltering,
    isLoading,
    databaseMovies,
    viewMode,
    setViewMode,
    uniqueDirectors,
    uniqueAwards,
    stats,
    onRefreshData,
    showMiniGamesModal,
    onOpenMiniGames,
    onOpenGalaxyView,
  } = props;

  return (
    <>
      <HomeNavbar {...props} />

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
          languageCounts={stats.lang}
          genreCounts={stats.gen}
          themeCounts={stats.th}
        />

        <div className="container-fluid p-4">
          {isLoading ? (
            <div className="row row-cols-5 row-cols-sm-6 row-cols-md-8 row-cols-lg-10 row-cols-xl-12 g-2">
              {[...Array(HOME_UI_CONFIG.skeletonCount)].map((_, i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          ) : databaseMovies.length === 0 ? (
            <HomeOfflineState onRetry={onRefreshData} />
          ) : !isFiltering ? (
            <HomeWelcomeHero t={t} />
          ) : (
            <HomeCatalogSection {...props} />
          )}
        </div>
      </main>

      <HomeFooter t={t} databaseMovies={databaseMovies} />

      <HomeFloatingButtons
        databaseMovies={databaseMovies}
        appLanguage={appLanguage}
        t={t}
        showMiniGamesModal={showMiniGamesModal}
        onOpenMiniGames={onOpenMiniGames}
        onOpenGalaxyView={onOpenGalaxyView}
      />
    </>
  );
};
