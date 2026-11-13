import React, { useState, useMemo } from 'react';
import {
  ShieldAlert,
  Trash2,
  Search,
  CheckSquare,
  Square,
  Loader2,
  Tv,
  ShieldCheck,
  AlertTriangle,
  ExternalLink,
  Code2,
  Copy,
  Check,
  Download,
  PlusCircle,
  Video,
} from 'lucide-react';
import { Movie } from '../types';
import { addSupabaseMovie, deleteSupabaseMovies, upsertIdentifiers } from '../services/supabaseClient';
import {
  verifyCatalogTvSeriesPublicDomain,
  findPublicDomainTvSeries,
  searchPublicDomainProductionsInWikidata,
  buildPublicDomainProductionsSparql,
  PUBLIC_DOMAIN_TV_SERIES_SPARQL,
  TvSeriesCopyrightCheckResult,
  WikidataPublicDomainTvSeries,
  WikidataPublicDomainProduction,
  PublicDomainProductionCategory,
} from '../services/wikidataService';

interface AdminDeleteModalProps {
  movies: Movie[];
  currentUserEmail: string;
  onClose: () => void;
  onRefresh: () => void;
}

type AdminTab = 'delete' | 'tv_copyright' | 'pd_search';
type CatalogCheckScope = 'series_only' | 'all_qids';
type CatalogCheckFilter = 'all' | 'pd_series' | 'non_pd_series' | 'with_video';

export const AdminDeleteModal: React.FC<AdminDeleteModalProps> = ({
  movies,
  onClose,
  onRefresh,
}) => {
  const [activeTab, setActiveTab] = useState<AdminTab>('delete');

  // --- Tab 1: Excluir Produções ---
  const [titleSearch, setTitleSearch] = useState('');
  const [genreSearch, setGenreSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);

  // --- Tab 2: Verificação de Séries de TV em Domínio Público (Wikidata) ---
  const [checkScope, setCheckScope] = useState<CatalogCheckScope>('series_only');
  const [checkFilter, setCheckFilter] = useState<CatalogCheckFilter>('all');
  const [isCheckingCatalog, setIsCheckingCatalog] = useState(false);
  const [checkProgress, setCheckProgress] = useState<{ checked: number; total: number }>({
    checked: 0,
    total: 0,
  });
  const [catalogCheckResults, setCatalogCheckResults] = useState<TvSeriesCopyrightCheckResult[]>([]);
  const [hasRunCatalogCheck, setHasRunCatalogCheck] = useState(false);

  const [isFetchingWikidataSeries, setIsFetchingWikidataSeries] = useState(false);
  const [wikidataSeriesResults, setWikidataSeriesResults] = useState<WikidataPublicDomainTvSeries[]>([]);
  const [hasRunWikidataQuery, setHasRunWikidataQuery] = useState(false);
  const [onlyWithP1476, setOnlyWithP1476] = useState(false);
  const [onlyWithVideo, setOnlyWithVideo] = useState(false);
  const [onlyMissingInCatalog, setOnlyMissingInCatalog] = useState(false);
  const [importingQid, setImportingQid] = useState<string | null>(null);
  const [showSparqlScript, setShowSparqlScript] = useState(false);
  const [copiedSparql, setCopiedSparql] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'danger' | 'info'; text: string } | null>(null);

  // --- Tab 3: Pesquisa Domínio Público (Série TV / Curta Animação / Filme Documentário) ---
  const [pdSearchCategory, setPdSearchCategory] = useState<PublicDomainProductionCategory>('all');
  const [pdSearchLimit, setPdSearchLimit] = useState<number>(150);
  const [isSearchingPdProductions, setIsSearchingPdProductions] = useState(false);
  const [pdProductionsResults, setPdProductionsResults] = useState<WikidataPublicDomainProduction[]>([]);
  const [hasRunPdProductionsSearch, setHasRunPdProductionsSearch] = useState(false);
  const [pdSearchFilterText, setPdSearchFilterText] = useState('');
  const [pdOnlyWithP1476, setPdOnlyWithP1476] = useState(false);
  const [pdOnlyMissing, setPdOnlyMissing] = useState(false);
  const [showPdSparqlScript, setShowPdSparqlScript] = useState(false);
  const [copiedPdSparql, setCopiedPdSparql] = useState(false);

  const uniqueGenres = useMemo(() => {
    const genres = new Set<string>();
    movies.forEach((m) => {
      if (Array.isArray(m.genres)) {
        m.genres.forEach((g) => genres.add(g));
      } else if (m.genres) {
        genres.add(m.genres);
      }
    });
    return Array.from(genres).sort();
  }, [movies]);

  const existingQidSet = useMemo(() => {
    const set = new Set<string>();
    movies.forEach((m) => {
      if (m.wikidataId) set.add(m.wikidataId.trim().toUpperCase());
    });
    return set;
  }, [movies]);

  const seriesCandidatesInCatalog = useMemo(() => {
    return movies.filter((m) => {
      if (!m.wikidataId || !/^Q\d+$/i.test(m.wikidataId.trim())) return false;
      const typeLower = (m.type || '').toLowerCase();
      return (
        typeLower.includes('series') ||
        typeLower.includes('série') ||
        typeLower.includes('television') ||
        typeLower.includes('miniseries')
      );
    });
  }, [movies]);

  const allQidCandidatesInCatalog = useMemo(() => {
    return movies.filter((m) => m.wikidataId && /^Q\d+$/i.test(m.wikidataId.trim()));
  }, [movies]);

  const filteredMovies = useMemo(() => {
    if (!titleSearch.trim() && !genreSearch) return [];

    return movies.filter((movie) => {
      const matchTitle =
        titleSearch.trim() === '' ||
        (movie.title || movie.titlePt || '').toLowerCase().includes(titleSearch.toLowerCase());

      const movieGenresStr = Array.isArray(movie.genres)
        ? movie.genres.join(', ')
        : movie.genres || '';
      const matchGenre =
        genreSearch === '' || movieGenresStr.toLowerCase().includes(genreSearch.toLowerCase());

      return matchTitle && matchGenre;
    });
  }, [movies, titleSearch, genreSearch]);

  const filteredCatalogCheckResults = useMemo(() => {
    return catalogCheckResults.filter((item) => {
      if (checkFilter === 'pd_series') return item.isTvSeries && item.isPublicDomain;
      if (checkFilter === 'non_pd_series') return item.isTvSeries && !item.isPublicDomain;
      if (checkFilter === 'with_video') {
        const v = item.movie.videoUrl;
        return Boolean(v && v !== 'null' && v !== 'undefined' && v.trim() !== '');
      }
      return true;
    });
  }, [catalogCheckResults, checkFilter]);

  const filteredWikidataSeries = useMemo(() => {
    return wikidataSeriesResults.filter((item) => {
      if (onlyWithP1476 && !item.hasP1476) return false;
      if (onlyWithVideo && !item.hasVideo) return false;
      if (onlyMissingInCatalog && existingQidSet.has(item.wikidataId)) return false;
      return true;
    });
  }, [wikidataSeriesResults, onlyWithP1476, onlyWithVideo, onlyMissingInCatalog, existingQidSet]);

  const catalogCheckStats = useMemo(() => {
    let pdSeries = 0;
    let nonPdSeries = 0;
    let withVideo = 0;
    for (const r of catalogCheckResults) {
      if (r.isTvSeries && r.isPublicDomain) pdSeries++;
      if (r.isTvSeries && !r.isPublicDomain) nonPdSeries++;
      const v = r.movie.videoUrl;
      if (v && v !== 'null' && v !== 'undefined' && v.trim() !== '') withVideo++;
    }
    return { total: catalogCheckResults.length, pdSeries, nonPdSeries, withVideo };
  }, [catalogCheckResults]);

  const filteredPdProductions = useMemo(() => {
    const q = pdSearchFilterText.trim().toLowerCase();
    return pdProductionsResults.filter((item) => {
      if (pdOnlyWithP1476 && !item.hasP1476) return false;
      if (pdOnlyMissing && existingQidSet.has(item.wikidataId)) return false;
      if (!q) return true;
      return (
        item.wikidataId.toLowerCase().includes(q) ||
        item.originalTitle.toLowerCase().includes(q) ||
        item.instanceLabel.toLowerCase().includes(q) ||
        item.language.toLowerCase().includes(q) ||
        String(item.year || '').includes(q)
      );
    });
  }, [pdProductionsResults, pdSearchFilterText, pdOnlyWithP1476, pdOnlyMissing, existingQidSet]);

  const pdSparqlPreview = useMemo(
    () => buildPublicDomainProductionsSparql(pdSearchCategory, pdSearchLimit),
    [pdSearchCategory, pdSearchLimit]
  );

  const toggleSelection = (qid: string) => {
    const newSelection = new Set(selectedIds);
    if (newSelection.has(qid)) newSelection.delete(qid);
    else newSelection.add(qid);
    setSelectedIds(newSelection);
  };

  const toggleAll = () => {
    if (selectedIds.size === filteredMovies.length && filteredMovies.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredMovies.map((m) => m.wikidataId).filter(Boolean) as string[]));
    }
  };

  const handleDelete = async () => {
    if (selectedIds.size === 0) return;
    const confirmDelete = window.confirm(`ATENÇÃO: Deseja excluir ${selectedIds.size} filme(s)?`);
    if (!confirmDelete) return;

    setIsDeleting(true);
    try {
      await deleteSupabaseMovies(Array.from(selectedIds));
      setStatusMessage({
        type: 'success',
        text: `${selectedIds.size} produção(ões) excluída(s) com sucesso.`,
      });
      setSelectedIds(new Set());
      onRefresh();
    } catch (err: any) {
      setStatusMessage({ type: 'danger', text: 'Erro ao excluir: ' + err.message });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleRunCatalogCheck = async () => {
    const targets =
      checkScope === 'series_only' ? seriesCandidatesInCatalog : allQidCandidatesInCatalog;

    if (targets.length === 0) {
      setStatusMessage({
        type: 'info',
        text: 'Nenhuma produção com QID válido encontrada para o escopo selecionado.',
      });
      return;
    }

    setIsCheckingCatalog(true);
    setStatusMessage(null);
    setCheckProgress({ checked: 0, total: targets.length });
    try {
      const res = await verifyCatalogTvSeriesPublicDomain(targets, (checked, total) => {
        setCheckProgress({ checked, total });
      });
      setCatalogCheckResults(res);
      setHasRunCatalogCheck(true);
    } catch (err: any) {
      setStatusMessage({
        type: 'danger',
        text: 'Erro ao verificar produções no Wikidata: ' + (err?.message || String(err)),
      });
    } finally {
      setIsCheckingCatalog(false);
    }
  };

  const handleRunWikidataDiscovery = async () => {
    setIsFetchingWikidataSeries(true);
    setStatusMessage(null);
    try {
      const res = await findPublicDomainTvSeries();
      setWikidataSeriesResults(res);
      setHasRunWikidataQuery(true);
    } catch (err: any) {
      setStatusMessage({
        type: 'danger',
        text: 'Erro ao consultar séries no Wikidata: ' + (err?.message || String(err)),
      });
    } finally {
      setIsFetchingWikidataSeries(false);
    }
  };

  const handleImportSeries = async (item: WikidataPublicDomainTvSeries) => {
    setImportingQid(item.wikidataId);
    setStatusMessage(null);
    try {
      await addSupabaseMovie({
        wikidataId: item.wikidataId,
        title: item.title,
        originalTitle: item.titleP1476 || item.title,
        description: item.description,
        year: item.year || 1950,
        director: item.director || 'Unknown',
        language: item.language || 'English',
        posterUrl: item.posterUrl,
        videoUrl: item.videoUrl,
        type: 'television series',
        genres: ['Television Series'],
        license: 'Public Domain (Q19652)',
      });
      setStatusMessage({
        type: 'success',
        text: `Série "${item.title}" (${item.wikidataId}) importada para o catálogo.`,
      });
      onRefresh();
    } catch (err: any) {
      setStatusMessage({
        type: 'danger',
        text: `Erro ao importar ${item.wikidataId}: ${err?.message || String(err)}`,
      });
    } finally {
      setImportingQid(null);
    }
  };

  const handleCopySparql = async () => {
    try {
      await navigator.clipboard.writeText(PUBLIC_DOMAIN_TV_SERIES_SPARQL);
      setCopiedSparql(true);
      setTimeout(() => setCopiedSparql(false), 2000);
    } catch {
      // ignore clipboard error
    }
  };

  const handleExportCheckJson = () => {
    const payload = filteredCatalogCheckResults.map((r) => ({
      qid: r.qid,
      catalogTitle: r.movie.titlePt || r.movie.title,
      type: r.movie.type,
      hasVideo: Boolean(r.movie.videoUrl && r.movie.videoUrl !== 'null' && r.movie.videoUrl.trim() !== ''),
      videoUrl: r.movie.videoUrl || '',
      titleP1476: r.titleP1476,
      wikidataLabel: r.wikidataLabel,
      p31Qids: r.p31Qids,
      p31Labels: r.p31Labels,
      p6216Qids: r.p6216Qids,
      p6216Labels: r.p6216Labels,
      isTvSeries_Q5398426: r.isTvSeries,
      isPublicDomain_Q19652: r.isPublicDomain,
    }));
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `series-tv-dominio-publico-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleRunPdProductionsSearch = async () => {
    setIsSearchingPdProductions(true);
    setStatusMessage(null);
    try {
      const res = await searchPublicDomainProductionsInWikidata(pdSearchCategory, pdSearchLimit);
      setPdProductionsResults(res);
      setHasRunPdProductionsSearch(true);
    } catch (err: any) {
      setStatusMessage({
        type: 'danger',
        text: 'Erro ao pesquisar produções no Wikidata: ' + (err?.message || String(err)),
      });
    } finally {
      setIsSearchingPdProductions(false);
    }
  };

  const handleCopyPdSparql = async () => {
    try {
      await navigator.clipboard.writeText(pdSparqlPreview);
      setCopiedPdSparql(true);
      setTimeout(() => setCopiedPdSparql(false), 2000);
    } catch {
      // ignore clipboard error
    }
  };

  const handleImportPdProduction = async (item: WikidataPublicDomainProduction) => {
    setImportingQid(item.wikidataId);
    setStatusMessage(null);
    try {
      let type = item.instanceLabel || 'film';
      let genres = ['Classic'];
      if (item.instanceQid === 'Q5398426') {
        type = 'television series';
        genres = ['Television Series'];
      } else if (item.instanceQid === 'Q17517379') {
        type = 'animated short film';
        genres = ['Animation', 'Short'];
      } else if (item.isDocumentary) {
        type = 'documentary film';
        genres = ['Documentary'];
      }

      await addSupabaseMovie({
        wikidataId: item.wikidataId,
        title: item.originalTitle,
        originalTitle: item.originalTitle,
        description: item.description,
        year: item.year || 1950,
        director: item.director || 'Unknown',
        language: item.language !== 'Não informado' ? item.language : 'Unknown',
        posterUrl: item.posterUrl,
        videoUrl: item.videoUrl,
        type,
        genres,
        license: 'Public Domain (Q19652)',
      });

      await upsertIdentifiers(item.wikidataId, {
        archiveId: item.archiveId,
        imdbId: item.imdbId,
        googleKnowId: item.googleKnowId,
        ofdbId: item.ofdbId,
        youtubeId: item.youtubeId,
        commons: item.commons,
      });

      setStatusMessage({
        type: 'success',
        text: `Produção "${item.originalTitle}" (${item.wikidataId}) importada para o catálogo.`,
      });
      onRefresh();
    } catch (err: any) {
      setStatusMessage({
        type: 'danger',
        text: `Erro ao importar ${item.wikidataId}: ${err?.message || String(err)}`,
      });
    } finally {
      setImportingQid(null);
    }
  };

  const handleExportPdCsv = () => {
    const header = ['QID', 'Titulo Original (P1476)', 'Instancia', 'Idioma', 'Ano'];
    const escapeCsv = (v: string | number) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const rows = filteredPdProductions.map((item) =>
      [
        escapeCsv(item.wikidataId),
        escapeCsv(item.originalTitle),
        escapeCsv(`${item.instanceLabel} (${item.instanceQid})`),
        escapeCsv(item.language),
        escapeCsv(item.year || ''),
      ].join(',')
    );
    const csv = [header.join(','), ...rows].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `wikidata-dominio-publico-${pdSearchCategory}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="modal d-block" style={{ backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 1100 }}>
      <div className="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable">
        <div className="modal-content bg-dark border-danger text-white shadow-lg">
          <div className="modal-header border-danger bg-danger bg-opacity-10 d-flex justify-content-between align-items-center">
            <h5 className="modal-title d-flex align-items-center gap-2 text-danger fw-bold">
              <ShieldAlert size={24} /> Painel do Administrador
            </h5>
            <button
              className="btn-close btn-close-white"
              onClick={onClose}
              disabled={isDeleting || isCheckingCatalog}
            ></button>
          </div>

          <div className="px-3 pt-3 border-bottom border-secondary bg-black bg-opacity-50">
            <ul className="nav nav-tabs border-0 gap-2">
              <li className="nav-item">
                <button
                  type="button"
                  className={`nav-link border-0 rounded-top d-flex align-items-center gap-2 ${
                    activeTab === 'delete'
                      ? 'bg-danger text-white fw-bold'
                      : 'bg-dark text-white-50'
                  }`}
                  onClick={() => setActiveTab('delete')}
                >
                  <Trash2 size={16} />
                  <span>Gerenciar / Excluir Produções</span>
                </button>
              </li>
              <li className="nav-item">
                <button
                  type="button"
                  className={`nav-link border-0 rounded-top d-flex align-items-center gap-2 ${
                    activeTab === 'tv_copyright'
                      ? 'bg-info text-dark fw-bold'
                      : 'bg-dark text-white-50'
                  }`}
                  onClick={() => setActiveTab('tv_copyright')}
                >
                  <Tv size={16} />
                  <span>Verificar Séries TV em Domínio Público</span>
                </button>
              </li>
              <li className="nav-item">
                <button
                  type="button"
                  className={`nav-link border-0 rounded-top d-flex align-items-center gap-2 ${
                    activeTab === 'pd_search'
                      ? 'bg-success text-white fw-bold'
                      : 'bg-dark text-white-50'
                  }`}
                  onClick={() => setActiveTab('pd_search')}
                >
                  <Search size={16} />
                  <span>Pesquisar Domínio Público (Wikidata)</span>
                </button>
              </li>
            </ul>
          </div>

          <div className="modal-body custom-scrollbar">
            {statusMessage && (
              <div
                className={`alert alert-${statusMessage.type} py-2 px-3 d-flex justify-content-between align-items-center mb-3`}
              >
                <span className="small">{statusMessage.text}</span>
                <button
                  type="button"
                  className="btn-close btn-sm"
                  onClick={() => setStatusMessage(null)}
                ></button>
              </div>
            )}

            {activeTab === 'delete' && (
              <>
                <div className="card bg-black border-secondary mb-4 p-3">
                  <div className="row g-3">
                    <div className="col-md-6">
                      <label className="small text-secondary mb-1">Filtrar por Título</label>
                      <div className="input-group">
                        <span className="input-group-text bg-dark border-secondary text-white">
                          <Search size={18} />
                        </span>
                        <input
                          type="text"
                          className="form-control bg-dark border-secondary text-white shadow-none"
                          placeholder="Digite parte do título..."
                          value={titleSearch}
                          onChange={(e) => setTitleSearch(e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="col-md-6">
                      <label className="small text-secondary mb-1">Filtrar por Gênero</label>
                      <select
                        className="form-select bg-dark border-secondary text-white shadow-none"
                        value={genreSearch}
                        onChange={(e) => setGenreSearch(e.target.value)}
                      >
                        <option value="">-- Todos os Gêneros --</option>
                        {uniqueGenres.map((g) => (
                          <option key={g} value={g}>
                            {g}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                <div
                  className="table-responsive custom-scrollbar"
                  style={{ maxHeight: '50vh', minHeight: '200px' }}
                >
                  {!titleSearch.trim() && !genreSearch ? (
                    <div className="d-flex flex-column align-items-center justify-content-center h-100 py-5 text-secondary opacity-50">
                      <Search size={40} className="mb-2" />
                      <p>Digite um título ou escolha um gênero para listar os filmes.</p>
                    </div>
                  ) : (
                    <table className="table table-dark table-hover align-middle border-secondary">
                      <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                        <tr>
                          <th style={{ width: '50px' }}>
                            <button
                              className="btn btn-sm btn-outline-secondary border-0"
                              onClick={toggleAll}
                            >
                              {selectedIds.size === filteredMovies.length &&
                              filteredMovies.length > 0 ? (
                                <CheckSquare size={20} className="text-danger" />
                              ) : (
                                <Square size={20} />
                              )}
                            </button>
                          </th>
                          <th>Poster</th>
                          <th>Título</th>
                          <th>Gêneros</th>
                          <th>QID</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredMovies.map((movie) => (
                          <tr
                            key={movie.wikidataId || movie.id}
                            onClick={() => toggleSelection(movie.wikidataId || '')}
                            style={{ cursor: 'pointer' }}
                          >
                            <td>
                              {selectedIds.has(movie.wikidataId || '') ? (
                                <CheckSquare size={20} className="text-danger" />
                              ) : (
                                <Square size={20} className="text-secondary" />
                              )}
                            </td>
                            <td>
                              {movie.posterUrl ? (
                                <img
                                  src={movie.posterUrl}
                                  alt="p"
                                  style={{ width: '40px', height: '60px', objectFit: 'cover' }}
                                />
                              ) : (
                                <div
                                  className="bg-secondary"
                                  style={{ width: '40px', height: '60px' }}
                                ></div>
                              )}
                            </td>
                            <td className="fw-bold">
                              {movie.title}{' '}
                              <span className="text-secondary fw-normal">({movie.year})</span>
                            </td>
                            <td className="text-info small">
                              {Array.isArray(movie.genres)
                                ? movie.genres.join(', ')
                                : movie.genres}
                            </td>
                            <td className="text-secondary font-monospace small">
                              {movie.wikidataId}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </>
            )}

            {activeTab === 'tv_copyright' && (
              <div className="d-flex flex-column gap-4">
                {/* Bloco de Referência das Propriedades Wikidata + Script SPARQL */}
                <div className="card bg-black border-secondary p-3">
                  <div className="d-flex flex-wrap justify-content-between align-items-center gap-2">
                    <div>
                      <h6 className="text-info fw-bold mb-1 d-flex align-items-center gap-2">
                        <ShieldCheck size={18} /> Critérios Wikidata
                      </h6>
                      <div className="small text-white-50 d-flex flex-wrap gap-2">
                        <span className="badge bg-dark border border-secondary">
                          P31 (instância de) = Q5398426 (série de televisão)
                        </span>
                        <span className="badge bg-dark border border-secondary">
                          P6216 (direitos autorais) = Q19652 (domínio público)
                        </span>
                        <span className="badge bg-dark border border-secondary">
                          P1476 (título)
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-info d-flex align-items-center gap-1"
                      onClick={() => setShowSparqlScript((prev) => !prev)}
                    >
                      <Code2 size={15} />
                      <span>{showSparqlScript ? 'Ocultar Script SPARQL' : 'Ver Script SPARQL'}</span>
                    </button>
                  </div>

                  {showSparqlScript && (
                    <div className="mt-3 position-relative">
                      <button
                        type="button"
                        className="btn btn-sm btn-dark border-secondary position-absolute top-0 end-0 m-2 d-flex align-items-center gap-1"
                        onClick={handleCopySparql}
                      >
                        {copiedSparql ? <Check size={14} className="text-success" /> : <Copy size={14} />}
                        <span className="xsmall">{copiedSparql ? 'Copiado' : 'Copiar'}</span>
                      </button>
                      <pre
                        className="bg-dark text-info p-3 rounded border border-secondary small mb-0 custom-scrollbar"
                        style={{ maxHeight: '220px', overflow: 'auto' }}
                      >
                        {PUBLIC_DOMAIN_TV_SERIES_SPARQL}
                      </pre>
                    </div>
                  )}
                </div>

                {/* Parte 1: Verificar Catálogo Atual no Supabase contra o Wikidata */}
                <div className="card bg-black border-secondary p-3">
                  <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-3">
                    <div>
                      <h6 className="fw-bold text-white mb-1">
                        1. Verificar Vídeos/Séries do Catálogo no Wikidata
                      </h6>
                      <p className="small text-secondary mb-0">
                        Cruza os QIDs do banco com o Wikidata para validar P31=Q5398426, P6216=Q19652 e título P1476.
                      </p>
                    </div>
                    <div className="d-flex flex-wrap align-items-center gap-2">
                      <select
                        className="form-select form-select-sm bg-dark border-secondary text-white shadow-none"
                        style={{ width: 'auto' }}
                        value={checkScope}
                        onChange={(e) => setCheckScope(e.target.value as CatalogCheckScope)}
                        disabled={isCheckingCatalog}
                      >
                        <option value="series_only">
                          Somente Séries no Catálogo ({seriesCandidatesInCatalog.length})
                        </option>
                        <option value="all_qids">
                          Todos os QIDs do Catálogo ({allQidCandidatesInCatalog.length})
                        </option>
                      </select>
                      <button
                        type="button"
                        className="btn btn-sm btn-info fw-bold d-flex align-items-center gap-2"
                        onClick={handleRunCatalogCheck}
                        disabled={isCheckingCatalog}
                      >
                        {isCheckingCatalog ? (
                          <>
                            <Loader2 size={15} className="animate-spin" />
                            <span>
                              Verificando ({checkProgress.checked}/{checkProgress.total})
                            </span>
                          </>
                        ) : (
                          <>
                            <ShieldCheck size={15} />
                            <span>Verificar Catálogo</span>
                          </>
                        )}
                      </button>
                      {hasRunCatalogCheck && filteredCatalogCheckResults.length > 0 && (
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-light d-flex align-items-center gap-1"
                          onClick={handleExportCheckJson}
                        >
                          <Download size={14} />
                          <span>Exportar JSON</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {hasRunCatalogCheck && (
                    <>
                      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
                        <div className="d-flex flex-wrap gap-2 small">
                          <span className="badge bg-secondary">
                            Verificados: {catalogCheckStats.total}
                          </span>
                          <span className="badge bg-success">
                            Série TV + Domínio Público: {catalogCheckStats.pdSeries}
                          </span>
                          <span className="badge bg-warning text-dark">
                            Série TV sem Domínio Público: {catalogCheckStats.nonPdSeries}
                          </span>
                          <span className="badge bg-primary">
                            Com Vídeo: {catalogCheckStats.withVideo}
                          </span>
                        </div>

                        <select
                          className="form-select form-select-sm bg-dark border-secondary text-white shadow-none"
                          style={{ width: 'auto' }}
                          value={checkFilter}
                          onChange={(e) => setCheckFilter(e.target.value as CatalogCheckFilter)}
                        >
                          <option value="all">Mostrar Todos</option>
                          <option value="pd_series">
                            Somente Séries em Domínio Público (P31=Q5398426 + P6216=Q19652)
                          </option>
                          <option value="non_pd_series">
                            Séries sem Domínio Público (Q19652 ausente)
                          </option>
                          <option value="with_video">Somente com Vídeo Cadastrado</option>
                        </select>
                      </div>

                      <div className="table-responsive custom-scrollbar" style={{ maxHeight: '300px' }}>
                        <table className="table table-dark table-sm table-hover align-middle border-secondary mb-0">
                          <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                            <tr>
                              <th>Título (Catálogo)</th>
                              <th>Título P1476 (Wikidata)</th>
                              <th>Instância P31</th>
                              <th>Direitos P6216</th>
                              <th>Vídeo</th>
                              <th>QID</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredCatalogCheckResults.length === 0 ? (
                              <tr>
                                <td colSpan={6} className="text-center text-secondary py-4">
                                  Nenhum item encontrado para o filtro selecionado.
                                </td>
                              </tr>
                            ) : (
                              filteredCatalogCheckResults.map((item) => {
                                const hasVideo = Boolean(
                                  item.movie.videoUrl &&
                                    item.movie.videoUrl !== 'null' &&
                                    item.movie.videoUrl.trim() !== ''
                                );
                                return (
                                  <tr key={`${item.movie.id}-${item.qid}`}>
                                    <td className="small fw-bold">
                                      {item.movie.titlePt || item.movie.title}
                                      <div className="text-secondary fw-normal" style={{ fontSize: '0.72rem' }}>
                                        {item.movie.type || 'Movie'} • {item.movie.year || '—'}
                                      </div>
                                    </td>
                                    <td className="small text-info">
                                      {item.titleP1476 || (
                                        <span className="text-secondary">{item.wikidataLabel || '—'}</span>
                                      )}
                                    </td>
                                    <td className="small">
                                      {item.isTvSeries ? (
                                        <span className="badge bg-info text-dark">
                                          Q5398426 (Série TV)
                                        </span>
                                      ) : (
                                        <span className="text-white-50">
                                          {item.p31Labels.slice(0, 2).join(', ') || '—'}
                                        </span>
                                      )}
                                    </td>
                                    <td className="small">
                                      {item.isPublicDomain ? (
                                        <span className="badge bg-success d-inline-flex align-items-center gap-1">
                                          <ShieldCheck size={12} /> Q19652 Domínio Público
                                        </span>
                                      ) : (
                                        <span className="badge bg-warning text-dark d-inline-flex align-items-center gap-1">
                                          <AlertTriangle size={12} />{' '}
                                          {item.p6216Labels.join(', ') || 'Não informado'}
                                        </span>
                                      )}
                                    </td>
                                    <td className="small">
                                      {hasVideo ? (
                                        <span className="text-success d-inline-flex align-items-center gap-1">
                                          <Video size={14} /> Sim
                                        </span>
                                      ) : (
                                        <span className="text-secondary">Não</span>
                                      )}
                                    </td>
                                    <td className="font-monospace small">
                                      <a
                                        href={`https://www.wikidata.org/wiki/${item.qid}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-info text-decoration-none d-inline-flex align-items-center gap-1"
                                      >
                                        {item.qid} <ExternalLink size={12} />
                                      </a>
                                    </td>
                                  </tr>
                                );
                              })
                            )}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                </div>

                {/* Parte 2: Consulta Direta no Wikidata (P31=Q5398426 & P6216=Q19652 & P1476) */}
                <div className="card bg-black border-secondary p-3">
                  <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-3">
                    <div>
                      <h6 className="fw-bold text-white mb-1">
                        2. Buscar Séries de TV em Domínio Público Direto no Wikidata
                      </h6>
                      <p className="small text-secondary mb-0">
                        Executa a query SPARQL para listar séries (P31=Q5398426) com situação P6216=Q19652 e título P1476.
                      </p>
                    </div>
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-info fw-bold d-flex align-items-center gap-2"
                      onClick={handleRunWikidataDiscovery}
                      disabled={isFetchingWikidataSeries}
                    >
                      {isFetchingWikidataSeries ? (
                        <>
                          <Loader2 size={15} className="animate-spin" />
                          <span>Consultando Wikidata...</span>
                        </>
                      ) : (
                        <>
                          <Search size={15} />
                          <span>Consultar Wikidata (SPARQL)</span>
                        </>
                      )}
                    </button>
                  </div>

                  {hasRunWikidataQuery && (
                    <>
                      <div className="d-flex flex-wrap align-items-center gap-3 mb-3 small">
                        <label className="form-check-label d-flex align-items-center gap-1 text-white-50">
                          <input
                            type="checkbox"
                            className="form-check-input mt-0"
                            checked={onlyWithP1476}
                            onChange={(e) => setOnlyWithP1476(e.target.checked)}
                          />
                          <span>Somente com P1476 preenchido</span>
                        </label>
                        <label className="form-check-label d-flex align-items-center gap-1 text-white-50">
                          <input
                            type="checkbox"
                            className="form-check-input mt-0"
                            checked={onlyWithVideo}
                            onChange={(e) => setOnlyWithVideo(e.target.checked)}
                          />
                          <span>Somente com vídeo (Internet Archive P724)</span>
                        </label>
                        <label className="form-check-label d-flex align-items-center gap-1 text-white-50">
                          <input
                            type="checkbox"
                            className="form-check-input mt-0"
                            checked={onlyMissingInCatalog}
                            onChange={(e) => setOnlyMissingInCatalog(e.target.checked)}
                          />
                          <span>Somente ainda não cadastradas</span>
                        </label>
                        <span className="ms-auto badge bg-secondary">
                          {filteredWikidataSeries.length} resultado(s)
                        </span>
                      </div>

                      <div className="table-responsive custom-scrollbar" style={{ maxHeight: '300px' }}>
                        <table className="table table-dark table-sm table-hover align-middle border-secondary mb-0">
                          <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                            <tr>
                              <th>Título P1476</th>
                              <th>Ano</th>
                              <th>Vídeo (P724)</th>
                              <th>QID</th>
                              <th>Catálogo</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredWikidataSeries.length === 0 ? (
                              <tr>
                                <td colSpan={5} className="text-center text-secondary py-4">
                                  Nenhuma série encontrada com os filtros atuais.
                                </td>
                              </tr>
                            ) : (
                              filteredWikidataSeries.map((item) => {
                                const alreadyExists = existingQidSet.has(item.wikidataId);
                                return (
                                  <tr key={item.wikidataId}>
                                    <td className="small fw-bold">
                                      {item.title}
                                      {!item.hasP1476 && (
                                        <span className="ms-2 badge bg-secondary">Sem P1476 (Label)</span>
                                      )}
                                      {item.description && (
                                        <div
                                          className="text-secondary fw-normal text-truncate"
                                          style={{ maxWidth: '340px', fontSize: '0.72rem' }}
                                        >
                                          {item.description}
                                        </div>
                                      )}
                                    </td>
                                    <td className="small text-white-50">{item.year || '—'}</td>
                                    <td className="small">
                                      {item.hasVideo ? (
                                        <span className="text-success d-inline-flex align-items-center gap-1">
                                          <Video size={14} /> Archive.org
                                        </span>
                                      ) : (
                                        <span className="text-secondary">—</span>
                                      )}
                                    </td>
                                    <td className="font-monospace small">
                                      <a
                                        href={`https://www.wikidata.org/wiki/${item.wikidataId}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-info text-decoration-none d-inline-flex align-items-center gap-1"
                                      >
                                        {item.wikidataId} <ExternalLink size={12} />
                                      </a>
                                    </td>
                                    <td className="small">
                                      {alreadyExists ? (
                                        <span className="badge bg-success">Já cadastrado</span>
                                      ) : (
                                        <button
                                          type="button"
                                          className="btn btn-sm btn-outline-success py-0 px-2 d-inline-flex align-items-center gap-1"
                                          onClick={() => handleImportSeries(item)}
                                          disabled={importingQid === item.wikidataId}
                                        >
                                          {importingQid === item.wikidataId ? (
                                            <Loader2 size={12} className="animate-spin" />
                                          ) : (
                                            <PlusCircle size={12} />
                                          )}
                                          <span>Importar</span>
                                        </button>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })
                            )}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'pd_search' && (
              <div className="d-flex flex-column gap-4">
                <div className="card bg-black border-secondary p-3">
                  <div className="d-flex flex-wrap justify-content-between align-items-start gap-3">
                    <div>
                      <h6 className="text-success fw-bold mb-1 d-flex align-items-center gap-2">
                        <ShieldCheck size={18} /> Pesquisa de Produções Visuais em Domínio Público (Wikidata)
                      </h6>
                      <p className="small text-secondary mb-2">
                        Busca produções com direitos autorais em domínio público (P6216 = Q19652) e exibe QID, título original (P1476), instância, idioma e ano.
                      </p>
                      <div className="d-flex flex-wrap gap-2 small">
                        <span className="badge bg-dark border border-secondary">
                          P31 = Q5398426 (Série de televisão)
                        </span>
                        <span className="badge bg-dark border border-secondary">
                          P31 = Q17517379 (Curta-metragem de animação)
                        </span>
                        <span className="badge bg-dark border border-secondary">
                          P31 = Q11424 + P136 = Q93204 (Filme Documentário)
                        </span>
                        <span className="badge bg-success bg-opacity-25 text-success border border-success">
                          P6216 = Q19652 (Domínio Público)
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      className="btn btn-sm btn-outline-success d-flex align-items-center gap-1"
                      onClick={() => setShowPdSparqlScript((prev) => !prev)}
                    >
                      <Code2 size={15} />
                      <span>{showPdSparqlScript ? 'Ocultar SPARQL' : 'Ver Script SPARQL'}</span>
                    </button>
                  </div>

                  {showPdSparqlScript && (
                    <div className="mt-3 position-relative">
                      <button
                        type="button"
                        className="btn btn-sm btn-dark border-secondary position-absolute top-0 end-0 m-2 d-flex align-items-center gap-1"
                        onClick={handleCopyPdSparql}
                      >
                        {copiedPdSparql ? <Check size={14} className="text-success" /> : <Copy size={14} />}
                        <span className="xsmall">{copiedPdSparql ? 'Copiado' : 'Copiar'}</span>
                      </button>
                      <pre
                        className="bg-dark text-success p-3 rounded border border-secondary small mb-0 custom-scrollbar"
                        style={{ maxHeight: '220px', overflow: 'auto' }}
                      >
                        {pdSparqlPreview}
                      </pre>
                    </div>
                  )}

                  <div className="row g-2 align-items-end mt-3 pt-3 border-top border-secondary border-opacity-50">
                    <div className="col-md-5">
                      <label className="small text-secondary mb-1">Tipo / Instância</label>
                      <select
                        className="form-select form-select-sm bg-dark border-secondary text-white shadow-none"
                        value={pdSearchCategory}
                        onChange={(e) => setPdSearchCategory(e.target.value as PublicDomainProductionCategory)}
                        disabled={isSearchingPdProductions}
                      >
                        <option value="all">Todas (Série TV, Curta Animação e Filme Documentário)</option>
                        <option value="tv_series">Série de televisão (P31 = Q5398426)</option>
                        <option value="animated_short">Curta-metragem de animação (P31 = Q17517379)</option>
                        <option value="documentary_film">Filme + Gênero Documentário (P31 = Q11424 / P136 = Q93204)</option>
                      </select>
                    </div>
                    <div className="col-md-2">
                      <label className="small text-secondary mb-1">Limite SPARQL</label>
                      <select
                        className="form-select form-select-sm bg-dark border-secondary text-white shadow-none"
                        value={pdSearchLimit}
                        onChange={(e) => setPdSearchLimit(Number(e.target.value))}
                        disabled={isSearchingPdProductions}
                      >
                        <option value={100}>100</option>
                        <option value={150}>150</option>
                        <option value={250}>250</option>
                      </select>
                    </div>
                    <div className="col-md-5 d-flex gap-2 justify-content-md-end">
                      <button
                        type="button"
                        className="btn btn-sm btn-success fw-bold d-flex align-items-center gap-2"
                        onClick={handleRunPdProductionsSearch}
                        disabled={isSearchingPdProductions}
                      >
                        {isSearchingPdProductions ? (
                          <>
                            <Loader2 size={15} className="animate-spin" />
                            <span>Pesquisando no Wikidata...</span>
                          </>
                        ) : (
                          <>
                            <Search size={15} />
                            <span>Pesquisar no Wikidata</span>
                          </>
                        )}
                      </button>
                      {hasRunPdProductionsSearch && filteredPdProductions.length > 0 && (
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-light d-flex align-items-center gap-1"
                          onClick={handleExportPdCsv}
                        >
                          <Download size={14} />
                          <span>Exportar CSV</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {hasRunPdProductionsSearch && (
                  <div className="card bg-black border-secondary p-3">
                    <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
                      <div className="d-flex flex-wrap align-items-center gap-3 small">
                        <div className="input-group input-group-sm" style={{ width: '250px' }}>
                          <span className="input-group-text bg-dark border-secondary text-white">
                            <Search size={14} />
                          </span>
                          <input
                            type="text"
                            className="form-control bg-dark border-secondary text-white shadow-none"
                            placeholder="Filtrar QID, título, idioma, ano..."
                            value={pdSearchFilterText}
                            onChange={(e) => setPdSearchFilterText(e.target.value)}
                          />
                        </div>
                        <label className="form-check-label d-flex align-items-center gap-1 text-white-50">
                          <input
                            type="checkbox"
                            className="form-check-input mt-0"
                            checked={pdOnlyWithP1476}
                            onChange={(e) => setPdOnlyWithP1476(e.target.checked)}
                          />
                          <span>Somente com P1476</span>
                        </label>
                        <label className="form-check-label d-flex align-items-center gap-1 text-white-50">
                          <input
                            type="checkbox"
                            className="form-check-input mt-0"
                            checked={pdOnlyMissing}
                            onChange={(e) => setPdOnlyMissing(e.target.checked)}
                          />
                          <span>Somente não cadastradas</span>
                        </label>
                      </div>
                      <span className="badge bg-secondary">
                        {filteredPdProductions.length} produção(ões)
                      </span>
                    </div>

                    <div className="table-responsive custom-scrollbar" style={{ maxHeight: '420px' }}>
                      <table className="table table-dark table-sm table-hover align-middle border-secondary mb-0">
                        <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                          <tr>
                            <th>QID</th>
                            <th>Título Original (P1476)</th>
                            <th>Instância</th>
                            <th>Idioma</th>
                            <th>Ano</th>
                            <th>Catálogo</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredPdProductions.length === 0 ? (
                            <tr>
                              <td colSpan={6} className="text-center text-secondary py-4">
                                Nenhuma produção encontrada com os filtros atuais.
                              </td>
                            </tr>
                          ) : (
                            filteredPdProductions.map((item) => {
                              const alreadyExists = existingQidSet.has(item.wikidataId);
                              return (
                                <tr key={`${item.wikidataId}-${item.instanceQid}`}>
                                  <td className="font-monospace small text-nowrap">
                                    <a
                                      href={`https://www.wikidata.org/wiki/${item.wikidataId}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-info text-decoration-none d-inline-flex align-items-center gap-1"
                                    >
                                      {item.wikidataId} <ExternalLink size={12} />
                                    </a>
                                  </td>
                                  <td className="small fw-bold">
                                    {item.originalTitle}
                                    {!item.hasP1476 && (
                                      <span className="ms-2 badge bg-secondary">Label</span>
                                    )}
                                  </td>
                                  <td className="small">
                                    <span className="badge bg-dark border border-info text-info">
                                      {item.instanceLabel} ({item.instanceQid})
                                    </span>
                                  </td>
                                  <td className="small text-white-50">{item.language}</td>
                                  <td className="small text-white-50">{item.year || '—'}</td>
                                  <td className="small">
                                    {alreadyExists ? (
                                      <span className="badge bg-success">Já cadastrado</span>
                                    ) : (
                                      <button
                                        type="button"
                                        className="btn btn-sm btn-outline-success py-0 px-2 d-inline-flex align-items-center gap-1"
                                        onClick={() => handleImportPdProduction(item)}
                                        disabled={importingQid === item.wikidataId}
                                      >
                                        {importingQid === item.wikidataId ? (
                                          <Loader2 size={12} className="animate-spin" />
                                        ) : (
                                          <PlusCircle size={12} />
                                        )}
                                        <span>Importar</span>
                                      </button>
                                    )}
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="modal-footer border-danger d-flex justify-content-between align-items-center bg-black">
            {activeTab === 'delete' ? (
              <>
                <span className="text-secondary">
                  Selecionados:{' '}
                  <strong className={selectedIds.size > 0 ? 'text-danger' : 'text-white'}>
                    {selectedIds.size}
                  </strong>{' '}
                  de {filteredMovies.length}
                </span>
                <div className="d-flex gap-2">
                  <button
                    className="btn btn-outline-secondary"
                    onClick={onClose}
                    disabled={isDeleting}
                  >
                    Cancelar
                  </button>
                  <button
                    className="btn btn-danger d-flex align-items-center gap-2"
                    onClick={handleDelete}
                    disabled={selectedIds.size === 0 || isDeleting}
                  >
                    {isDeleting ? (
                      <Loader2 size={18} className="animate-spin" />
                    ) : (
                      <Trash2 size={18} />
                    )}
                    Excluir Selecionados
                  </button>
                </div>
              </>
            ) : (
              <>
                <span className="text-secondary small">
                  {activeTab === 'pd_search'
                    ? 'Wikidata SPARQL • P31 (Q5398426 / Q17517379 / Q11424+P136:Q93204) • P6216=Q19652 • P1476'
                    : 'Wikidata SPARQL • P31=Q5398426 • P6216=Q19652 • P1476'}
                </span>
                <button
                  className="btn btn-outline-secondary"
                  onClick={onClose}
                  disabled={isCheckingCatalog || isSearchingPdProductions}
                >
                  Fechar
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
