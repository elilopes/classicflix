
import React, { useState, useEffect } from 'react';
import { 
  X, Play, Heart, Share2, Edit3, Save, Loader2, 
  Flag, Globe, Calendar, Clock, Film, Hash, 
  Video, Wand2, Plus, Trash2, Image as ImageIcon,
  LayoutGrid, Users, Camera, Music, Palette, Tags,
  CheckCircle, AlertTriangle, MonitorPlay, Info, Youtube, User,
  Lightbulb, Link as LinkIcon, Book, Database, ExternalLink,
  BrainCircuit, MessageSquareQuote, Server, MapPin, Building,
  Paintbrush, Clapperboard, Briefcase, FileText
} from 'lucide-react';
import { Movie, AppLanguage, UserMovieInteraction } from '../types';
import { updateSupabaseMovie } from '../services/supabaseClient';
import { fetchMovieImages } from '../services/wikidataService';
import { getAggregatedMovieDetails, AggregatedMovieDetails } from '../services/movieDetailsService';
import { generateMovieTrivia, generateCriticalAnalysis, generateCriticsSummary } from '../services/geminiService';
import { fetchRottenTomatoesData, RTResult } from '../services/rottenTomatoesService';
import { sendEditToBackend } from '../services/wikidataWriteService';
import { VideoPlayer } from './VideoPlayer';
import { APP_TRANSLATIONS, COLORS } from '../constants';

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

export const MovieDetailsModal: React.FC<MovieDetailsModalProps> = ({
  movie,
  onClose,
  language,
  interactions,
  onToggleInteraction,
  onRefresh
}) => {
  const t = APP_TRANSLATIONS[language] || APP_TRANSLATIONS['en'];
  
  const modalT = {
    details: language === 'pt' ? 'Detalhes' : 'Details',
    trivia: language === 'pt' ? 'Curiosidades' : 'Trivia',
    links: language === 'pt' ? 'Links' : 'Links',
    analysis: language === 'pt' ? 'Análise IA' : 'AI Analysis',
    critics: language === 'pt' ? 'Crítica' : 'Critics',
    cast: language === 'pt' ? 'Elenco' : 'Cast',
    crew: language === 'pt' ? 'Equipe Técnica' : 'Crew',
    themes: language === 'pt' ? 'Temas' : 'Themes',
    cinematography: language === 'pt' ? 'Cinematografia' : 'Cinematography',
    music: language === 'pt' ? 'Música' : 'Music',
    noTrivia: language === 'pt' ? 'Nenhuma curiosidade disponível.' : 'No trivia available.',
    externalSources: language === 'pt' ? 'Fontes Externas' : 'External Sources',
    
    // New Labels
    originalTitle: language === 'pt' ? 'Título Original' : 'Original Title',
    country: language === 'pt' ? 'País de Origem' : 'Country of Origin',
    producers: language === 'pt' ? 'Produção' : 'Producers',
    distributors: language === 'pt' ? 'Distribuição / Estúdio' : 'Distributors / Studio',
    artDir: language === 'pt' ? 'Direção de Arte' : 'Art Direction',
    basedOn: language === 'pt' ? 'Baseado em' : 'Based on',
    color: language === 'pt' ? 'Cor' : 'Color'
  };
  
  const [isPlayerActive, setIsPlayerActive] = useState(false);
  const [isEditingTags, setIsEditingTags] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [galleryImages, setGalleryImages] = useState<string[]>([]);
  const [isLoadingGallery, setIsLoadingGallery] = useState(false);

  const [showInfoModal, setShowInfoModal] = useState(false);
  const [showTrailerModal, setShowTrailerModal] = useState(false);
  
  const [infoTab, setInfoTab] = useState<'details' | 'trivia' | 'links' | 'analysis' | 'critics'>('details');
  
  // Data States
  const [details, setDetails] = useState<AggregatedMovieDetails | null>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  
  const [trivia, setTrivia] = useState<string[]>([]);
  const [isLoadingTrivia, setIsLoadingTrivia] = useState(false);
  
  const [analysisText, setAnalysisText] = useState<string>('');
  const [isLoadingAnalysis, setIsLoadingAnalysis] = useState(false);
  
  const [criticsText, setCriticsText] = useState<string>('');
  const [rtData, setRtData] = useState<RTResult | null>(null);
  const [isLoadingCritics, setIsLoadingCritics] = useState(false);

  // Replit Backend State
  const [backendUrl, setBackendUrl] = useState('');
  const [isSavingToWikidata, setIsSavingToWikidata] = useState(false);

  // Edit Form State
  const [formData, setFormData] = useState({
    genres: Array.isArray(movie.genres) ? movie.genres.join(', ') : '',
    themes: Array.isArray(movie.themes) ? (movie.themes || []).join(', ') : '',
    videoUrl: movie.videoUrl || '',
    wikidataId: movie.wikidataId || '',
    title: movie.title,
    description: movie.description
  });

  useEffect(() => {
    // Load gallery images based on Wikidata ID or Title
    const loadGallery = async () => {
      setIsLoadingGallery(true);
      const query = movie.wikidataId || movie.title;
      const images = await fetchMovieImages(query);
      setGalleryImages(images);
      setIsLoadingGallery(false);
    };
    loadGallery();
  }, [movie]);

  const handleOpenInfo = async () => {
    setShowInfoModal(true);
    setInfoTab('details');

    if (!details) {
        setIsLoadingDetails(true);
        try {
            const aggregated = await getAggregatedMovieDetails(movie);
            setDetails(aggregated);
        } catch (e) {
            console.error("Error fetching details", e);
            // Fallback to basic movie props if service fails
            setDetails({
                title: movie.title,
                description: movie.description,
                year: movie.year,
                posterUrl: movie.posterUrl,
                director: movie.director,
                cast: movie.cast || [],
                genres: movie.genres || [],
                themes: movie.themes || [],
                duration: movie.duration,
                rating: movie.rating,
                cinematographers: movie.cinematographers || [],
                composers: movie.composers || [],
                awards: movie.awards || []
            });
        } finally {
            setIsLoadingDetails(false);
        }
    }
  };
  
  useEffect(() => {
      if (!showInfoModal) return;

      const loadTrivia = async () => {
        if (infoTab === 'trivia' && trivia.length === 0) {
            setIsLoadingTrivia(true);
            try {
                const facts = await generateMovieTrivia(movie.title, movie.year);
                setTrivia(facts);
            } catch (e) { console.error(e); } finally { setIsLoadingTrivia(false); }
        }
      };

      const loadAnalysis = async () => {
        if (infoTab === 'analysis' && !analysisText) {
            setIsLoadingAnalysis(true);
            try {
                const text = await generateCriticalAnalysis(movie.title, movie.year, language);
                setAnalysisText(text);
            } catch(e) { console.error(e); } finally { setIsLoadingAnalysis(false); }
        }
      };

      const loadCritics = async () => {
        if (infoTab === 'critics' && !criticsText && !rtData) {
            setIsLoadingCritics(true);
            try {
                // Parallel fetch
                const [text, rt] = await Promise.all([
                    generateCriticsSummary(movie.title, movie.year, language),
                    fetchRottenTomatoesData(movie.title)
                ]);
                setCriticsText(text);
                setRtData(rt);
            } catch(e) { console.error(e); } finally { setIsLoadingCritics(false); }
        }
      };

      if (infoTab === 'trivia') loadTrivia();
      if (infoTab === 'analysis') loadAnalysis();
      if (infoTab === 'critics') loadCritics();

  }, [infoTab, showInfoModal, movie, trivia.length, analysisText, criticsText, rtData, language]);

  const handleSaveTags = async () => {
    setIsSaving(true);
    try {
      const updates = {
        genres: formData.genres.split(',').map(s => s.trim()).filter(Boolean),
        themes: formData.themes.split(',').map(s => s.trim()).filter(Boolean),
        videoUrl: formData.videoUrl,
        wikidataId: formData.wikidataId,
        title: formData.title,
        description: formData.description
      };

      await updateSupabaseMovie(movie.id, movie.wikidataId, updates);
      setIsEditingTags(false);
      onRefresh(); 
    } catch (error) {
      console.error("Error updating movie:", error);
      alert("Failed to update movie details.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleWikidataSync = async () => {
      if (!backendUrl) {
          alert("Por favor, insira a URL do seu Backend Replit.");
          return;
      }
      if (!formData.wikidataId || !formData.wikidataId.startsWith('Q')) {
          alert("ID do Wikidata inválido.");
          return;
      }

      setIsSavingToWikidata(true);
      try {
          // Prepare payload (Example: adding IMDb ID if stored in wikidataId field temporarily, or just testing)
          const payload = {
              qid: formData.wikidataId,
              data: {}
          };

          const result = await sendEditToBackend(backendUrl, payload);
          alert("Sucesso! Wikidata atualizado via Backend.");
          console.log(result);
      } catch (e: any) {
          alert("Erro ao editar Wikidata: " + e.message);
      } finally {
          setIsSavingToWikidata(false);
      }
  };

  const getLocalizedTitle = () => {
    if (language === 'pt' && movie.titlePt) return movie.titlePt;
    return movie.title;
  };

  const getLocalizedDescription = () => {
    if (language === 'pt' && movie.descriptionPt) return movie.descriptionPt;
    if (language === 'hi' && movie.descriptionHi) return movie.descriptionHi;
    if (language === 'ru' && movie.descriptionRu) return movie.descriptionRu;
    if (language === 'it' && movie.descriptionIt) return movie.descriptionIt;
    return movie.description;
  };

  const getTrailerEmbedUrl = (url: string) => {
      if (!url) return '';
      if (url.includes('youtube.com/watch?v=')) {
          return url.replace('watch?v=', 'embed/');
      }
      if (url.includes('youtu.be/')) {
          const id = url.split('youtu.be/')[1];
          return `https://www.youtube.com/embed/${id}`;
      }
      return url;
  };

  if (isPlayerActive && movie.videoUrl) {
    return (
      <VideoPlayer 
        id={movie.id}
        src={movie.videoUrl} 
        poster={movie.posterUrl} 
        title={getLocalizedTitle()}
        initialTime={interactions.progress_seconds}
        onClose={() => setIsPlayerActive(false)} 
      />
    );
  }

  // Fallback if details aren't loaded yet
  const displayDetails = details || {
      cast: movie.cast || [],
      cinematographers: movie.cinematographers || [],
      composers: movie.composers || [],
      themes: movie.themes || [],
      awards: movie.awards || []
  };
  
  const finalCast = (displayDetails.cast && displayDetails.cast.length > 0) ? displayDetails.cast : (movie.cast || []);
  const finalCinematographers = (displayDetails.cinematographers && displayDetails.cinematographers.length > 0) ? displayDetails.cinematographers : (movie.cinematographers || []);
  const finalComposers = (displayDetails.composers && displayDetails.composers.length > 0) ? displayDetails.composers : (movie.composers || []);
  const finalThemes = (displayDetails.themes && displayDetails.themes.length > 0) ? displayDetails.themes : (movie.themes || []);

  const renderList = (items: string[] | undefined, fallback = "N/A") => {
      if (!items || items.length === 0) return <span className="text-white-50 small">{fallback}</span>;
      return (
        <div className="d-flex flex-wrap gap-2">
            {items.map(item => (
                <span key={item} className="badge bg-dark border border-secondary fw-normal text-white-50">{item}</span>
            ))}
        </div>
      );
  };

  return (
    <>
    <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.9)', zIndex: 1055 }} tabIndex={-1}>
      <div className="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable">
        <div className="modal-content modal-content-custom bg-dark border-secondary shadow-lg overflow-hidden">
          
          {/* Hero Section */}
          <div className="modal-hero position-relative">
            <div 
              className="w-100 h-100" 
              style={{ 
                backgroundImage: `url("${movie.posterUrl}")`,
                backgroundSize: 'cover',
                backgroundPosition: 'center 20%'
              }}
            >
              <div className="position-absolute top-0 start-0 w-100 h-100" style={{ background: 'linear-gradient(to bottom, rgba(20,20,20,0.2) 0%, rgba(20,20,20,1) 100%)' }}></div>
            </div>
            
            <button 
              type="button" 
              className="btn-close btn-close-white position-absolute top-0 end-0 m-4 z-3" 
              onClick={onClose}
              style={{ filter: 'drop-shadow(0px 0px 5px black)' }}
            ></button>

            <div className="modal-hero-content d-flex flex-column gap-3">
              <h1 className="display-4 fw-bold text-white text-shadow">{getLocalizedTitle()}</h1>
              <div className="d-flex align-items-center gap-3 text-white-50 text-shadow small flex-wrap">
                 <span className="badge bg-danger">{movie.rating}</span>
                 <span>{movie.year}</span>
                 <span>{movie.duration}</span>
                 <span className="border border-secondary px-2 rounded">{movie.type}</span>
                 {movie.hasSubtitles && <span className="d-flex align-items-center gap-1"><MonitorPlay size={14}/> CC</span>}
              </div>
              <div className="d-flex gap-2 flex-wrap">
                 {Array.isArray(movie.genres) && movie.genres.slice(0, 3).map(g => (
                    <span key={g} className="badge bg-dark border border-secondary text-light fw-normal">{g}</span>
                 ))}
              </div>
            </div>
          </div>

          <div className="modal-body p-4 p-lg-5">
            <div className="row g-5">
              
              {/* Left Column: Description & Actions */}
              <div className="col-lg-8">
                {isEditingTags ? (
                   <div className="bg-dark bg-opacity-50 p-4 rounded border border-secondary mb-4">
                      {/* ... (Existing Editing UI kept as is) ... */}
                      <h5 className="text-primary-custom mb-3 d-flex align-items-center gap-2"><Edit3 size={18} /> Editar Metadados</h5>
                      <div className="row g-3">
                        <div className="col-12">
                            <label className="form-label text-white-50 small">Título</label>
                            <input type="text" className="form-control bg-black text-white border-secondary" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} />
                        </div>
                         <div className="col-12">
                            <label className="form-label text-white-50 small">Descrição</label>
                            <textarea className="form-control bg-black text-white border-secondary" rows={3} value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
                        </div>
                        <div className="col-md-6">
                            <label className="form-label text-white-50 small">Gêneros (sep. por vírgula)</label>
                            <input type="text" className="form-control bg-black text-white border-secondary" value={formData.genres} onChange={e => setFormData({...formData, genres: e.target.value})} />
                        </div>
                        <div className="col-md-6">
                            <label className="form-label text-white-50 small">Temas (sep. por vírgula)</label>
                            <input type="text" className="form-control bg-black text-white border-secondary" value={formData.themes} onChange={e => setFormData({...formData, themes: e.target.value})} />
                        </div>
                        
                        <div className="col-12">
                            <label className="form-label text-white-50 small">Wikidata ID (QID)</label>
                            <div className="input-group">
                                <span className="input-group-text bg-secondary border-secondary text-white"><Database size={14} /></span>
                                <input type="text" className="form-control bg-black text-white border-secondary" value={formData.wikidataId} onChange={e => setFormData({...formData, wikidataId: e.target.value})} />
                            </div>
                        </div>

                        {/* REPLIT BACKEND SECTION */}
                        <div className="col-12 mt-3 pt-3 border-top border-secondary">
                             <h6 className="text-white-50 small mb-2 d-flex align-items-center gap-2"><Server size={14}/> Configuração Replit Backend (Opcional)</h6>
                             <div className="input-group mb-2">
                                <span className="input-group-text bg-dark border-secondary text-white-50">URL</span>
                                <input 
                                    type="text" 
                                    className="form-control bg-black text-white border-secondary" 
                                    placeholder="https://seu-backend.replit.co"
                                    value={backendUrl}
                                    onChange={e => setBackendUrl(e.target.value)}
                                />
                                <button 
                                    className="btn btn-outline-warning d-flex align-items-center gap-2"
                                    onClick={handleWikidataSync}
                                    disabled={isSavingToWikidata || !backendUrl}
                                >
                                    {isSavingToWikidata ? <Loader2 size={16} className="animate-spin"/> : <Globe size={16}/>}
                                    Sync Wikidata
                                </button>
                             </div>
                        </div>

                        <div className="col-12 d-flex justify-content-end gap-2 mt-3">
                             <button className="btn btn-outline-secondary btn-sm" onClick={() => setIsEditingTags(false)}>Cancelar</button>
                             <button className="btn btn-success btn-sm d-flex align-items-center gap-2" onClick={handleSaveTags} disabled={isSaving}>
                                {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Salvar no Supabase
                             </button>
                        </div>
                      </div>
                   </div>
                ) : (
                    <>
                        <div className="d-flex gap-3 mb-4 flex-wrap">
                            <button 
                                className="btn btn-primary-custom px-4 py-2 fw-bold d-flex align-items-center gap-2 shadow"
                                onClick={() => setIsPlayerActive(true)}
                                disabled={!movie.videoUrl}
                            >
                                <Play fill="white" size={20} /> {t.viewMode === 'View Mode' ? 'Watch' : 'Assistir'}
                            </button>
                            <button 
                                className={`btn border-secondary d-flex align-items-center gap-2 ${interactions.is_favorite ? 'btn-danger text-white' : 'btn-outline-light'}`}
                                onClick={() => onToggleInteraction('is_favorite')}
                            >
                                <Heart fill={interactions.is_favorite ? "currentColor" : "none"} size={20} />
                            </button>
                            
                            <div className="vr bg-secondary mx-2"></div>
                            
                            <button 
                                className="btn btn-outline-light d-flex align-items-center gap-2"
                                onClick={handleOpenInfo}
                            >
                                <Info size={20} /> Mais Info
                            </button>

                            {movie.trailerUrl && (
                                <button 
                                    className="btn btn-outline-danger d-flex align-items-center gap-2"
                                    onClick={() => setShowTrailerModal(true)}
                                >
                                    <Youtube size={20} /> Trailer
                                </button>
                            )}
                            
                            <div className="vr bg-secondary mx-2"></div>

                            <button 
                                className="btn btn-outline-secondary d-flex align-items-center gap-2"
                                onClick={() => setIsEditingTags(true)}
                            >
                                <Edit3 size={18} /> <span className="d-none d-md-inline">Editar</span>
                            </button>
                        </div>

                        <p className="lead text-white lh-base mb-4">{getLocalizedDescription()}</p>
                        
                        {Array.isArray(movie.themes) && movie.themes.length > 0 && (
                            <div className="mb-4">
                                <h6 className="text-white-50 small text-uppercase mb-2 d-flex align-items-center gap-2"><Tags size={14} /> Temas</h6>
                                <div className="d-flex flex-wrap gap-2">
                                    {movie.themes.map(th => (
                                        <span key={th} className="badge bg-dark bg-opacity-50 border border-secondary fw-normal text-secondary">{th}</span>
                                    ))}
                                </div>
                            </div>
                        )}
                    </>
                )}

                {/* Image Gallery */}
                <div className="mt-5 pt-4 border-top border-secondary">
                    <h5 className="text-white mb-3 d-flex align-items-center gap-2"><ImageIcon size={18} /> Galeria</h5>
                    {isLoadingGallery ? (
                        <div className="text-center py-4"><Loader2 className="animate-spin text-secondary" /></div>
                    ) : galleryImages.length > 0 ? (
                        <div className="d-flex gap-3 overflow-auto pb-3 custom-scrollbar">
                            {galleryImages.map((img, idx) => (
                                <img 
                                    key={idx} 
                                    src={img} 
                                    className="rounded border border-secondary shadow-sm" 
                                    style={{ height: '120px', minWidth: '180px', objectFit: 'cover', cursor: 'pointer' }}
                                    onClick={() => window.open(img, '_blank')}
                                    loading="lazy"
                                />
                            ))}
                        </div>
                    ) : (
                        <p className="text-white-50 small fst-italic">Nenhuma imagem adicional encontrada.</p>
                    )}
                </div>
              </div>

              {/* Right Column: Metadata */}
              <div className="col-lg-4">
                <div className="bg-dark bg-opacity-25 p-4 rounded border border-secondary h-100">
                    <h6 className="text-primary-custom text-uppercase small fw-bold mb-4 border-bottom border-secondary pb-2">Detalhes Técnicos</h6>
                    
                    <dl className="row g-0 mb-0">
                        <dt className="col-4 text-white-50 small mb-3">Diretor</dt>
                        <dd className="col-8 text-white small mb-3">{movie.director}</dd>

                        <dt className="col-4 text-white-50 small mb-3">Elenco</dt>
                        <dd className="col-8 text-white small mb-3">
                            {Array.isArray(movie.cast) && movie.cast.length > 0 ? movie.cast.join(', ') : 'N/A'}
                        </dd>

                        <dt className="col-4 text-white-50 small mb-3">Idioma</dt>
                        <dd className="col-8 text-white small mb-3">{movie.language}</dd>

                        <dt className="col-4 text-white-50 small mb-3">Título Orig.</dt>
                        <dd className="col-8 text-white small mb-3 fst-italic text-white-50">{movie.originalTitle}</dd>
                        
                        <dt className="col-4 text-white-50 small mb-3">Wikidata</dt>
                        <dd className="col-8 text-white small mb-3 font-monospace">{movie.wikidataId || 'N/A'}</dd>
                    </dl>
                    
                    {movie.videoUrl && movie.videoUrl.includes('archive.org') && (
                         <div className="mt-4 p-3 bg-black bg-opacity-20 rounded border border-secondary">
                            <span className="text-success small d-flex align-items-center gap-2">
                                <CheckCircle size={14} /> Disponível no Archive.org
                            </span>
                         </div>
                    )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    {/* Trailer Modal (Same as before) */}
    {showTrailerModal && movie.trailerUrl && (
        <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.95)', zIndex: 1060 }}>
            <div className="modal-dialog modal-xl modal-dialog-centered">
                <div className="modal-content bg-black border-secondary">
                    <div className="modal-header border-bottom border-secondary py-2">
                        <h5 className="modal-title d-flex align-items-center gap-2"><Youtube className="text-danger"/> Trailer</h5>
                        <button className="btn-close btn-close-white" onClick={() => setShowTrailerModal(false)}></button>
                    </div>
                    <div className="modal-body p-0">
                        <div className="ratio ratio-16x9">
                            <iframe 
                                src={getTrailerEmbedUrl(movie.trailerUrl)} 
                                title="Trailer" 
                                allowFullScreen
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            ></iframe>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )}

    {/* Info Modal */}
    {showInfoModal && (
        <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 1060 }}>
            <div className="modal-dialog modal-lg modal-dialog-centered">
                <div className="modal-content bg-dark border-secondary text-white shadow-lg">
                    {/* Header */}
                    <div className="modal-header border-bottom border-secondary">
                        <div className="d-flex align-items-center gap-3">
                            <h5 className="modal-title fw-bold d-flex align-items-center gap-2">
                                <Info className="text-primary-custom" /> {movie.title}
                            </h5>
                        </div>
                        <button className="btn-close btn-close-white" onClick={() => setShowInfoModal(false)}></button>
                    </div>

                    {/* Navigation Tabs */}
                    <div className="modal-header border-bottom border-secondary p-0">
                        <ul className="nav nav-pills w-100" style={{ gap: '1px' }}>
                            <li className="nav-item flex-fill text-center">
                                <button 
                                    className={`nav-link rounded-0 py-3 w-100 text-uppercase small fw-bold ${infoTab === 'details' ? 'active bg-transparent text-primary-custom border-bottom border-3 border-danger' : 'text-white-50'}`}
                                    onClick={() => setInfoTab('details')}
                                >
                                    {modalT.details}
                                </button>
                            </li>
                            <li className="nav-item flex-fill text-center">
                                <button 
                                    className={`nav-link rounded-0 py-3 w-100 text-uppercase small fw-bold ${infoTab === 'trivia' ? 'active bg-transparent text-primary-custom border-bottom border-3 border-danger' : 'text-white-50'}`}
                                    onClick={() => setInfoTab('trivia')}
                                >
                                    {modalT.trivia}
                                </button>
                            </li>
                            <li className="nav-item flex-fill text-center">
                                <button 
                                    className={`nav-link rounded-0 py-3 w-100 text-uppercase small fw-bold ${infoTab === 'analysis' ? 'active bg-transparent text-primary-custom border-bottom border-3 border-danger' : 'text-white-50'}`}
                                    onClick={() => setInfoTab('analysis')}
                                >
                                    <span className="d-flex align-items-center justify-content-center gap-2"><BrainCircuit size={14}/> {modalT.analysis}</span>
                                </button>
                            </li>
                            <li className="nav-item flex-fill text-center">
                                <button 
                                    className={`nav-link rounded-0 py-3 w-100 text-uppercase small fw-bold ${infoTab === 'critics' ? 'active bg-transparent text-primary-custom border-bottom border-3 border-danger' : 'text-white-50'}`}
                                    onClick={() => setInfoTab('critics')}
                                >
                                    <span className="d-flex align-items-center justify-content-center gap-2"><MessageSquareQuote size={14}/> {modalT.critics}</span>
                                </button>
                            </li>
                            <li className="nav-item flex-fill text-center">
                                <button 
                                    className={`nav-link rounded-0 py-3 w-100 text-uppercase small fw-bold ${infoTab === 'links' ? 'active bg-transparent text-primary-custom border-bottom border-3 border-danger' : 'text-white-50'}`}
                                    onClick={() => setInfoTab('links')}
                                >
                                    {modalT.links}
                                </button>
                            </li>
                        </ul>
                    </div>

                    {/* Modal Body */}
                    <div className="modal-body p-4" style={{ minHeight: '350px' }}>
                        {/* DETAILS TAB */}
                        {infoTab === 'details' && (
                            isLoadingDetails ? (
                                <div className="d-flex justify-content-center align-items-center h-100 py-5">
                                    <Loader2 className="animate-spin text-primary-custom" size={40} />
                                </div>
                            ) : (
                                <div className="row g-4">
                                    {/* Column 1: Core Info */}
                                    <div className="col-md-6 border-end border-secondary border-opacity-25">
                                        
                                        <div className="mb-4">
                                            <h6 className="text-primary-custom text-uppercase small fw-bold mb-2 d-flex align-items-center gap-2"><Clapperboard size={14}/> {modalT.originalTitle}</h6>
                                            <p className="text-white small m-0 fst-italic">{displayDetails.originalTitle || movie.title}</p>
                                        </div>

                                        <div className="mb-4">
                                            <h6 className="text-primary-custom text-uppercase small fw-bold mb-2 d-flex align-items-center gap-2"><MapPin size={14}/> {modalT.country}</h6>
                                            {renderList(displayDetails.countries)}
                                        </div>

                                        <div className="mb-4">
                                            <h6 className="text-primary-custom text-uppercase small fw-bold mb-2 d-flex align-items-center gap-2"><Users size={14}/> {modalT.cast}</h6>
                                            {renderList(finalCast)}
                                        </div>
                                        
                                        <div className="mb-4">
                                            <h6 className="text-primary-custom text-uppercase small fw-bold mb-2 d-flex align-items-center gap-2"><Briefcase size={14}/> {modalT.producers}</h6>
                                            {renderList(displayDetails.producers)}
                                        </div>

                                        <div>
                                            <h6 className="text-primary-custom text-uppercase small fw-bold mb-2 d-flex align-items-center gap-2"><Building size={14}/> {modalT.distributors}</h6>
                                            {renderList(displayDetails.distributors)}
                                        </div>
                                    </div>

                                    {/* Column 2: Creative & Tech */}
                                    <div className="col-md-6">
                                        <ul className="list-unstyled text-white small">
                                            <li className="mb-3">
                                                <strong className="text-white-50 d-block mb-1">{t.director}</strong> 
                                                <span className="fw-bold fs-6">{displayDetails.director || movie.director}</span>
                                            </li>
                                            
                                            <li className="mb-3">
                                                <strong className="text-white-50 d-block mb-1">{modalT.basedOn}</strong>
                                                {renderList(displayDetails.basedOn, 'Original Screenplay')}
                                            </li>

                                            <li className="mb-3">
                                                <strong className="text-white-50 d-block mb-1">{modalT.cinematography}</strong>
                                                {renderList(finalCinematographers)}
                                            </li>

                                            <li className="mb-3">
                                                <strong className="text-white-50 d-block mb-1"><Paintbrush size={12}/> {modalT.artDir}</strong>
                                                {renderList(displayDetails.artDirectors)}
                                            </li>

                                            <li className="mb-3">
                                                <strong className="text-white-50 d-block mb-1"><Music size={12}/> {modalT.music}</strong>
                                                {renderList(finalComposers)}
                                            </li>

                                            <li className="mb-3">
                                                <strong className="text-white-50 d-block mb-1">{modalT.color}</strong>
                                                <span>{displayDetails.color || 'Unknown'}</span>
                                            </li>
                                        </ul>
                                        
                                        <div className="mt-4 pt-3 border-top border-secondary">
                                            <h6 className="text-white-50 small mb-2">{modalT.externalSources}</h6>
                                            <div className="d-flex flex-wrap gap-2">
                                                {movie.wikidataId && (
                                                    <a href={`https://www.wikidata.org/wiki/${movie.wikidataId}`} target="_blank" rel="noreferrer" className="btn btn-sm btn-dark border-secondary d-flex align-items-center gap-2">
                                                        <Database size={14} className="text-success" /> Wikidata
                                                    </a>
                                                )}
                                                {movie.videoUrl && (
                                                    <a href={movie.videoUrl} target="_blank" rel="noreferrer" className="btn btn-sm btn-dark border-secondary d-flex align-items-center gap-2">
                                                        <LinkIcon size={14} className="text-primary" /> Source
                                                    </a>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )
                        )}

                        {/* ... (Other tabs: Trivia, Analysis, Critics, Links - kept same) ... */}
                        {infoTab === 'trivia' && (
                            isLoadingTrivia ? (
                                <div className="d-flex justify-content-center align-items-center h-100">
                                    <Loader2 className="animate-spin text-primary-custom" size={32} />
                                </div>
                            ) : (
                                <ul className="list-group list-group-flush bg-transparent">
                                    {trivia.length > 0 ? trivia.map((fact, idx) => (
                                        <li key={idx} className="list-group-item bg-transparent text-white border-secondary d-flex gap-3">
                                            <Lightbulb className="text-warning flex-shrink-0 mt-1" size={18} />
                                            <span>{fact}</span>
                                        </li>
                                    )) : (
                                        <li className="list-group-item bg-transparent text-white-50 text-center border-0">
                                            {modalT.noTrivia}
                                        </li>
                                    )}
                                </ul>
                            )
                        )}
                        
                        {infoTab === 'links' && (
                             <div className="d-flex flex-column gap-3">
                                <div className="p-3 bg-dark border border-secondary rounded d-flex align-items-center gap-3">
                                    <div className="bg-black p-2 rounded"><Database size={24} className="text-success"/></div>
                                    <div>
                                        <h6 className="m-0 fw-bold">Wikidata</h6>
                                        <small className="text-white-50">Structured data source</small>
                                    </div>
                                    <a href={`https://www.wikidata.org/wiki/${movie.wikidataId}`} target="_blank" rel="noreferrer" className="btn btn-sm btn-outline-light ms-auto"><ExternalLink size={16}/></a>
                                </div>
                                <div className="p-3 bg-dark border border-secondary rounded d-flex align-items-center gap-3">
                                    <div className="bg-black p-2 rounded"><Video size={24} className="text-danger"/></div>
                                    <div>
                                        <h6 className="m-0 fw-bold">Video Source</h6>
                                        <small className="text-white-50 text-truncate" style={{maxWidth: '200px'}}>{movie.videoUrl}</small>
                                    </div>
                                    <a href={movie.videoUrl} target="_blank" rel="noreferrer" className="btn btn-sm btn-outline-light ms-auto"><ExternalLink size={16}/></a>
                                </div>
                             </div>
                        )}

                         {infoTab === 'analysis' && (
                            isLoadingAnalysis ? (
                                <div className="d-flex justify-content-center align-items-center h-100">
                                    <Loader2 className="animate-spin text-primary-custom" size={32} />
                                </div>
                            ) : (
                                <div className="bg-dark bg-opacity-50 p-3 rounded border border-secondary text-white-50 small lh-lg">
                                    {analysisText.split('\n').map((line, i) => (
                                        <p key={i} className={line.startsWith('**') ? 'fw-bold text-white mb-2' : 'mb-2'}>
                                            {line.replace(/\*\*/g, '')}
                                        </p>
                                    ))}
                                </div>
                            )
                        )}

                        {infoTab === 'critics' && (
                            isLoadingCritics ? (
                                <div className="d-flex justify-content-center align-items-center h-100">
                                    <Loader2 className="animate-spin text-primary-custom" size={32} />
                                </div>
                            ) : (
                                <div>
                                    {rtData && (
                                        <div className="d-flex gap-4 mb-4 p-3 bg-black border border-secondary rounded align-items-center">
                                            {rtData.tomatometer !== undefined && (
                                                <div className="d-flex align-items-center gap-2">
                                                    <span className={`badge ${rtData.tomatometer >= 60 ? 'bg-danger' : 'bg-success'} p-2 rounded-circle`} style={{width:'40px', height:'40px', display:'flex', alignItems:'center', justifyContent:'center'}}>
                                                        {rtData.tomatometer >= 60 ? '🍅' : '🤢'}
                                                    </span>
                                                    <div>
                                                        <div className="fw-bold h5 m-0">{rtData.tomatometer}%</div>
                                                        <small className="text-white-50">Tomatometer</small>
                                                    </div>
                                                </div>
                                            )}
                                            {rtData.audience_score !== undefined && (
                                                 <div className="d-flex align-items-center gap-2">
                                                    <span className={`badge bg-warning text-dark p-2 rounded-circle`} style={{width:'40px', height:'40px', display:'flex', alignItems:'center', justifyContent:'center'}}>
                                                        🍿
                                                    </span>
                                                    <div>
                                                        <div className="fw-bold h5 m-0">{rtData.audience_score}%</div>
                                                        <small className="text-white-50">Audience</small>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    <div className="bg-dark bg-opacity-50 p-3 rounded border border-secondary text-white-50 small lh-lg">
                                        {criticsText.split('\n').map((line, i) => (
                                            <p key={i} className={line.startsWith('**') ? 'fw-bold text-white mb-2' : 'mb-2'}>
                                                {line.replace(/\*\*/g, '')}
                                            </p>
                                        ))}
                                    </div>
                                </div>
                            )
                        )}
                    </div>
                </div>
            </div>
        </div>
    )}
    </>
  );
};
