import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  X, Play, Heart, Edit3, Save, Loader2, 
  ImageIcon, Info, User, ChevronLeft, Calendar, Globe, Award, Sparkles, BookOpen, Star, History, ExternalLink, RefreshCw
} from 'lucide-react';
import { Movie, AppLanguage, UserMovieInteraction } from '../types';
import { updateSupabaseMovie } from '../services/supabaseClient';
import { fetchMovieImages } from '../services/wikidataService';
import { getAggregatedMovieDetails, AggregatedMovieDetails } from '../services/movieDetailsService';
import { 
  generateCriticalAnalysis, generateMovieTrivia, generateCriticsSummary, generateCinemaHistory 
} from '../services/geminiService';
import { sendEditToBackend } from '../services/wikidataWriteService';
import { VideoPlayer } from './VideoPlayer';
import { APP_TRANSLATIONS } from '../constants';

interface MovieDetailsModalProps {
  movie: Movie;
  onClose: () => void;
  language: AppLanguage;
  interactions: {
    is_favorite: boolean;
    is_watched: boolean;
    watch_later: boolean;
    progress_seconds: number;
  };
  onToggleInteraction: (field: keyof UserMovieInteraction) => void;
  onRefresh: () => void;
}

type InfoTab = 'overview' | 'technical' | 'analysis' | 'trivia' | 'reviews' | 'history';

export const MovieDetailsModal: React.FC<MovieDetailsModalProps> = ({
  movie, onClose, language, interactions, onToggleInteraction, onRefresh
}) => {
  const t = APP_TRANSLATIONS[language] || APP_TRANSLATIONS['en'];
  
  const [isPlayerActive, setIsPlayerActive] = useState(false);
  const [isEditingTags, setIsEditingTags] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [activeTab, setActiveTab] = useState<InfoTab>('overview');
  const [isSaving, setIsSaving] = useState(false);
  const [galleryImages, setGalleryImages] = useState<string[]>([]);
  const [isLoadingGallery, setIsLoadingGallery] = useState(false);
  
  const [details, setDetails] = useState<AggregatedMovieDetails | null>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  
  const [aiAnalysis, setAiAnalysis] = useState('');
  const [aiTrivia, setAiTrivia] = useState<string[]>([]);
  const [aiReviews, setAiReviews] = useState('');
  const [aiHistory, setAiHistory] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);

  const [formData, setFormData] = useState({
    genres: Array.isArray(movie.genres) ? movie.genres.join(', ') : '',
    themes: Array.isArray(movie.themes) ? (movie.themes || []).join(', ') : '',
    videoUrl: movie.videoUrl || '',
    wikidataId: movie.wikidataId || '',
    title: movie.title,
    description: movie.description,
    posterUrl: movie.posterUrl || '',
    year: movie.year || '',
    director: movie.director || '',
    duration: movie.duration || '',
    awards: Array.isArray(movie.awards) ? movie.awards.join(', ') : '',
    language: movie.language || '',
    backendUrl: '', // URL para o serviço de escrita no Wikidata
    syncToWikidata: false
  });

  const fixUrl = (url: string) => url ? url.replace('http://', 'https://') : '';

  useEffect(() => {
    const loadGallery = async () => {
      setIsLoadingGallery(true);
      const images = await fetchMovieImages(movie.wikidataId || movie.title);
      setGalleryImages(images.map(fixUrl));
      setIsLoadingGallery(false);
    };
    loadGallery();
  }, [movie]);

  const handleOpenInfo = async () => {
    setShowInfoModal(true);
    if (!details) {
        setIsLoadingDetails(true);
        try { 
            const agg = await getAggregatedMovieDetails(movie); 
            setDetails(agg); 
        } catch (e) { console.error(e); } finally { setIsLoadingDetails(false); }
    }
  };

  useEffect(() => {
    const loadAiTabContent = async () => {
        if (!showInfoModal) return;
        setIsAiLoading(true);
        try {
            if (activeTab === 'analysis' && !aiAnalysis) setAiAnalysis(await generateCriticalAnalysis(movie.title, movie.year, language));
            else if (activeTab === 'trivia' && aiTrivia.length === 0) setAiTrivia(await generateMovieTrivia(movie.title, movie.year));
            else if (activeTab === 'reviews' && !aiReviews) setAiReviews(await generateCriticsSummary(movie.title, movie.year, language));
            else if (activeTab === 'history' && !aiHistory) setAiHistory(await generateCinemaHistory(movie.title, movie.year, language));
        } catch (e) { console.error(e); } finally { setIsAiLoading(false); }
    };
    loadAiTabContent();
  }, [activeTab, showInfoModal, movie, language]);

  const handleSaveTags = async () => {
    setIsSaving(true);
    try {
      const updates = {
        genres: formData.genres.split(',').map(s => s.trim()).filter(Boolean),
        themes: formData.themes.split(',').map(s => s.trim()).filter(Boolean),
        awards: formData.awards.split(',').map(s => s.trim()).filter(Boolean),
        videoUrl: fixUrl(formData.videoUrl),
        wikidataId: formData.wikidataId,
        title: formData.title,
        description: formData.description,
        posterUrl: fixUrl(formData.posterUrl),
        year: Number(formData.year),
        director: formData.director,
        duration: formData.duration,
        language: formData.language
      };

      // 1. Atualizar no Supabase
      await updateSupabaseMovie(movie.id, movie.wikidataId, updates);

      // 2. Sincronizar com Wikidata se solicitado e tiver URL de backend
      if (formData.syncToWikidata && formData.backendUrl && movie.wikidataId) {
          try {
              await sendEditToBackend(formData.backendUrl, {
                  qid: movie.wikidataId,
                  description: updates.description,
                  language: 'en'
              });
          } catch (wikiErr) {
              console.warn("Wikidata sync failed, but database was updated.", wikiErr);
          }
      }

      setIsEditingTags(false);
      onRefresh(); 
    } catch (error) { alert("Erro ao atualizar."); } finally { setIsSaving(false); }
  };

  const renderInfoModalContent = () => (
    <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.95)', zIndex: 1100 }}>
        <div className="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable" style={{ maxWidth: '90vw' }}>
            <div className="modal-content bg-dark border-secondary shadow-lg overflow-hidden" style={{ minHeight: '80vh' }}>
                <div className="modal-header border-secondary d-flex justify-content-between align-items-center py-3 bg-black">
                    <div className="d-flex align-items-center gap-3">
                        <button className="btn btn-sm btn-outline-light rounded-circle" onClick={() => setShowInfoModal(false)}> <ChevronLeft size={20} /> </button>
                        <h4 className="m-0 text-white fw-bold">Mais Informações: <span className="text-danger">{movie.titlePt || movie.title}</span></h4>
                    </div>
                    <button className="btn btn-icon text-white" onClick={() => setShowInfoModal(false)}> <X size={32} /> </button>
                </div>

                <div className="modal-body p-4 p-lg-5 custom-scrollbar">
                    <ul className="nav nav-tabs border-secondary mb-4 gap-2 flex-nowrap overflow-auto pb-1">
                        {[
                            { id: 'overview', label: 'Geral', icon: <Info size={16}/> },
                            { id: 'technical', label: 'Técnico', icon: <Award size={16}/> },
                            { id: 'analysis', label: 'Análise IA', icon: <Sparkles size={16}/> },
                            { id: 'trivia', label: 'Curiosidades', icon: <BookOpen size={16}/> },
                            { id: 'reviews', label: 'Crítica', icon: <Star size={16}/> },
                            { id: 'history', label: 'História', icon: <History size={16}/> }
                        ].map(tab => (
                            <li key={tab.id} className="nav-item">
                                <button className={`nav-link border-0 text-white d-flex align-items-center gap-2 small px-3 py-2 ${activeTab === tab.id ? 'active bg-danger fw-bold rounded shadow' : 'bg-transparent opacity-75'}`} onClick={() => setActiveTab(tab.id as any)}>
                                    {tab.icon} {tab.label}
                                </button>
                            </li>
                        ))}
                    </ul>

                    <div className="tab-content text-light">
                        {isLoadingDetails ? (
                            <div className="text-center py-5"><Loader2 className="animate-spin text-danger mx-auto" size={40} /></div>
                        ) : (
                            <div className="animate-in">
                                {activeTab === 'overview' && (
                                    <div className="row g-4">
                                        <div className="col-md-8">
                                            <h5 className="text-danger mb-3 border-bottom border-secondary pb-2">Sinopse</h5>
                                            <p className="lh-lg opacity-75">{movie.descriptionPt || movie.description}</p>
                                            
                                            <h5 className="text-danger mt-5 mb-3 d-flex align-items-center gap-2 border-bottom border-secondary pb-2"> <ImageIcon size={18}/> Galeria {isLoadingGallery && <Loader2 className="animate-spin" size={14}/>}</h5>
                                            <div className="d-flex gap-3 overflow-auto pb-3 custom-scrollbar">
                                                {galleryImages.map((img, idx) => (
                                                    <img key={idx} src={img} className="rounded border border-secondary shadow-sm" style={{ height: '160px', minWidth: '240px', objectFit: 'cover' }} />
                                                ))}
                                                {galleryImages.length === 0 && <p className="text-white-50 small opacity-50">Nenhuma imagem adicional encontrada.</p>}
                                            </div>

                                            <h5 className="text-danger mt-5 mb-3 border-bottom border-secondary pb-2">Links Externos</h5>
                                            <div className="d-flex gap-2 flex-wrap">
                                                {movie.wikidataId && (
                                                    <a href={`https://www.wikidata.org/wiki/${movie.wikidataId}`} target="_blank" className="btn btn-sm btn-outline-warning d-flex align-items-center gap-2"> <ExternalLink size={14}/> Wikidata </a>
                                                )}
                                                {movie.wikidataId?.startsWith('tt') && (
                                                    <a href={`https://www.imdb.com/title/${movie.wikidataId}`} target="_blank" className="btn btn-sm btn-outline-warning d-flex align-items-center gap-2"> <ExternalLink size={14}/> IMDb </a>
                                                )}
                                                {movie.videoUrl?.includes('archive.org') && (
                                                    <a href={movie.videoUrl} target="_blank" className="btn btn-sm btn-outline-info d-flex align-items-center gap-2"> <ExternalLink size={14}/> Archive.org </a>
                                                )}
                                                <a href={`https://www.google.com/search?q=${encodeURIComponent((movie.titlePt || movie.title) + " " + movie.year + " filme")}`} target="_blank" className="btn btn-sm btn-outline-light d-flex align-items-center gap-2"> <ExternalLink size={14}/> Google Search </a>
                                            </div>
                                        </div>
                                        <div className="col-md-4">
                                            <div className="bg-black bg-opacity-50 p-4 rounded border border-secondary shadow">
                                                <h6 className="text-danger uppercase xsmall fw-bold mb-3 tracking-wider">Metadados Rápidos</h6>
                                                <div className="d-flex flex-column gap-3 small">
                                                    <div className="d-flex justify-content-between border-bottom border-secondary pb-2"><span className="opacity-50">Título Original</span><span className="text-end">{movie.originalTitle || movie.title}</span></div>
                                                    <div className="d-flex justify-content-between border-bottom border-secondary pb-2"><span className="opacity-50">Diretor</span><span className="text-end">{movie.director}</span></div>
                                                    <div className="d-flex justify-content-between border-bottom border-secondary pb-2"><span className="opacity-50">Ano</span><span className="text-end">{movie.year}</span></div>
                                                    <div className="d-flex justify-content-between border-bottom border-secondary pb-2"><span className="opacity-50">QID</span><span className="text-warning font-monospace text-end">{movie.wikidataId}</span></div>
                                                    <div className="d-flex justify-content-between"><span className="opacity-50">Diretor QID</span><span className="text-info font-monospace text-end">{movie.directorId || 'N/A'}</span></div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                                {activeTab === 'technical' && (
                                    <div className="row g-4">
                                        <div className="col-md-8">
                                            <div className="row g-4">
                                                <div className="col-12"><h6 className="text-danger xsmall fw-bold mb-2 uppercase">ELENCO PRINCIPAL</h6><p className="opacity-75">{details?.cast.join(', ') || 'N/A'}</p></div>
                                                <div className="col-md-6"><h6 className="text-danger xsmall fw-bold mb-2 uppercase">PRODUTORES</h6><p className="opacity-75">{details?.producers?.join(', ') || 'N/A'}</p></div>
                                                <div className="col-md-6"><h6 className="text-danger xsmall fw-bold mb-2 uppercase">FOTOGRAFIA</h6><p className="opacity-75">{details?.cinematographers?.join(', ') || 'N/A'}</p></div>
                                                <div className="col-md-6"><h6 className="text-danger xsmall fw-bold mb-2 uppercase">PAÍSES DE ORIGEM</h6><p className="opacity-75">{details?.countries?.join(', ') || 'N/A'}</p></div>
                                                <div className="col-md-6"><h6 className="text-danger xsmall fw-bold mb-2 uppercase">DISTRIBUIÇÃO</h6><p className="opacity-75">{details?.distributors?.join(', ') || 'N/A'}</p></div>
                                            </div>
                                        </div>
                                        <div className="col-md-4">
                                            <div className="bg-black bg-opacity-25 p-4 rounded border border-secondary">
                                                <h6 className="text-white-50 xsmall fw-bold mb-3 uppercase">FICHA TÉCNICA</h6>
                                                <ul className="list-unstyled small d-flex flex-column gap-2 m-0">
                                                    <li><span className="opacity-50">Duração:</span> {movie.duration}</li>
                                                    <li><span className="opacity-50">Cor:</span> {details?.color || 'N/A'}</li>
                                                    <li><span className="opacity-50">Idioma:</span> {movie.language}</li>
                                                    <li><span className="opacity-50">Classificação:</span> {movie.rating}</li>
                                                </ul>
                                            </div>
                                        </div>
                                    </div>
                                )}
                                {(activeTab === 'analysis' || activeTab === 'reviews' || activeTab === 'history') && (
                                    <div className="bg-black bg-opacity-25 p-4 p-lg-5 rounded border border-secondary shadow">
                                        {isAiLoading ? <Loader2 className="animate-spin text-danger mx-auto" size={32} /> : (
                                            <div className="lh-lg markdown-content" dangerouslySetInnerHTML={{ __html: (activeTab === 'analysis' ? aiAnalysis : activeTab === 'reviews' ? aiReviews : aiHistory).replace(/\*\*(.*?)\*\*/g, '<b>$1</b>').replace(/\n/g, '<br/>') }} />
                                        )}
                                    </div>
                                )}
                                {activeTab === 'trivia' && (
                                    <div className="row g-3">
                                        {isAiLoading ? <Loader2 className="animate-spin text-danger mx-auto" /> : aiTrivia.map((t, i) => (
                                            <div key={i} className="col-md-6"><div className="bg-dark p-4 rounded border border-secondary border-start border-start-danger shadow-sm h-100" style={{ borderLeftWidth: '5px' }}> <BookOpen size={16} className="text-danger mb-2"/> <p className="m-0 small">{t}</p></div></div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    </div>
  );

  if (isPlayerActive && movie.videoUrl) {
    return <VideoPlayer id={movie.id} src={movie.videoUrl} poster={movie.posterUrl} title={movie.titlePt || movie.title} initialTime={interactions.progress_seconds} onClose={() => setIsPlayerActive(false)} />;
  }

  return (
    <>
      <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.95)', zIndex: 1055 }}>
        <div className="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable">
          <div className="modal-content bg-dark border-secondary shadow-lg overflow-hidden" style={{ minHeight: '70vh' }}>
            
            <div className="modal-hero position-relative">
              <div className="w-100 h-100" style={{ backgroundImage: `url("${fixUrl(movie.posterUrl)}")`, backgroundSize: 'cover', backgroundPosition: 'center 20%' }}>
                <div className="position-absolute top-0 start-0 w-100 h-100" style={{ background: 'linear-gradient(to bottom, rgba(20,20,20,0.1) 0%, rgba(20,20,20,1) 100%)' }}></div>
              </div>
              <button className="btn-close btn-close-white position-absolute top-0 end-0 m-4 z-3 shadow-none" onClick={onClose}></button>
              <div className="modal-hero-content">
                <h1 className="display-4 fw-bold text-white text-shadow">{movie.titlePt || movie.title}</h1>
                <div className="d-flex align-items-center gap-3 text-white-50 small mb-3">
                   <span className="badge bg-danger">{movie.rating || 'N/A'}</span>
                   <span>{movie.year}</span>
                   <span>{movie.duration}</span>
                   <span className="border border-secondary px-2 rounded">{movie.type}</span>
                </div>
              </div>
            </div>

            <div className="modal-body p-4 p-lg-5">
              {isEditingTags ? (
                  <div className="animate-in">
                     <div className="bg-dark bg-opacity-50 p-4 rounded border border-secondary mb-4 shadow-lg">
                        <h5 className="text-danger mb-4 border-bottom border-secondary pb-3 d-flex align-items-center gap-2"><Edit3 size={18}/>Editar Metadados</h5>
                        <div className="row g-3">
                          <div className="col-12"><label className="form-label text-white-50 small">Título</label><input className="form-control bg-black text-white border-secondary shadow-none" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} /></div>
                          <div className="col-md-4"><label className="form-label text-white-50 small">Ano</label><input type="number" className="form-control bg-black text-white border-secondary shadow-none" value={formData.year} onChange={e => setFormData({...formData, year: e.target.value})} /></div>
                          <div className="col-md-4"><label className="form-label text-white-50 small">Idioma</label><input className="form-control bg-black text-white border-secondary shadow-none" value={formData.language} onChange={e => setFormData({...formData, language: e.target.value})} /></div>
                          <div className="col-md-4"><label className="form-label text-white-50 small">Duração</label><input className="form-control bg-black text-white border-secondary shadow-none" value={formData.duration} onChange={e => setFormData({...formData, duration: e.target.value})} /></div>
                          <div className="col-12">
                            <label className="form-label text-white-50 small d-flex justify-content-between">Diretor {movie.directorId && <span className="text-warning font-monospace small">QID: {movie.directorId}</span>}</label>
                            <input className="form-control bg-black text-white border-secondary shadow-none" value={formData.director} onChange={e => setFormData({...formData, director: e.target.value})} />
                          </div>
                          <div className="col-12"><label className="form-label text-white-50 small">Link do Vídeo</label><input className="form-control bg-black text-white border-secondary shadow-none" value={formData.videoUrl} onChange={e => setFormData({...formData, videoUrl: e.target.value})} /></div>
                          <div className="col-12"><label className="form-label text-white-50 small">Descrição</label><textarea className="form-control bg-black text-white border-secondary shadow-none" rows={4} value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} /></div>
                          
                          <div className="col-12 border-top border-secondary pt-3 mt-3">
                             <h6 className="text-warning small fw-bold mb-3 d-flex align-items-center gap-2"><RefreshCw size={14}/> Sincronização Wikidata</h6>
                             <div className="row g-2">
                                <div className="col-md-8">
                                    <label className="form-label text-white-50 small">URL do Backend Replit (Opcional)</label>
                                    <input className="form-control form-control-sm bg-black text-white border-secondary shadow-none" value={formData.backendUrl} onChange={e => setFormData({...formData, backendUrl: e.target.value})} placeholder="https://seu-proxy.repl.co" />
                                </div>
                                <div className="col-md-4 d-flex align-items-end pb-1">
                                    <div className="form-check form-switch">
                                        <input className="form-check-input" type="checkbox" role="switch" checked={formData.syncToWikidata} onChange={e => setFormData({...formData, syncToWikidata: e.target.checked})} />
                                        <label className="form-check-label text-white small">Sincronizar ao Salvar</label>
                                    </div>
                                </div>
                             </div>
                          </div>

                          <div className="col-12 d-flex justify-content-end gap-2 mt-4">
                               <button className="btn btn-outline-secondary px-4" onClick={() => setIsEditingTags(false)}>Cancelar</button>
                               <button className="btn btn-success px-4" onClick={handleSaveTags} disabled={isSaving}>{isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Salvar</button>
                          </div>
                        </div>
                     </div>
                  </div>
              ) : (
                  <div className="row g-5 animate-in">
                    <div className="col-lg-8">
                      <div className="d-flex gap-3 mb-4 flex-wrap">
                          <button className="btn btn-primary-custom px-4 py-2 fw-bold d-flex align-items-center gap-2 shadow" onClick={() => setIsPlayerActive(true)} disabled={!movie.videoUrl}><Play fill="white" size={20} /> Assistir</button>
                          <button className={`btn border-secondary ${interactions.is_favorite ? 'btn-danger border-danger' : 'btn-outline-light'}`} onClick={() => onToggleInteraction('is_favorite')}><Heart fill={interactions.is_favorite ? "white" : "none"} size={20} /></button>
                          <button className="btn btn-outline-light" onClick={handleOpenInfo}><Info size={20} className="me-2"/>{t.moreInfo}</button>
                          <button className="btn btn-outline-secondary" onClick={() => setIsEditingTags(true)}><Edit3 size={18} /></button>
                      </div>
                      <p className="lead text-white lh-base mb-4" style={{ fontSize: '1.1rem' }}>{movie.descriptionPt || movie.description}</p>
                    </div>
                    <div className="col-lg-4">
                      <div className="bg-dark bg-opacity-25 p-4 rounded border border-secondary shadow-sm">
                          <h6 className="text-danger text-uppercase xsmall fw-bold mb-4 border-bottom border-secondary pb-2 tracking-wider">Metadados Principais</h6>
                          <dl className="row g-0 small">
                              <dt className="col-4 text-white-50 mb-3"><User size={14} className="me-2"/>Diretor</dt>
                              <dd className="col-8 text-white mb-3">{movie.director} {movie.directorId && <span className="text-white-50 xsmall font-monospace">({movie.directorId})</span>}</dd>
                              <dt className="col-4 text-white-50 mb-3"><Calendar size={14} className="me-2"/>Ano</dt><dd className="col-8 text-white mb-3">{movie.year}</dd>
                              <dt className="col-4 text-white-50 mb-3"><Globe size={14} className="me-2"/>Idioma</dt><dd className="col-8 text-white mb-3">{movie.language}</dd>
                              <dt className="col-4 text-white-50 mb-3"><Award size={14} className="me-2"/>Gêneros</dt><dd className="col-8 text-white mb-3">{Array.isArray(movie.genres) ? movie.genres.join(', ') : 'N/A'}</dd>
                          </dl>
                          <div className="mt-4 pt-4 border-top border-secondary text-end">
                              <span className="badge bg-black border border-secondary text-warning font-monospace">{movie.wikidataId || 'N/A'}</span>
                          </div>
                      </div>
                    </div>
                  </div>
              )}
            </div>
          </div>
        </div>
      </div>
      {showInfoModal && createPortal(renderInfoModalContent(), document.body)}
    </>
  );
};