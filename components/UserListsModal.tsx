import React, { useState, useMemo, useEffect } from 'react';
import { X, Heart, Clock, CheckCircle, Search, Film, RefreshCw, Play, Trash2 } from 'lucide-react';
import { Movie, UserMovieInteraction, AppLanguage } from '../types';

export type UserListTab = 'favorites' | 'watchlater' | 'watched';

interface UserListsModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab: UserListTab;
  interactions: UserMovieInteraction[];
  movies: Movie[];
  onSelectMovie: (movie: Movie) => void;
  onToggleInteraction: (wikidataId: string, field: keyof UserMovieInteraction) => Promise<void> | void;
  onRefreshLists?: () => Promise<void> | void;
  t: any;
  language: AppLanguage;
}

export const UserListsModal: React.FC<UserListsModalProps> = ({
  isOpen,
  onClose,
  initialTab,
  interactions,
  movies,
  onSelectMovie,
  onToggleInteraction,
  onRefreshLists,
  t,
  language,
}) => {
  const [activeTab, setActiveTab] = useState<UserListTab>(initialTab);
  const [searchTerm, setSearchTerm] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      setSearchTerm('');
    }
  }, [isOpen, initialTab]);

  const favorites = useMemo(
    () => interactions.filter((i) => i.isfavorite),
    [interactions]
  );
  const watchLaterList = useMemo(
    () => interactions.filter((i) => i.watchlater || i.iswatchlist),
    [interactions]
  );
  const watchedList = useMemo(
    () => interactions.filter((i) => i.iswatched),
    [interactions]
  );

  const activeItems = useMemo(() => {
    const base =
      activeTab === 'favorites'
        ? favorites
        : activeTab === 'watchlater'
        ? watchLaterList
        : watchedList;

    const mapped = base
      .map((interaction) => {
        const movie = movies.find(
          (m) =>
            (m.wikidataId && m.wikidataId === interaction.wikidataid) ||
            m.id === interaction.wikidataid
        );
        return { interaction, movie };
      })
      .filter(({ movie, interaction }) => {
        if (!searchTerm.trim()) return true;
        const q = searchTerm.toLowerCase();
        if (!movie) return interaction.wikidataid.toLowerCase().includes(q);
        return (
          (movie.title || '').toLowerCase().includes(q) ||
          (movie.titlePt || '').toLowerCase().includes(q) ||
          (movie.director || '').toLowerCase().includes(q) ||
          String(movie.year || '').includes(q)
        );
      });

    return mapped;
  }, [activeTab, favorites, watchLaterList, watchedList, movies, searchTerm]);

  if (!isOpen) return null;

  const handleRefresh = async () => {
    if (!onRefreshLists || isRefreshing) return;
    setIsRefreshing(true);
    try {
      await onRefreshLists();
    } finally {
      setIsRefreshing(false);
    }
  };

  const toggleFieldForActiveTab: keyof UserMovieInteraction =
    activeTab === 'favorites'
      ? 'isfavorite'
      : activeTab === 'watchlater'
      ? 'watchlater'
      : 'iswatched';

  return (
    <div
      className="modal fade show d-block"
      style={{ backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 1050, backdropFilter: 'blur(6px)' }}
      onClick={onClose}
    >
      <div
        className="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-content bg-dark text-white border border-secondary shadow-lg">
          <div className="modal-header border-secondary bg-black bg-opacity-50 d-flex align-items-center justify-content-between">
            <div className="d-flex align-items-center gap-2">
              {activeTab === 'favorites' && <Heart size={22} className="text-danger" fill="currentColor" />}
              {activeTab === 'watchlater' && <Clock size={22} className="text-primary" />}
              {activeTab === 'watched' && <CheckCircle size={22} className="text-success" />}
              <h5 className="modal-title fw-bold mb-0">{t.myLists || 'Minhas Listas'}</h5>
            </div>
            <div className="d-flex align-items-center gap-2">
              {onRefreshLists && (
                <button
                  type="button"
                  className="btn btn-outline-secondary btn-sm d-flex align-items-center gap-1"
                  onClick={handleRefresh}
                  disabled={isRefreshing}
                  title={language === 'pt' ? 'Atualizar listas' : 'Refresh lists'}
                >
                  <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
                </button>
              )}
              <button type="button" className="btn-close btn-close-white shadow-none" onClick={onClose} />
            </div>
          </div>

          <div className="px-3 pt-3 border-bottom border-secondary bg-black bg-opacity-25">
            <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 pb-3">
              <ul className="nav nav-pills gap-2">
                <li className="nav-item">
                  <button
                    type="button"
                    className={`nav-link d-flex align-items-center gap-2 py-2 px-3 ${
                      activeTab === 'favorites'
                        ? 'active bg-danger text-white'
                        : 'bg-dark text-white-50 border border-secondary'
                    }`}
                    onClick={() => setActiveTab('favorites')}
                  >
                    <Heart size={15} fill={activeTab === 'favorites' ? 'currentColor' : 'none'} />
                    <span>{t.favorites || 'Favoritos'}</span>
                    <span className="badge bg-black bg-opacity-50 text-white">{favorites.length}</span>
                  </button>
                </li>
                <li className="nav-item">
                  <button
                    type="button"
                    className={`nav-link d-flex align-items-center gap-2 py-2 px-3 ${
                      activeTab === 'watchlater'
                        ? 'active bg-primary text-white'
                        : 'bg-dark text-white-50 border border-secondary'
                    }`}
                    onClick={() => setActiveTab('watchlater')}
                  >
                    <Clock size={15} />
                    <span>{t.watchLater || 'Ver Depois'}</span>
                    <span className="badge bg-black bg-opacity-50 text-white">{watchLaterList.length}</span>
                  </button>
                </li>
                <li className="nav-item">
                  <button
                    type="button"
                    className={`nav-link d-flex align-items-center gap-2 py-2 px-3 ${
                      activeTab === 'watched'
                        ? 'active bg-success text-white'
                        : 'bg-dark text-white-50 border border-secondary'
                    }`}
                    onClick={() => setActiveTab('watched')}
                  >
                    <CheckCircle size={15} />
                    <span>{t.alreadyWatched || 'Já Assistidos'}</span>
                    <span className="badge bg-black bg-opacity-50 text-white">{watchedList.length}</span>
                  </button>
                </li>
              </ul>

              <div className="position-relative" style={{ minWidth: '220px' }}>
                <Search
                  size={15}
                  className="text-secondary position-absolute top-50 start-0 translate-middle-y ms-3"
                />
                <input
                  type="text"
                  className="form-control form-control-sm bg-black text-white border-secondary ps-5 pe-4 shadow-none"
                  placeholder={t.filterInLists || 'Filtrar na lista...'}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                {searchTerm && (
                  <button
                    type="button"
                    className="btn btn-link p-0 text-secondary position-absolute top-50 end-0 translate-middle-y me-2"
                    onClick={() => setSearchTerm('')}
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="modal-body p-4 custom-scrollbar" style={{ minHeight: '360px' }}>
            {activeItems.length === 0 ? (
              <div className="text-center py-5 text-white-50">
                <Film size={48} className="mb-3 opacity-50 mx-auto" />
                <p className="mb-0 mx-auto" style={{ maxWidth: '460px' }}>
                  {t.emptyUserList || 'Nenhuma produção nesta lista ainda.'}
                </p>
              </div>
            ) : (
              <div className="row g-3">
                {activeItems.map(({ interaction, movie }) => {
                  const displayTitle = movie
                    ? (language === 'pt' && movie.titlePt ? movie.titlePt : movie.title)
                    : interaction.wikidataid;

                  return (
                    <div key={interaction.wikidataid} className="col-12 col-md-6 col-lg-4">
                      <div className="card bg-black bg-opacity-75 border border-secondary h-100 shadow-sm overflow-hidden">
                        <div className="d-flex h-100">
                          <div
                            className="flex-shrink-0 bg-secondary bg-opacity-25 position-relative"
                            style={{ width: '92px', minHeight: '134px', cursor: movie ? 'pointer' : 'default' }}
                            onClick={() => movie && onSelectMovie(movie)}
                          >
                            {movie?.posterUrl ? (
                              <img
                                src={movie.posterUrl}
                                alt={displayTitle}
                                className="w-100 h-100 object-fit-cover"
                                style={{ objectFit: 'cover' }}
                              />
                            ) : (
                              <div className="w-100 h-100 d-flex align-items-center justify-content-center text-secondary">
                                <Film size={28} />
                              </div>
                            )}
                          </div>

                          <div className="card-body p-3 d-flex flex-column justify-content-between min-w-0">
                            <div>
                              <h6
                                className="fw-bold text-white mb-1 text-truncate"
                                style={{ cursor: movie ? 'pointer' : 'default' }}
                                onClick={() => movie && onSelectMovie(movie)}
                                title={displayTitle}
                              >
                                {displayTitle}
                              </h6>
                              {movie ? (
                                <>
                                  <div className="text-white-50 xsmall mb-1">
                                    {movie.year || '—'} {movie.director && movie.director !== 'Unknown' ? `• ${movie.director}` : ''}
                                  </div>
                                  {movie.genres && movie.genres.length > 0 && (
                                    <div className="text-info xsmall text-truncate">
                                      {movie.genres.slice(0, 3).join(', ')}
                                    </div>
                                  )}
                                </>
                              ) : (
                                <div className="text-white-50 xsmall">Wikidata: {interaction.wikidataid}</div>
                              )}
                              {interaction.lastupdated && (
                                <div className="text-secondary mt-1" style={{ fontSize: '0.7rem' }}>
                                  {new Date(interaction.lastupdated).toLocaleDateString()}
                                </div>
                              )}
                            </div>

                            <div className="d-flex align-items-center justify-content-between gap-2 pt-2 mt-2 border-top border-secondary border-opacity-50">
                              <div className="d-flex align-items-center gap-1">
                                <button
                                  type="button"
                                  className={`btn btn-sm p-1 px-2 border-0 ${
                                    interaction.isfavorite ? 'btn-danger' : 'btn-outline-secondary text-white-50'
                                  }`}
                                  onClick={() => onToggleInteraction(interaction.wikidataid, 'isfavorite')}
                                  title={t.favTooltip || 'Favoritos'}
                                >
                                  <Heart size={13} fill={interaction.isfavorite ? 'currentColor' : 'none'} />
                                </button>
                                <button
                                  type="button"
                                  className={`btn btn-sm p-1 px-2 border-0 ${
                                    (interaction.watchlater || interaction.iswatchlist)
                                      ? 'btn-primary'
                                      : 'btn-outline-secondary text-white-50'
                                  }`}
                                  onClick={() => onToggleInteraction(interaction.wikidataid, 'watchlater')}
                                  title={t.watchLaterTooltip || 'Ver Depois'}
                                >
                                  <Clock size={13} />
                                </button>
                                <button
                                  type="button"
                                  className={`btn btn-sm p-1 px-2 border-0 ${
                                    interaction.iswatched ? 'btn-success' : 'btn-outline-secondary text-white-50'
                                  }`}
                                  onClick={() => onToggleInteraction(interaction.wikidataid, 'iswatched')}
                                  title={t.watchedTooltip || 'Já Assistidos'}
                                >
                                  <CheckCircle size={13} />
                                </button>
                              </div>

                              <div className="d-flex align-items-center gap-1">
                                {movie && (
                                  <button
                                    type="button"
                                    className="btn btn-sm btn-outline-light py-1 px-2 d-flex align-items-center gap-1"
                                    onClick={() => onSelectMovie(movie)}
                                    title={t.viewDetails || 'Ver Detalhes'}
                                  >
                                    <Play size={12} fill="currentColor" />
                                    <span className="xsmall">{t.moreInfo || 'Info'}</span>
                                  </button>
                                )}
                                <button
                                  type="button"
                                  className="btn btn-sm btn-outline-danger py-1 px-2"
                                  onClick={() => onToggleInteraction(interaction.wikidataid, toggleFieldForActiveTab)}
                                  title={t.removeFromList || 'Remover da lista'}
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
