import React, { useState, useMemo, useEffect } from 'react';
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
  Image as ImageIcon,
  HardDrive,
  LogOut,
  Languages,
  History,
  RefreshCw,
} from 'lucide-react';
import { Movie, AppLanguage } from '../types';
import { APP_TRANSLATIONS } from '../constants';
import { deleteSupabaseMovies, getWikidataImportHistory } from '../services/supabaseClient';
import { WikidataImportReview } from './WikidataImportReview';
import { translateWikidataMetadata } from '../services/translateService';
import {
  connectGoogleDrive,
  getGoogleDriveAccessToken,
  getGoogleDriveUserEmail,
  clearGoogleDriveAccessToken,
} from '../firebase';
import {
  DEFAULT_DRIVE_POSTER_FOLDER_ID,
  uploadWikidataPosterToGoogleDrive,
} from '../services/googleDrivePosterService';
import {
  verifyCatalogTvSeriesPublicDomain,
  findPublicDomainTvSeries,
  searchPublicDomainProductionsInWikidata,
  buildPublicDomainProductionsSparql,
  PUBLIC_DOMAIN_TV_SERIES_SPARQL,
  PUBLIC_DOMAIN_INSTANCE_MAP,
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
  language?: AppLanguage;
}

type AdminTab = 'delete' | 'tv_copyright' | 'pd_search';
type CatalogCheckScope = 'series_only' | 'all_qids';
type CatalogCheckFilter = 'all' | 'pd_series' | 'non_pd_series' | 'with_video';

export const AdminDeleteModal: React.FC<AdminDeleteModalProps> = ({
  movies,
  onClose,
  onRefresh,
  language = 'pt',
}) => {
  const t = APP_TRANSLATIONS[language] || APP_TRANSLATIONS['pt'];
  const instanceLabels = t.adminInstanceLabels || APP_TRANSLATIONS['pt'].adminInstanceLabels;
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
  const [pdOnlyWithP18, setPdOnlyWithP18] = useState(false);
  const [pdOnlyWithP1476, setPdOnlyWithP1476] = useState(false);
  const [pdOnlyMissing, setPdOnlyMissing] = useState(false);
  const [showPdSparqlScript, setShowPdSparqlScript] = useState(false);
  const [copiedPdSparql, setCopiedPdSparql] = useState(false);
  const [isTranslatingPdList, setIsTranslatingPdList] = useState(false);
  const [reviewingPdItem, setReviewingPdItem] = useState<WikidataPublicDomainProduction | null>(null);
  const [showImportHistory, setShowImportHistory] = useState(false);
  const [importHistory, setImportHistory] = useState<any[]>([]);
  const [isLoadingImportHistory, setIsLoadingImportHistory] = useState(false);

  // --- Google Drive Poster Upload ({qid}.webp) ---
  const [driveConnected, setDriveConnected] = useState<boolean>(() => Boolean(getGoogleDriveAccessToken()));
  const [driveUserEmail, setDriveUserEmail] = useState<string | null>(() => getGoogleDriveUserEmail());
  const [isConnectingDrive, setIsConnectingDrive] = useState(false);
  const [savePosterToDrive, setSavePosterToDrive] = useState(true);

  useEffect(() => {
    let active = true;
    if (getGoogleDriveAccessToken()) {
      setDriveConnected(true);
      setDriveUserEmail(getGoogleDriveUserEmail());
      return;
    }

    setIsConnectingDrive(true);
    connectGoogleDrive()
      .then(({ user }) => {
        if (!active) return;
        setDriveConnected(true);
        setDriveUserEmail(user?.email || getGoogleDriveUserEmail() || 'Conta Google conectada');
      })
      .catch((err: any) => {
        if (!active) return;
        const code = err?.code || '';
        const msg = err?.message || String(err);
        if (code === 'auth/popup-blocked' || msg.includes('popup-blocked')) {
          setStatusMessage({
            type: 'info',
            text: 'O navegador bloqueou a janela automática do Google Drive. Clique em "Conectar Google Drive" na aba de Domínio Público para autorizar o envio de imagens.',
          });
        } else if (code !== 'auth/popup-closed-by-user' && code !== 'auth/cancelled-popup-request') {
          setStatusMessage({
            type: 'info',
            text: `Conexão automática com Google Drive pendente (${msg}). Use "Conectar Google Drive" quando desejar salvar pôsteres.`,
          });
        }
      })
      .finally(() => {
        if (active) setIsConnectingDrive(false);
      });

    return () => {
      active = false;
    };
  }, []);

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
      if (pdOnlyWithP18 && !item.posterUrl) return false;
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
  }, [pdProductionsResults, pdSearchFilterText, pdOnlyWithP18, pdOnlyWithP1476, pdOnlyMissing, existingQidSet]);

  const pdSparqlPreview = useMemo(
    () =>
      buildPublicDomainProductionsSparql(pdSearchCategory, pdSearchLimit, {
        onlyWithImage: pdOnlyWithP18,
        onlyWithTitle: pdOnlyWithP1476,
      }),
    [pdSearchCategory, pdSearchLimit, pdOnlyWithP18, pdOnlyWithP1476]
  );

  const getTranslatedInstanceLabel = (item: WikidataPublicDomainProduction): string => {
    if (item.isDocumentary) {
      return instanceLabels?.documentary_film || item.instanceLabel;
    }
    const matched = (
      Object.entries(PUBLIC_DOMAIN_INSTANCE_MAP) as Array<
        [Exclude<PublicDomainProductionCategory, 'all' | 'documentary_film'>, { qid: string }]
      >
    ).find(([, entry]) => entry.qid === item.instanceQid);
    if (matched && instanceLabels?.[matched[0]]) {
      return instanceLabels[matched[0]];
    }
    return item.instanceLabel;
  };

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

  const handleConnectDrive = async () => {
    setIsConnectingDrive(true);
    setStatusMessage(null);
    try {
      const { user } = await connectGoogleDrive();
      setDriveConnected(true);
      setDriveUserEmail(user?.email || user?.displayName || 'Conta Google conectada');
      setStatusMessage({
        type: 'success',
        text: 'Google Drive conectado com sucesso! As imagens do Wikidata serão convertidas e salvas como {qid}.webp.',
      });
    } catch (err: any) {
      setStatusMessage({
        type: 'danger',
        text: `Não foi possível conectar ao Google Drive: ${err?.message || String(err)}`,
      });
    } finally {
      setIsConnectingDrive(false);
    }
  };

  const handleDisconnectDrive = () => {
    clearGoogleDriveAccessToken();
    setDriveConnected(false);
    setDriveUserEmail(null);
  };

  const resolvePosterUrlForImport = async (
    qid: string,
    wikidataPosterUrl: string
  ): Promise<{ posterUrl: string; driveNote?: string; warningNote?: string }> => {
    if (!wikidataPosterUrl) {
      return { posterUrl: '' };
    }
    const token = getGoogleDriveAccessToken();
    if (!savePosterToDrive || !token) {
      return { posterUrl: wikidataPosterUrl };
    }

    try {
      const uploaded = await uploadWikidataPosterToGoogleDrive({
        qid,
        imageUrl: wikidataPosterUrl,
        accessToken: token,
        folderId: DEFAULT_DRIVE_POSTER_FOLDER_ID,
      });
      const sizeText = uploaded.sizeBytes
        ? ` (${Math.max(1, Math.round(uploaded.sizeBytes / 1024))} KB)`
        : '';
      return {
        posterUrl: uploaded.posterUrl,
        driveNote: uploaded.alreadyExisted
          ? `Pôster ${uploaded.fileName} reutilizado da pasta do Google Drive.`
          : `Pôster ${uploaded.fileName}${sizeText} salvo na pasta do Google Drive.`,
      };
    } catch (err: any) {
      return {
        posterUrl: wikidataPosterUrl,
        warningNote: `Aviso: falha ao enviar ${qid}.webp para o Google Drive (${err?.message || String(err)}); link do Wikimedia usado como alternativa.`,
      };
    }
  };

  const handleImportSeries = (item: WikidataPublicDomainTvSeries) => {
    const reviewItem: WikidataPublicDomainProduction = {
      wikidataId: item.wikidataId,
      originalTitle: item.titleP1476 || item.title,
      wikidataLabel: item.title,
      hasP1476: item.hasP1476,
      instanceQid: 'Q5398426',
      instanceLabel: 'television series',
      supabaseType: 'television series',
      isDocumentary: false,
      language: item.language || 'Não informado',
      year: item.year || 0,
      description: item.description || '',
      descriptionEn: item.description || '',
      descriptionPt: '',
      director: item.director || '',
      duration: '',
      genres: ['Television Series'],
      themes: [],
      licenseLabel: 'Public Domain (Q19652)',
      posterUrl: item.posterUrl || '',
      videoUrl: '',
      hasVideo: item.hasVideo,
      archiveId: '',
      youtubeId: '',
    };
    setReviewingPdItem(reviewItem);
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
      const res = await searchPublicDomainProductionsInWikidata(pdSearchCategory, pdSearchLimit, {
        onlyWithImage: pdOnlyWithP18,
        onlyWithTitle: pdOnlyWithP1476,
      });
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

  const handleTranslateVisiblePdItems = async () => {
    const targets = filteredPdProductions
      .filter((item) => !item.titlePt)
      .slice(0, 20);
    if (targets.length === 0) {
      setStatusMessage({
        type: 'info',
        text: 'Os itens visíveis já possuem título/label traduzidos em português.',
      });
      return;
    }

    setIsTranslatingPdList(true);
    setStatusMessage(null);
    try {
      const updates = new Map<string, { titlePt: string; genres?: string[]; themes?: string[] }>();
      for (const item of targets) {
        const res = await translateWikidataMetadata({
          title: item.originalTitle,
          label: item.wikidataLabel,
          genres: item.genres,
          themes: item.themes,
          to: 'pt',
        });
        updates.set(item.wikidataId, {
          titlePt: res.titlePt || res.labelPt || item.originalTitle,
          genres: res.genresPt?.length ? res.genresPt : item.genres,
          themes: res.themesPt?.length ? res.themesPt : item.themes,
        });
      }

      setPdProductionsResults((prev) =>
        prev.map((p) => {
          const upd = updates.get(p.wikidataId);
          return upd
            ? {
                ...p,
                titlePt: upd.titlePt,
                genres: upd.genres || p.genres,
                themes: upd.themes || p.themes,
              }
            : p;
        })
      );
      setStatusMessage({
        type: 'success',
        text: `${updates.size} título(s) e label(s) do Wikidata traduzidos via servidor Node.js.`,
      });
    } catch (err: any) {
      setStatusMessage({
        type: 'danger',
        text: `Erro ao traduzir títulos/labels: ${err?.message || String(err)}`,
      });
    } finally {
      setIsTranslatingPdList(false);
    }
  };

  const handleLoadImportHistory = async () => {
    if (showImportHistory) {
      setShowImportHistory(false);
      return;
    }
    setIsLoadingImportHistory(true);
    setStatusMessage(null);
    try {
      const rows = await getWikidataImportHistory(75);
      setImportHistory(Array.isArray(rows) ? rows : []);
      setShowImportHistory(true);
    } catch (err: any) {
      setStatusMessage({ type: 'danger', text: `Falha ao consultar histórico: ${err?.message || String(err)}` });
    } finally {
      setIsLoadingImportHistory(false);
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
              <ShieldAlert size={24} /> {t.adminPanelTitle || 'Painel do Administrador'}
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
                  <span>{t.adminTabDelete || 'Gerenciar / Excluir Produções'}</span>
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
                  <span>{t.adminTabTvCopyright || 'Verificar Séries TV em Domínio Público'}</span>
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
                  <span>{t.adminTabPdSearch || 'Pesquisar Domínio Público (Wikidata)'}</span>
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
                        <ShieldCheck size={18} /> {t.adminPdTitle || 'Pesquisa de Produções Visuais em Domínio Público (Wikidata)'}
                      </h6>
                      <p className="small text-secondary mb-2">
                        {t.adminPdDesc || 'Busca produções com direitos autorais em domínio público (P6216 = Q19652) e exibe QID, título original (P1476), instância, idioma e ano.'}
                      </p>
                      <div className="d-flex flex-wrap gap-2 small">
                        <span className="badge bg-dark border border-secondary">
                          {t.adminPdInstancesSummary || '14 instâncias (film Q11424, short film, television film, silent film, animated film, television series, miniseries, documentário...)'}
                        </span>
                        <span className="badge bg-success bg-opacity-25 text-success border border-success">
                          {t.adminPdCopyrightBadge || 'P6216 = Q19652 (Domínio Público)'}
                        </span>
                        <span className="badge bg-dark border border-info text-info">
                          {t.adminPdImportsBadge || 'Importa P136 (genres), P921 (themes), P57 (director), P2047 (duration)'}
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      className="btn btn-sm btn-outline-success d-flex align-items-center gap-1"
                      onClick={() => setShowPdSparqlScript((prev) => !prev)}
                    >
                      <Code2 size={15} />
                      <span>
                        {showPdSparqlScript
                          ? (t.adminPdHideSparql || 'Ocultar SPARQL')
                          : (t.adminPdViewSparql || 'Ver Script SPARQL')}
                      </span>
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
                        <span className="xsmall">
                          {copiedPdSparql ? (t.adminPdCopied || 'Copiado') : (t.adminPdCopy || 'Copiar')}
                        </span>
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
                      <label className="small text-secondary mb-1">
                        {t.adminPdTypeInstance || 'Tipo / Instância'}
                      </label>
                      <select
                        className="form-select form-select-sm bg-dark border-secondary text-white shadow-none"
                        value={pdSearchCategory}
                        onChange={(e) => setPdSearchCategory(e.target.value as PublicDomainProductionCategory)}
                        disabled={isSearchingPdProductions}
                      >
                        <option value="all">{t.adminPdAllInstances || 'Todas as instâncias'}</option>
                        <option value="film">{instanceLabels.film} (Q11424)</option>
                        <option value="short_film">{instanceLabels.short_film} (Q24862)</option>
                        <option value="television_film">{instanceLabels.television_film} (Q506240)</option>
                        <option value="television_program">{instanceLabels.television_program} (Q15416)</option>
                        <option value="television_series_episode">{instanceLabels.television_series_episode} (Q21191270)</option>
                        <option value="silent_film">{instanceLabels.silent_film} (Q226730)</option>
                        <option value="silent_short_film">{instanceLabels.silent_short_film} (Q20667187)</option>
                        <option value="animated_short">{instanceLabels.animated_short} (Q17517379)</option>
                        <option value="animated_film">{instanceLabels.animated_film} (Q202866)</option>
                        <option value="tv_series">{instanceLabels.tv_series} (Q5398426)</option>
                        <option value="film_series">{instanceLabels.film_series} (Q24856)</option>
                        <option value="open_source_film">{instanceLabels.open_source_film} (Q917641 / Creative Commons)</option>
                        <option value="documentary_film">{instanceLabels.documentary_film} (Q11424 + P136 = Q93204)</option>
                        <option value="miniseries">{instanceLabels.miniseries} (Q1259759)</option>
                      </select>
                    </div>
                    <div className="col-md-2">
                      <label className="small text-secondary mb-1">
                        {t.adminPdSparqlLimit || 'Limite SPARQL'}
                      </label>
                      <select
                        className="form-select form-select-sm bg-dark border-secondary text-white shadow-none"
                        value={pdSearchLimit}
                        onChange={(e) => setPdSearchLimit(Number(e.target.value))}
                        disabled={isSearchingPdProductions}
                      >
                        <option value={50}>50</option>
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
                            <span>{t.adminPdSearchingBtn || 'Pesquisando no Wikidata...'}</span>
                          </>
                        ) : (
                          <>
                            <Search size={15} />
                            <span>{t.adminPdSearchBtn || 'Pesquisar no Wikidata'}</span>
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
                          <span>{t.adminPdExportCsv || 'Exportar CSV'}</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Opções de filtro exibidas antes e depois da pesquisa */}
                  <div className="d-flex flex-wrap align-items-center gap-4 mt-3 pt-3 border-top border-secondary border-opacity-50 small">
                    <label className="form-check-label d-flex align-items-center gap-2 text-white-50" style={{ cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        className="form-check-input mt-0"
                        checked={pdOnlyWithP18}
                        onChange={(e) => setPdOnlyWithP18(e.target.checked)}
                        disabled={isSearchingPdProductions}
                      />
                      <span>{t.adminOnlyWithImage || 'Somente itens com imagem (P18)'}</span>
                    </label>
                    <label className="form-check-label d-flex align-items-center gap-2 text-white-50" style={{ cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        className="form-check-input mt-0"
                        checked={pdOnlyWithP1476}
                        onChange={(e) => setPdOnlyWithP1476(e.target.checked)}
                        disabled={isSearchingPdProductions}
                      />
                      <span>{t.adminOnlyWithTitle || 'Somente itens com título (P1476)'}</span>
                    </label>
                    <label className="form-check-label d-flex align-items-center gap-2 text-white-50" style={{ cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        className="form-check-input mt-0"
                        checked={pdOnlyMissing}
                        onChange={(e) => setPdOnlyMissing(e.target.checked)}
                        disabled={isSearchingPdProductions}
                      />
                      <span>{t.adminOnlyMissing || 'Somente não cadastradas'}</span>
                    </label>
                  </div>

                  {/* Barra de Conexão Google Drive para salvar pôster {qid}.webp */}
                  <div className="mt-3 pt-3 border-top border-secondary border-opacity-50 d-flex flex-wrap justify-content-between align-items-center gap-3">
                    <div className="d-flex flex-wrap align-items-center gap-2 small">
                      <HardDrive size={16} className={driveConnected ? 'text-success' : 'text-secondary'} />
                      <span className="fw-semibold text-white">Google Drive (Pôster {'{qid}.webp'} &lt; 1 MB):</span>
                      {isConnectingDrive && !driveConnected ? (
                        <span className="text-info d-inline-flex align-items-center gap-1">
                          <Loader2 size={13} className="animate-spin" />
                          <span>{t.adminPdConnectingDrive || 'Conectando ao Google Drive automaticamente...'}</span>
                        </span>
                      ) : driveConnected ? (
                        <>
                          <span className="badge bg-success bg-opacity-25 text-success border border-success">
                            {t.adminPdConnected || 'Conectado'}{driveUserEmail ? ` • ${driveUserEmail}` : ''}
                          </span>
                          <label className="form-check-label d-flex align-items-center gap-1 text-white-50 ms-2">
                            <input
                              type="checkbox"
                              className="form-check-input mt-0"
                              checked={savePosterToDrive}
                              onChange={(e) => setSavePosterToDrive(e.target.checked)}
                            />
                            <span>
                              Salvar imagem P18 (&lt; 1 MB) na pasta{' '}
                              <code className="text-info">{DEFAULT_DRIVE_POSTER_FOLDER_ID}</code> e gravar em posterurl
                            </span>
                          </label>
                        </>
                      ) : (
                        <span className="text-secondary">
                          Conecte o Google Drive para salvar automaticamente a imagem do Wikidata (se existir, &lt; 1 MB) como{' '}
                          <code className="text-info">{'{qid}.webp'}</code> na pasta{' '}
                          <code className="text-info">{DEFAULT_DRIVE_POSTER_FOLDER_ID}</code>.
                        </span>
                      )}
                    </div>

                    <div>
                      {driveConnected ? (
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-secondary d-flex align-items-center gap-1"
                          onClick={handleDisconnectDrive}
                        >
                          <LogOut size={14} />
                          <span>{t.adminPdDisconnectDrive || 'Desconectar Drive'}</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="btn btn-sm bg-white text-dark fw-medium border d-inline-flex align-items-center gap-2 px-3 shadow-sm"
                          onClick={handleConnectDrive}
                          disabled={isConnectingDrive}
                        >
                          {isConnectingDrive ? (
                            <Loader2 size={15} className="animate-spin text-dark" />
                          ) : (
                            <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
                              <path
                                fill="#4285F4"
                                d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
                              />
                              <path
                                fill="#34A853"
                                d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z"
                              />
                              <path
                                fill="#FBBC05"
                                d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z"
                              />
                              <path
                                fill="#EA4335"
                                d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z"
                              />
                            </svg>
                          )}
                          <span>{t.adminPdConnectDrive || 'Conectar Google Drive'}</span>
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
                            placeholder={t.adminPdFilterPlaceholder || 'Filtrar QID, título, idioma, ano...'}
                            value={pdSearchFilterText}
                            onChange={(e) => setPdSearchFilterText(e.target.value)}
                          />
                        </div>
                      </div>
                      <div className="d-flex align-items-center gap-2">
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-info d-inline-flex align-items-center gap-1"
                          onClick={handleTranslateVisiblePdItems}
                          disabled={isTranslatingPdList || filteredPdProductions.length === 0}
                        >
                          {isTranslatingPdList ? (
                            <Loader2 size={13} className="animate-spin" />
                          ) : (
                            <Languages size={13} />
                          )}
                          <span>Traduzir Títulos/Labels (PT)</span>
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-warning d-inline-flex align-items-center gap-1"
                          onClick={handleLoadImportHistory}
                          disabled={isLoadingImportHistory}
                        >
                          {isLoadingImportHistory ? <Loader2 size={13} className="animate-spin" /> : <History size={13} />}
                          <span>{showImportHistory ? 'Ocultar histórico' : 'Histórico de importações'}</span>
                        </button>
                        <span className="badge bg-secondary">
                          {filteredPdProductions.length} {t.adminPdProductionsCount || 'produção(ões)'}
                        </span>
                      </div>
                    </div>

                    {showImportHistory && (
                      <div className="border border-secondary rounded p-3 mb-3">
                        <div className="d-flex justify-content-between align-items-center mb-2">
                          <strong className="text-warning">Histórico detalhado de importações</strong>
                          <span className="small text-secondary">{importHistory.length} execução(ões)</span>
                        </div>
                        {importHistory.length === 0 ? (
                          <div className="small text-secondary">Nenhuma importação registrada ainda.</div>
                        ) : (
                          <div className="d-flex flex-column gap-2">
                            {importHistory.map((job) => (
                              <details key={job.id} className="border border-secondary rounded p-2">
                                <summary className="small" style={{ cursor: 'pointer' }}>
                                  <strong>{job.details?.wikidataid || 'QID não informado'}</strong>
                                  <span className="text-secondary"> · {job.action === 'insert' ? 'Nova produção' : 'Atualização seletiva'} · {job.created_at ? new Date(job.created_at).toLocaleString('pt-BR') : ''}</span>
                                  <span className={`badge ${job.status === "failed" ? "bg-danger" : "bg-success"} ms-2`}>{job.status}</span>
                                </summary>
                                <div className="small text-secondary mt-2">Responsável: {job.requested_email || '—'} · Origem: {job.source || 'Wikidata'}</div>
                                {job.details?.error && <div className="small text-danger mt-1">Erro: {job.details.error}</div>}
                                {(job.media || []).length > 0 && (
                                  <div className="small mt-2">
                                    <strong>Materiais associados:</strong>
                                    {(job.media || []).map((media: any, index: number) => (
                                      <div key={job.id + '-media-' + index} className="text-secondary">
                                        {media.source} · {media.media_type} · {media.license || 'licença não informada'} · <a href={media.page_url || media.url} target="_blank" rel="noreferrer" className="text-info">Abrir material</a>
                                      </div>
                                    ))}
                                  </div>
                                )}
                                {(job.changes || []).length === 0 ? (
                                  <div className="small text-secondary mt-1">Execução sem alterações de campos (pode conter apenas mídias relacionadas).</div>
                                ) : (
                                  <div className="table-responsive mt-2">
                                    <table className="table table-dark table-sm mb-0">
                                      <thead><tr><th>Campo</th><th>Valor anterior</th><th>Novo valor</th><th>Fonte</th></tr></thead>
                                      <tbody>
                                        {(job.changes || []).map((change: any, index: number) => (
                                          <tr key={`${job.id}-${index}`}>
                                            <td>{change.field_name}</td>
                                            <td className="text-secondary text-break">{JSON.stringify(change.old_value ?? null)}</td>
                                            <td className="text-break">{JSON.stringify(change.new_value ?? null)}</td>
                                            <td>{change.source_url ? <a href={change.source_url} target="_blank" rel="noreferrer" className="text-info">{change.source} <ExternalLink size={10}/></a> : change.source}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                )}
                              </details>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    <div className="table-responsive custom-scrollbar" style={{ maxHeight: '420px' }}>
                      <table className="table table-dark table-sm table-hover align-middle border-secondary mb-0">
                        <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                          <tr>
                            <th>QID</th>
                            <th>{t.adminPdColTitle || 'Título Original (P1476)'}</th>
                            <th>{t.adminPdColInstance || 'Instância'}</th>
                            <th>{t.adminPdColLanguage || 'Idioma'}</th>
                            <th>{t.adminPdColYear || 'Ano'}</th>
                            <th>{t.adminPdColCatalog || 'Catálogo'}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredPdProductions.length === 0 ? (
                            <tr>
                              <td colSpan={6} className="text-center text-secondary py-4">
                                {t.adminPdNoResults || 'Nenhuma produção encontrada com os filtros atuais.'}
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
                                    <div className="d-flex align-items-center gap-2">
                                      <span>{item.originalTitle}</span>
                                      {!item.hasP1476 && (
                                        <span className="badge bg-secondary">Label</span>
                                      )}
                                      {item.posterUrl && (
                                        <span
                                          className="badge bg-dark border border-secondary text-info d-inline-flex align-items-center gap-1"
                                          title={t.adminPdHasP18Title || 'Possui imagem P18 no Wikidata'}
                                        >
                                          <ImageIcon size={11} />
                                          <span>P18</span>
                                        </span>
                                      )}
                                      {item.licenseLabel && item.licenseLabel !== 'Public Domain (Q19652)' && (
                                        <span className="badge bg-dark border border-warning text-warning">
                                          {item.licenseLabel}
                                        </span>
                                      )}
                                    </div>
                                    {item.titlePt && item.titlePt !== item.originalTitle && (
                                      <div className="text-info fw-normal" style={{ fontSize: '0.75rem' }}>
                                        PT: {item.titlePt}
                                      </div>
                                    )}
                                    {(item.descriptionEn) && (
                                      <div
                                        className="text-secondary fw-normal text-truncate"
                                        style={{ maxWidth: '340px', fontSize: '0.72rem' }}
                                      >
                                        {item.descriptionEn}
                                      </div>
                                    )}
                                  </td>
                                  <td className="small">
                                    <span className="badge bg-dark border border-info text-info">
                                      {getTranslatedInstanceLabel(item)} ({item.instanceQid})
                                    </span>
                                  </td>
                                  <td className="small text-white-50">{item.language}</td>
                                  <td className="small text-white-50">{item.year || '—'}</td>
                                  <td className="small">
                                    <div className="d-flex flex-column align-items-start gap-1">
                                      {alreadyExists && <span className="badge bg-success">{t.adminPdAlreadyRegistered || 'Já cadastrado'}</span>}
                                      <button
                                        type="button"
                                        className={`btn btn-sm py-0 px-2 d-inline-flex align-items-center gap-1 ${alreadyExists ? 'btn-outline-info' : 'btn-outline-success'}`}
                                        onClick={() => setReviewingPdItem(item)}
                                        disabled={importingQid === item.wikidataId}
                                      >
                                        {alreadyExists ? <RefreshCw size={12}/> : <PlusCircle size={12}/>}
                                        <span>{alreadyExists ? 'Revisar atualização' : (t.adminPdImport || 'Importar')}</span>
                                      </button>
                                    </div>
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
                    ? 'Wikidata SPARQL • 14 Instâncias P31 • P6216=Q19652 • P1476 • P136 • P921 • P57 • P2047'
                    : 'Wikidata SPARQL • P31=Q5398426 • P6216=Q19652 • P1476'}
                </span>
                <button
                  className="btn btn-outline-secondary"
                  onClick={onClose}
                  disabled={isCheckingCatalog || isSearchingPdProductions}
                >
                  {t.adminPdClose || 'Fechar'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    {reviewingPdItem && (
      <WikidataImportReview
        item={reviewingPdItem}
        existingMovie={movies.find((movie) => movie.wikidataId?.trim().toUpperCase() === reviewingPdItem.wikidataId.toUpperCase())}
        onClose={() => setReviewingPdItem(null)}
        onSaved={() => { setReviewingPdItem(null); onRefresh(); }}
      />
    )}
    </div>
  );
};
