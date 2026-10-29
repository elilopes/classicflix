
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, Play, Heart, Edit3, Save, Loader2, 
  ImageIcon, Info, User, ChevronLeft, Calendar, Globe, Award, Sparkles, BookOpen, Star, History, ExternalLink, RefreshCw, Captions, PlayCircle, Search, Clock, CheckCircle, Download, Share2, MessageSquare, AlertCircle, Trophy, Cpu
} from 'lucide-react';
import { toPng } from 'html-to-image';
import { WikipediaModal } from './WikipediaModal';
import { QuizModal } from './QuizModal';
import { WikidataHelperModal } from './WikidataHelperModal';
import { WikidataEditor } from './WikidataEditor';
import { ReviewSection } from './ReviewSection';
import { BestReviewsModal } from './BestReviewsModal';
import { McpConnectedAppsModal } from './McpConnectedAppsModal';
import { Movie, AppLanguage, UserMovieInteraction } from '../types';
import { updateSupabaseMovie } from '../services/supabaseClient';
import { fetchMovieImages } from '../services/wikidataService';
import { getAggregatedMovieDetails, AggregatedMovieDetails } from '../services/movieDetailsService';
import { 
  generateCriticalAnalysis, generateMovieTrivia, generateCriticsSummary, generateCinemaHistory, findDirectorForMovie, findYearForMovie, findLanguageForMovie 
} from '../services/geminiService';
// @ts-ignore
import jsPDF from 'jspdf';
// @ts-ignore
import autoTable from 'jspdf-autotable';
import { sendEditToBackend } from '../services/wikidataWriteService';
import { VideoPlayer } from './VideoPlayer';
import { APP_TRANSLATIONS } from '../constants';
import { getVideoSources, VideoSources, findAndSaveMovieVideoSource, SearchVideoResult } from '../services/videoSourceService';
import { findAndSaveMovieBannerOrPoster, BannerSearchResult } from '../services/bannerService';
import { getSupabase } from '../services/bd';

interface MovieDetailsModalProps {
  movie: Movie;
  onClose: () => void;
  language: AppLanguage;
  interactions: UserMovieInteraction;
  onToggleInteraction: (field: keyof UserMovieInteraction) => void;
  onRefresh: () => void;
  isUserLoggedIn: boolean;
  currentUser?: any;
  onFilterDirector?: (director: string) => void;
}

type InfoTab = 'overview' | 'technical' | 'trivia' | 'reviews' | 'history' | 'community';

export const MovieDetailsModal: React.FC<MovieDetailsModalProps> = ({
  movie, onClose, language, interactions, onToggleInteraction, onRefresh, isUserLoggedIn, currentUser, onFilterDirector
}) => {
  const t = APP_TRANSLATIONS[language] || APP_TRANSLATIONS['en'];
  
  const displayTitle = language === 'pt' ? (movie.titlePt || movie.title) : movie.title;
  const displayDescription = language === 'pt' ? (movie.descriptionPt || movie.description) : 
                             language === 'hi' ? (movie.descriptionHi || movie.description) :
                             language === 'ru' ? (movie.descriptionRu || movie.description) :
                             language === 'it' ? (movie.descriptionIt || movie.description) :
                             movie.description;

  const [isPlayerActive, setIsPlayerActive] = useState(false);
  const [isEditingTags, setIsEditingTags] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [showBestReviewsModal, setShowBestReviewsModal] = useState(false);
  const [activeTab, setActiveTab] = useState<InfoTab>('overview');
  const [isSaving, setIsSaving] = useState(false);
  const [isUpdatingWikidata, setIsUpdatingWikidata] = useState(false);
  const [galleryImages, setGalleryImages] = useState<string[]>([]);
  const [isLoadingGallery, setIsLoadingGallery] = useState(false);
  
  const [details, setDetails] = useState<AggregatedMovieDetails | null>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  
  const [aiAnalysis, setAiAnalysis] = useState('');
  const [aiTrivia, setAiTrivia] = useState<string[]>([]);
  const [aiReviews, setAiReviews] = useState('');
  const [aiHistory, setAiHistory] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [isExportingCard, setIsExportingCard] = useState(false);
  
  const [wikiSearch, setWikiSearch] = useState('');
  const [showWikiModal, setShowWikiModal] = useState(false);
  const [showQuizModal, setShowQuizModal] = useState(false);
  const [showWikidataHelper, setShowWikidataHelper] = useState(false);
  const [showWikidataEditor, setShowWikidataEditor] = useState(false);
  
  // Video & Media Sources State
  const [sources, setSources] = useState<VideoSources | null>(null);
  const [isLoadingSources, setIsLoadingSources] = useState(false);
  const [showSourcesLightbox, setShowSourcesLightbox] = useState(false);
  const [isSearchingVideo, setIsSearchingVideo] = useState(false);
  const [videoSearchMessage, setVideoSearchMessage] = useState<string | null>(null);
  const [isSearchingBanner, setIsSearchingBanner] = useState(false);
  const [bannerSearchMessage, setBannerSearchMessage] = useState<string | null>(null);
  const [showMcpModal, setShowMcpModal] = useState(false);
  
  const cardRef = React.useRef<HTMLDivElement>(null);

  const cleanArrayToString = (arr: string[] | undefined) => {
      if (!Array.isArray(arr)) return '';
      return arr.map(s => String(s).replace(/[\[\]\{\}"]/g, '').trim()).filter(Boolean).join(', ');
  };

  const [formData, setFormData] = useState({
    genres: cleanArrayToString(movie.genres),
    themes: cleanArrayToString(movie.themes),
    videoUrl: movie.videoUrl || '',
    subtitleUrl: movie.subtitleUrl || '',
    wikidataId: movie.wikidataId || '',
    title: movie.title,
    titlePt: movie.titlePt || '',
    description: movie.description,
    descriptionPt: movie.descriptionPt || '',
    originalTitle: movie.originalTitle || '',
    posterUrl: movie.posterUrl || '',
    year: movie.year || '',
    director: movie.director || '',
    duration: movie.duration || '',
    awards: cleanArrayToString(movie.awards),
    language: movie.language || '',
    rating: movie.rating || '',
    producers: details?.producers?.join(', ') || '',
    countries: details?.countries?.join(', ') || '',
    cinematography: details?.cinematographers?.join(', ') || '',
    distribution: details?.distributors?.join(', ') || '',
    backendUrl: process.env.WIKIDATA_BACKEND_URL || 'https://classicflix.liclopes.replit.com/api/wikidata/edit', 
    syncToWikidata: false
  });

  // Automatic metadata search for missing fields
  useEffect(() => {
    if (!movie || !isUserLoggedIn) return;
    
    const checkAndSearch = async () => {
      // Director
      const currentDirector = movie.director?.toLowerCase();
      const isDirectorUnknown = !currentDirector || currentDirector === 'unknown' || currentDirector === 'desconhecido' || currentDirector === 'n/a' || currentDirector === 'none';
      
      // Year
      const isYearUnknown = !movie.year || movie.year === 0;
      
      // Language
      const currentLanguage = movie.language?.toLowerCase();
      const isLanguageUnknown = !currentLanguage || currentLanguage === 'unknown' || currentLanguage === 'desconhecido' || currentLanguage === 'n/a' || currentLanguage === 'none';
      
      if (isDirectorUnknown) {
        console.log("Auto-searching director for:", movie.title);
        handleSearchDirector();
      }
      
      if (isYearUnknown) {
        console.log("Auto-searching year for:", movie.title);
        handleSearchYear();
      }
      
      if (isLanguageUnknown) {
        console.log("Auto-searching language for:", movie.title);
        handleSearchLanguage();
      }
    };
    
    // Small delay to avoid blocking initial render and allow other effects to settle
    const timer = setTimeout(checkAndSearch, 3000);
    return () => clearTimeout(timer);
  }, [movie.id, isUserLoggedIn]);

  const fixUrl = (url: string) => url ? url.replace('http://', 'https://') : '';

  useEffect(() => {
    const loadGallery = async () => {
      setIsLoadingGallery(true);
      const images = await fetchMovieImages(movie.wikidataId || movie.title);
      setGalleryImages(images.map(fixUrl).filter(Boolean) as string[]);
      setIsLoadingGallery(false);
    };
    loadGallery();
  }, [movie]);

  // Fetch Video Sources from Wikidata and Supabase Cache
  useEffect(() => {
    const fetchSources = async () => {
      if (!movie.wikidataId || !movie.wikidataId.startsWith('Q')) return;
      
      setIsLoadingSources(true);
      try {
        // 1. Try to get from Supabase Cache first
        const supabase = await getSupabase();
        if (supabase) {
          const { data, error } = await supabase
            .from('identifiers')
            .select('*')
            .eq('wikidataid', movie.wikidataId)
            .single();
          
          if (data && !error) {
            setSources({
              commons: data.commons,
              youtube: data.youtube,
              archiveid: data.archiveid
            });
            setIsLoadingSources(false);
            return;
          }
        }

        // 2. If not in cache, fetch from Wikidata
        const res = await getVideoSources(movie.wikidataId);
        setSources(res);

        // 3. Save to cache if any source found
        if (supabase && (res.commons || res.youtube || res.archiveid)) {
          await supabase.from('identifiers').upsert({
            wikidataid: movie.wikidataId,
            commons: res.commons,
            youtube: res.youtube,
            archiveid: res.archiveid,
            updatedat: new Date().toISOString()
          });
        }
      } catch (e) {
        console.error("Error fetching sources:", e);
      } finally {
        setIsLoadingSources(false);
      }
    };
    fetchSources();
  }, [movie.wikidataId]);

  const handleOpenInfo = async () => {
    setShowInfoModal(true);
    if (!details) {
        setIsLoadingDetails(true);
        try { 
            const agg = await getAggregatedMovieDetails(movie, language); 
            setDetails(agg); 
        } catch (e) { console.error(e); } finally { setIsLoadingDetails(false); }
    }
  };

  // Effect to reset details and AI content when language changes
  useEffect(() => {
    setDetails(null);
    setAiAnalysis('');
    setAiTrivia([]);
    setAiReviews('');
    setAiHistory('');
    
    // If modal is open, re-fetch details
    if (showInfoModal) {
      const reFetchDetails = async () => {
        setIsLoadingDetails(true);
        try {
          const agg = await getAggregatedMovieDetails(movie, language);
          setDetails(agg);
        } catch (e) { console.error(e); } finally { setIsLoadingDetails(false); }
      };
      reFetchDetails();
    }
  }, [language, movie.id]);

  useEffect(() => {
    const loadAiTabContent = async () => {
        if (!showInfoModal) return;
        setIsAiLoading(true);
        try {
            if (activeTab === 'trivia' && aiTrivia.length === 0) setAiTrivia(await generateMovieTrivia(movie.title, movie.year));
            else if (activeTab === 'reviews' && !aiReviews) setAiReviews(await generateCriticsSummary(movie.title, movie.year, language));
            else if (activeTab === 'history' && !aiHistory) setAiHistory(await generateCinemaHistory(movie.title, movie.year, language));
        } catch (e) { console.error(e); } finally { setIsAiLoading(false); }
    };
    loadAiTabContent();
  }, [activeTab, showInfoModal, movie, language]);

  const handleSaveTags = async () => {
    if (!formData.title.trim()) {
      alert("O título do filme é obrigatório.");
      return;
    }
    setIsSaving(true);
    try {
      const updates = {
        genres: formData.genres.replace(/[\[\]\{\}"]/g, '').split(',').map(s => s.trim()).filter(Boolean),
        themes: formData.themes.replace(/[\[\]\{\}"]/g, '').split(',').map(s => s.trim()).filter(Boolean),
        awards: formData.awards.replace(/[\[\]\{\}"]/g, '').split(',').map(s => s.trim()).filter(Boolean),
        videoUrl: fixUrl(formData.videoUrl),
        subtitleUrl: fixUrl(formData.subtitleUrl),
        wikidataId: formData.wikidataId,
        title: formData.title,
        titlePt: formData.titlePt,
        description: formData.description,
        descriptionPt: formData.descriptionPt,
        originalTitle: formData.originalTitle,
        posterUrl: fixUrl(formData.posterUrl),
        year: Number(formData.year),
        director: formData.director,
        duration: formData.duration,
        language: formData.language,
        rating: formData.rating
      };

      await updateSupabaseMovie(movie.wikidataId, updates);

      if (formData.syncToWikidata && movie.wikidataId) {
          await handleUpdateWikidata();
      }

      setIsEditingTags(false);
      onRefresh(); 
    } catch (error) { 
      console.error("Save error:", error);
      alert("Erro ao atualizar no banco de dados."); 
    } finally { 
      setIsSaving(false); 
    }
  };

  const handleUpdateWikidata = async () => {
    if (!movie.wikidataId) {
      alert("Este filme não possui um QID do Wikidata.");
      return;
    }
    
    setIsUpdatingWikidata(true);
    try {
      await sendEditToBackend({
        qid: movie.wikidataId,
        description: formData.description,
        language: 'pt'
      }, formData.backendUrl || undefined);
      
      alert("Metadados sincronizados com o Wikidata com sucesso!");
    } catch (wikiErr: any) {
      console.error("Wikidata sync failed:", wikiErr);
      alert(`Falha na sincronização com Wikidata: ${wikiErr.message}`);
    } finally {
      setIsUpdatingWikidata(false);
    }
  };

  const openWhereToWatch = () => {
      const query = `onde assistir ${movie.titlePt || movie.title} ${movie.year} filme`;
      window.open(`https://www.google.com/search?q=${encodeURIComponent(query)}`, '_blank');
  };

  const openTrailer = () => {
      if (movie.trailerUrl) window.open(movie.trailerUrl, '_blank');
  };

  const handleExportMoviePdf = async () => {
    setIsExportingPdf(true);
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      let currentY = 20;

      // Header
      doc.setFillColor(229, 9, 20); // Netflix Red
      doc.rect(0, 0, pageWidth, 40, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(24);
      doc.setFont("helvetica", "bold");
      doc.text("CLASSICFLIX", 14, 25);
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text("CINEMA EM DOMÍNIO PÚBLICO", 14, 32);

      currentY = 50;
      doc.setTextColor(0, 0, 0);

      // Title & Basic Info
      doc.setFontSize(22);
      doc.setFont("helvetica", "bold");
      doc.text(movie.titlePt || movie.title, 14, currentY);
      currentY += 10;
      doc.setFontSize(12);
      doc.setFont("helvetica", "normal");
      doc.text(`${movie.year} | ${movie.director} | ${movie.duration}`, 14, currentY);
      currentY += 15;

      // Poster Image
      if (movie.posterUrl) {
        try {
          const img = new Image();
          img.crossOrigin = "Anonymous";
          img.src = fixUrl(movie.posterUrl);
          await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
          });
          
          // Calculate dimensions to fit (roughly 60mm wide)
          const imgWidth = 50;
          const imgHeight = (img.height * imgWidth) / img.width;
          doc.addImage(img, 'JPEG', 14, currentY, imgWidth, imgHeight);
          currentY += imgHeight + 10;
        } catch (e) {
          console.warn("Could not add poster to PDF", e);
          doc.setFontSize(10);
          doc.setTextColor(150, 150, 150);
          doc.text("[Poster indisponível no PDF]", 14, currentY);
          currentY += 10;
        }
      }

      doc.setTextColor(0, 0, 0);

      // Technical Info
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.text("Ficha Técnica", 14, currentY);
      currentY += 7;
      
      const techData = [
        ["Diretor", movie.director || "N/A"],
        ["Ano", movie.year ? movie.year.toString() : "N/A"],
        ["Duração", movie.duration || "N/A"],
        ["Idioma", movie.language || "N/A"],
        ["Cor", details?.color || "N/A"],
        ["Elenco", details?.cast?.slice(0, 5).join(", ") || "N/A"],
        ["Países", details?.countries?.join(", ") || "N/A"]
      ];

      autoTable(doc, {
        startY: currentY,
        head: [['Campo', 'Informação']],
        body: techData,
        theme: 'striped',
        headStyles: { fillColor: [50, 50, 50] },
        margin: { left: 14 }
      });
      
      currentY = (doc as any).lastAutoTable.finalY + 15;

      // AI Content (Analysis, Review, History)
      let analysis = aiAnalysis;
      let review = aiReviews;
      let history = aiHistory;

      if (!analysis || !review || !history) {
        if (!analysis) analysis = await generateCriticalAnalysis(movie.title, movie.year, language);
        if (!review) review = await generateCriticsSummary(movie.title, movie.year, language);
        if (!history) history = await generateCinemaHistory(movie.title, movie.year, language);
      }

      const renderSection = (title: string, content: string) => {
        if (currentY > 250) {
          doc.addPage();
          currentY = 20;
        }
        doc.setFontSize(16);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(229, 9, 20);
        doc.text(title, 14, currentY);
        currentY += 8;
        doc.setFontSize(11);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(0, 0, 0);
        
        const splitText = doc.splitTextToSize(content.replace(/<br\/>/g, '\n').replace(/<b>(.*?)<\/b>/g, '$1'), pageWidth - 28);
        doc.text(splitText, 14, currentY);
        currentY += (splitText.length * 5) + 15;
      };

      renderSection("Análise Crítica", analysis || "Conteúdo não disponível.");
      renderSection("Opinião da Crítica", review || "Conteúdo não disponível.");
      renderSection("Contexto Histórico", history || "Conteúdo não disponível.");

      doc.save(`ClassicFlix_${movie.title.replace(/\s+/g, '_')}.pdf`);
    } catch (error) {
      console.error("PDF Export error:", error);
      alert("Erro ao exportar PDF. Verifique sua conexão.");
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handleShareCard = async () => {
    if (!cardRef.current) return;
    setIsExportingCard(true);
    try {
      const dataUrl = await toPng(cardRef.current, { cacheBust: true, quality: 1 });
      const link = document.createElement('a');
      link.download = `ClassicFlix_Card_${movie.title.replace(/\s+/g, '_')}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Error exporting card:', err);
      alert('Erro ao gerar card de compartilhamento.');
    } finally {
      setIsExportingCard(false);
    }
  };

  const handleOpenWiki = (name: string) => {
    setWikiSearch(name);
    setShowWikiModal(true);
  };

  const handleSearchDirector = async () => {
    console.log("handleSearchDirector triggered for:", movie.title);
    const currentDirector = movie.director?.toLowerCase();
    const isUnknown = !currentDirector || currentDirector === 'unknown' || currentDirector === 'desconhecido' || currentDirector === 'n/a' || currentDirector === 'desconhecida' || currentDirector === 'none';
    
    if (!isUnknown) {
      console.log("Director already known:", movie.director);
      return;
    }
    
    setIsSaving(true);
    // Show a notice that we are searching
    const searchNotice = document.createElement('div');
    searchNotice.className = 'position-fixed bottom-0 start-50 translate-middle-x mb-4 bg-info text-white px-4 py-2 rounded-pill shadow-lg animate-bounce';
    searchNotice.style.zIndex = '9999';
    searchNotice.innerHTML = `<div class="d-flex align-items-center gap-2"><div class="spinner-border spinner-border-sm"></div> Buscando diretor em bases externas (OMDB, TMDB, IMDb)...</div>`;
    document.body.appendChild(searchNotice);

    try {
      console.log("Calling findDirectorForMovie...");
      const startTime = Date.now();
      const result = await findDirectorForMovie(movie.title, movie.year);
      console.log("findDirectorForMovie result:", result);

      // Ensure the notice is visible for at least 1 second for better UX
      const elapsed = Date.now() - startTime;
      if (elapsed < 1000) {
        await new Promise(resolve => setTimeout(resolve, 1000 - elapsed));
      }

      const foundDirector = result?.director;
      const isFoundUnknown = !foundDirector || foundDirector.toLowerCase() === 'unknown' || foundDirector.toLowerCase() === 'desconhecido' || foundDirector.toLowerCase() === 'n/a' || foundDirector.toLowerCase() === 'none';

      if (result && foundDirector && foundDirector.toLowerCase() !== 'n/a') {
        // Update Supabase
        console.log("Updating Supabase with director:", result.director);
        if (movie.wikidataId) {
          await updateSupabaseMovie(movie.wikidataId, {
            ...movie,
            director: result.director,
            directorId: result.wikidataId || movie.directorId
          });
        } else {
          console.error("Cannot update movie: wikidataId is missing.");
          alert("Erro: wikidataId não encontrado para esta produção.");
          return;
        }
        
        // Refresh UI
        onRefresh();
        if (isFoundUnknown) {
          alert("Não foi possível encontrar o diretor para esta produção visual nas bases externas. O diretor foi salvo como 'Unknown'.");
        } else {
          alert(`Diretor encontrado: ${result.director}${result.wikidataId ? ` (${result.wikidataId})` : ''}. Informações salvas.`);
        }
      } else {
        console.log("Director not found in any API.");
        alert("Não foi possível encontrar o diretor para esta produção visual nas bases externas.");
      }
    } catch (error) {
      console.error("Error searching director:", error);
      alert("Erro ao pesquisar diretor: " + (error instanceof Error ? error.message : String(error)));
    } finally {
      setIsSaving(false);
      console.log("Search finished, removing notice.");
      if (searchNotice.parentNode) document.body.removeChild(searchNotice);
    }
  };

  const handleSearchYear = async () => {
    console.log("handleSearchYear triggered for:", movie.title);
    const currentYear = movie.year;
    const isUnknown = !currentYear || currentYear === 0;
    
    if (!isUnknown) {
      console.log("Year already known:", movie.year);
      return;
    }
    
    setIsSaving(true);
    const searchNotice = document.createElement('div');
    searchNotice.className = 'position-fixed bottom-0 start-50 translate-middle-x mb-4 bg-info text-white px-4 py-2 rounded-pill shadow-lg animate-bounce';
    searchNotice.style.zIndex = '9999';
    searchNotice.innerHTML = `<div class="d-flex align-items-center gap-2"><div class="spinner-border spinner-border-sm"></div> Buscando ano em bases externas (OMDB, TMDB)...</div>`;
    document.body.appendChild(searchNotice);

    try {
      console.log("Calling findYearForMovie...");
      const startTime = Date.now();
      const result = await findYearForMovie(movie.title);
      console.log("findYearForMovie result:", result);

      const elapsed = Date.now() - startTime;
      if (elapsed < 1000) {
        await new Promise(resolve => setTimeout(resolve, 1000 - elapsed));
      }

      if (result && result.year) {
        console.log("Updating Supabase with year:", result.year);
        if (movie.wikidataId) {
          await updateSupabaseMovie(movie.wikidataId, {
            ...movie,
            year: result.year
          });
        } else {
          console.error("Cannot update movie: wikidataId is missing.");
          alert("Erro: wikidataId não encontrado para esta produção.");
          return;
        }
        
        onRefresh();
        alert(`Ano encontrado: ${result.year}. Informações salvas.`);
      } else {
        console.log("Year not found in any API.");
        alert("Não foi possível encontrar o ano para esta produção visual nas bases externas.");
      }
    } catch (error) {
      console.error("Error searching year:", error);
      alert("Erro ao pesquisar ano: " + (error instanceof Error ? error.message : String(error)));
    } finally {
      setIsSaving(false);
      console.log("Search finished, removing notice.");
      if (searchNotice.parentNode) document.body.removeChild(searchNotice);
    }
  };

  const handleSearchLanguage = async () => {
    console.log("handleSearchLanguage triggered for:", movie.title);
    const currentLanguage = movie.language?.toLowerCase();
    const isUnknown = !currentLanguage || currentLanguage === 'unknown' || currentLanguage === 'desconhecido' || currentLanguage === 'n/a' || currentLanguage === 'none';
    
    if (!isUnknown) {
      console.log("Language already known:", movie.language);
      return;
    }
    
    setIsSaving(true);
    const searchNotice = document.createElement('div');
    searchNotice.className = 'position-fixed bottom-0 start-50 translate-middle-x mb-4 bg-info text-white px-4 py-2 rounded-pill shadow-lg animate-bounce';
    searchNotice.style.zIndex = '9999';
    searchNotice.innerHTML = `<div class="d-flex align-items-center gap-2"><div class="spinner-border spinner-border-sm"></div> Buscando idioma em bases externas (OMDB, TMDB)...</div>`;
    document.body.appendChild(searchNotice);

    try {
      console.log("Calling findLanguageForMovie...");
      const startTime = Date.now();
      const result = await findLanguageForMovie(movie.title);
      console.log("findLanguageForMovie result:", result);

      const elapsed = Date.now() - startTime;
      if (elapsed < 1000) {
        await new Promise(resolve => setTimeout(resolve, 1000 - elapsed));
      }

      if (result && result.language && result.language.toLowerCase() !== 'n/a') {
        console.log("Updating Supabase with language:", result.language);
        if (movie.wikidataId) {
          await updateSupabaseMovie(movie.wikidataId, {
            ...movie,
            language: result.language
          });
        } else {
          console.error("Cannot update movie: wikidataId is missing.");
          alert("Erro: wikidataId não encontrado para esta produção.");
          return;
        }
        
        onRefresh();
        if (result.language.toLowerCase() === 'unknown') {
          alert("Não foi possível encontrar o idioma para esta produção visual nas bases externas. O idioma foi salvo como 'Unknown'.");
        } else {
          alert(`Idioma encontrado: ${result.language}. Informações salvas.`);
        }
      } else {
        console.log("Language not found in any API.");
        alert("Não foi possível encontrar o idioma para esta produção visual nas bases externas.");
      }
    } catch (error) {
      console.error("Error searching language:", error);
      alert("Erro ao pesquisar idioma: " + (error instanceof Error ? error.message : String(error)));
    } finally {
      setIsSaving(false);
      console.log("Search finished, removing notice.");
      if (searchNotice.parentNode) document.body.removeChild(searchNotice);
    }
  };

  const effectiveVideoUrl = fixUrl(movie.videoUrl || 
                           sources?.commons || 
                           sources?.youtube || 
                           (sources?.archiveid ? `https://archive.org/details/${sources.archiveid}` : ''));

  const refreshSources = async () => {
    if (!movie.wikidataId) return;
    setIsLoadingSources(true);
    try {
      const res = await getVideoSources(movie.wikidataId);
      setSources(res);
      const supabase = await getSupabase();
      if (supabase) {
        await supabase.from('identifiers').upsert({
          wikidataid: movie.wikidataId,
          commons: res.commons,
          youtube: res.youtube,
          archiveid: res.archiveid,
          updatedat: new Date().toISOString()
        });
      }
    } catch (e) {
      console.error("Error refreshing sources:", e);
    } finally {
      setIsLoadingSources(false);
    }
  };

  const handlePlayOrSearch = async () => {
    // 1. If effective video URL already exists, open VideoPlayer directly
    if (effectiveVideoUrl) {
      setIsPlayerActive(true);
      return;
    }

    // 2. Search Archive.org and Wikimedia Commons APIs for direct playable link
    setIsSearchingVideo(true);
    setVideoSearchMessage(language === 'pt' ? 'Pesquisando filme no Archive.org e Wikimedia Commons...' : 'Searching video on Archive.org & Wikimedia Commons...');
    try {
      const result = await findAndSaveMovieVideoSource(movie);
      if (result.success && result.directUrl) {
        setVideoSearchMessage(language === 'pt' ? 'Vídeo encontrado! Abrindo reprodução...' : 'Video found! Starting playback...');
        setSources(prev => ({
          commons: result.source === 'commons' ? result.directUrl : (prev?.commons || null),
          youtube: result.source === 'youtube' ? result.directUrl : (prev?.youtube || null),
          archiveid: result.archiveId || prev?.archiveid || null,
          imdbId: result.imdbId || prev?.imdbId || null,
          tmdbCompanyId: result.tmdbCompanyId || prev?.tmdbCompanyId || null,
          tmdbId: result.tmdbId || prev?.tmdbId || null
        }));
        onRefresh();
        setTimeout(() => {
          setIsPlayerActive(true);
          setIsSearchingVideo(false);
          setVideoSearchMessage(null);
        }, 500);
      } else {
        setIsSearchingVideo(false);
        setVideoSearchMessage(null);
        alert(language === 'pt' 
          ? (result.message || 'Nenhum vídeo direto de domínio público encontrado automaticamente no Archive.org ou Wikimedia Commons. Tente o botão "Onde Assistir".') 
          : (result.message || 'No direct public domain video stream found in Archive.org or Wikimedia Commons. Try "Where to Watch".'));
      }
    } catch (err: any) {
      console.error("Error searching video sources:", err);
      setIsSearchingVideo(false);
      setVideoSearchMessage(null);
      alert(language === 'pt' ? 'Erro ao pesquisar fontes de vídeo.' : 'Error searching video sources.');
    }
  };

  const handleExplicitSearchVideo = async () => {
    setIsSearchingVideo(true);
    setVideoSearchMessage(language === 'pt' ? 'Pesquisando fontes de vídeo no Archive.org e Wikimedia Commons...' : 'Searching video on Archive.org & Wikimedia Commons...');
    try {
      const result = await findAndSaveMovieVideoSource(movie);
      if (result.success && result.directUrl) {
        setVideoSearchMessage(language === 'pt' ? 'Vídeo encontrado e salvo!' : 'Video found & saved!');
        setSources(prev => ({
          commons: result.source === 'commons' ? result.directUrl : (prev?.commons || null),
          youtube: result.source === 'youtube' ? result.directUrl : (prev?.youtube || null),
          archiveid: result.archiveId || prev?.archiveid || null,
          imdbId: result.imdbId || prev?.imdbId || null,
          tmdbCompanyId: result.tmdbCompanyId || prev?.tmdbCompanyId || null,
          tmdbId: result.tmdbId || prev?.tmdbId || null
        }));
        setFormData(prev => ({ ...prev, videoUrl: result.directUrl || '' }));
        onRefresh();
        alert(language === 'pt'
          ? `Vídeo encontrado no ${result.source?.toUpperCase()}!\nLink: ${result.directUrl}\nOs dados foram persistidos no banco de dados e conectados ao botão play.`
          : `Video stream found on ${result.source?.toUpperCase()}!\nDirect URL: ${result.directUrl}`);
      } else {
        alert(language === 'pt'
          ? (result.message || 'Nenhum vídeo direto de domínio público encontrado automaticamente no Archive.org ou Wikimedia Commons.')
          : (result.message || 'No direct public domain stream found.'));
      }
    } catch (err: any) {
      console.error("Error in handleExplicitSearchVideo:", err);
      alert(language === 'pt' ? 'Erro ao pesquisar fontes de vídeo.' : 'Error searching video sources.');
    } finally {
      setIsSearchingVideo(false);
      setVideoSearchMessage(null);
    }
  };

  const handleSearchBanner = async () => {
    setIsSearchingBanner(true);
    setBannerSearchMessage(language === 'pt' ? 'Pesquisando imagens no TMDB, Archive.org, Wikimedia Commons e IMDb...' : 'Searching banner/poster in TMDB, Archive.org, Commons & IMDb...');
    try {
      const result = await findAndSaveMovieBannerOrPoster(movie);
      if (result.success && (result.localUrl || result.imageUrl)) {
        const savedUrl = result.localUrl || result.imageUrl || '';
        setFormData(prev => ({ ...prev, posterUrl: savedUrl }));
        onRefresh();
        alert(language === 'pt'
          ? `Imagem encontrada via ${result.source?.toUpperCase()}!\nSalva na pasta banner: ${savedUrl}\nO card e o modal foram atualizados!`
          : `Image found via ${result.source?.toUpperCase()}!\nSaved in banner folder: ${savedUrl}`);
      } else {
        alert(language === 'pt'
          ? (result.message || 'Nenhuma imagem de poster ou banner encontrada nos repositórios.')
          : (result.message || 'No banner or poster image found.'));
      }
    } catch (err: any) {
      console.error("Error in handleSearchBanner:", err);
      alert(language === 'pt' ? 'Erro ao pesquisar banner/poster.' : 'Error searching banner/poster.');
    } finally {
      setIsSearchingBanner(false);
      setBannerSearchMessage(null);
    }
  };

  const renderInfoModalContent = () => (
    <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.95)', zIndex: 1100 }}>
        <div className="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable" style={{ maxWidth: '90vw' }}>
            <div className="modal-content bg-dark border-secondary shadow-lg overflow-hidden" style={{ minHeight: '80vh' }}>
                <div className="modal-header border-secondary d-flex justify-content-between align-items-center py-3 bg-black">
                    <div className="d-flex align-items-center gap-3">
                        <button className="btn btn-sm btn-outline-light rounded-circle" onClick={() => setShowInfoModal(false)}> <ChevronLeft size={20} /> </button>
                        <h4 className="m-0 text-white fw-bold">{t.moreInfoTitle}: <span className="text-danger">{details?.title || movie.title}</span></h4>
                    </div>
                    <div className="d-flex align-items-center gap-2">
                            {isUserLoggedIn && (
                            <button 
                                className="btn btn-sm btn-outline-secondary d-flex align-items-center gap-2 px-3 shadow text-white" 
                                onClick={() => {
                                    setShowInfoModal(false);
                                    setIsEditingTags(true);
                                }}
                            >
                                <Edit3 size={16} /> {t.editMetadata || 'Editar (Supabase/Wikidata)'}
                            </button>
                            )}
                        <button 
                            className="btn btn-sm btn-outline-warning d-flex align-items-center gap-2 px-3 shadow text-white" 
                            onClick={() => setShowBestReviewsModal(true)}
                        >
                            <Trophy size={16} className="text-warning" /> {language === 'pt' ? 'Melhores Críticas' : 'Top Reviews'}
                        </button>
                        <button 
                          className="btn btn-sm btn-danger d-flex align-items-center gap-2 px-3 shadow" 
                          onClick={handleExportMoviePdf}
                          disabled={isExportingPdf}
                        >
                          {isExportingPdf ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                          {isExportingPdf ? 'Exportando...' : 'Exportar PDF'}
                        </button>
                        <button className="btn btn-icon text-white" onClick={() => setShowInfoModal(false)}> <X size={32} /> </button>
                    </div>
                </div>

                <div className="modal-body p-4 p-lg-5 custom-scrollbar">
                    <ul className="nav nav-tabs border-secondary mb-4 gap-2 flex-nowrap overflow-auto pb-1">
                        {[
                            { id: 'overview', label: t.tabOverview, icon: <Info size={16}/> },
                            { id: 'technical', label: t.tabTechnical, icon: <Award size={16}/> },
                            { id: 'trivia', label: t.tabTrivia, icon: <BookOpen size={16}/> },
                            { id: 'reviews', label: t.tabReviews, icon: <Star size={16}/> },
                            { id: 'community', label: t.community, icon: <MessageSquare size={16}/> },
                            { id: 'history', label: t.tabHistory, icon: <History size={16}/> }
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
                                            <h5 className="text-danger mb-3 border-bottom border-secondary pb-2">{t.synopsis}</h5>
                                            <p className="lh-lg opacity-75">{details?.description || movie.description}</p>
                                            
                                            <h5 className="text-danger mt-5 mb-3 d-flex align-items-center gap-2 border-bottom border-secondary pb-2"> <ImageIcon size={18}/> {t.gallery} {isLoadingGallery && <Loader2 className="animate-spin" size={14}/>}</h5>
                                            <div className="d-flex gap-3 overflow-auto pb-3 custom-scrollbar">
                                                {galleryImages.map((img, idx) => (
                                                    <img key={idx} src={img} className="rounded border border-secondary shadow-sm" style={{ height: '160px', minWidth: '240px', objectFit: 'cover' }} />
                                                ))}
                                                {galleryImages.length === 0 && <p className="text-white-50 small opacity-50">{t.noImagesFound}</p>}
                                            </div>

                                            <h5 className="text-danger mt-5 mb-3 border-bottom border-secondary pb-2">{t.externalLinks}</h5>
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
                                                <h6 className="text-danger uppercase xsmall fw-bold mb-3 tracking-wider">{t.quickMetadata}</h6>
                                                <div className="d-flex flex-column gap-3 small">
                                                    <div className="d-flex justify-content-between border-bottom border-secondary pb-2"><span className="opacity-50">{t.originalTitle}</span><span className="text-end">{movie.originalTitle || movie.title}</span></div>
                                                    <div className="d-flex justify-content-between border-bottom border-secondary pb-2">
                                                        <span className="opacity-50">{t.director}</span>
                                                        <div className="d-flex align-items-center gap-2 text-end">
                                                            <button 
                                                                onClick={() => handleOpenWiki(movie.director)}
                                                                className="btn btn-link p-0 text-info text-decoration-none hover-underline"
                                                            >
                                                                {movie.director}
                                                            </button>
                                                            {(!movie.director || movie.director.toLowerCase() === 'unknown' || movie.director.toLowerCase() === 'desconhecido' || movie.director.toLowerCase() === 'n/a' || movie.director.toLowerCase() === 'desconhecida' || movie.director.toLowerCase() === 'none') && (
                                                              <button 
                                                                className="btn btn-sm btn-outline-info p-1 py-0 xsmall"
                                                                onClick={handleSearchDirector}
                                                                title={t.searchDirector}
                                                              >
                                                                <Search size={12} />
                                                              </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="d-flex justify-content-between border-bottom border-secondary pb-2">
                                                        <span className="opacity-50">{t.year}</span>
                                                        <div className="d-flex align-items-center gap-2 text-end">
                                                            <span>{movie.year}</span>
                                                            {(!movie.year || movie.year === 0) && (
                                                              <button 
                                                                className="btn btn-sm btn-outline-info p-1 py-0 xsmall"
                                                                onClick={handleSearchYear}
                                                                title="Pesquisar Ano"
                                                              >
                                                                <Search size={12} />
                                                              </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="d-flex justify-content-between border-bottom border-secondary pb-2">
                                                        <span className="opacity-50">Idioma</span>
                                                        <div className="d-flex align-items-center gap-2 text-end">
                                                            <span>{movie.language}</span>
                                                            {(!movie.language || movie.language.toLowerCase() === 'unknown' || movie.language.toLowerCase() === 'desconhecido' || movie.language.toLowerCase() === 'n/a' || movie.language.toLowerCase() === 'none') && (
                                                              <button 
                                                                className="btn btn-sm btn-outline-info p-1 py-0 xsmall"
                                                                onClick={handleSearchLanguage}
                                                                title="Pesquisar Idioma"
                                                              >
                                                                <Search size={12} />
                                                              </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="d-flex justify-content-between border-bottom border-secondary pb-2">
                                                        <span className="opacity-50">QID</span>
                                                        <a 
                                                            href={`https://www.wikidata.org/wiki/${movie.wikidataId}`} 
                                                            target="_blank" 
                                                            rel="noopener noreferrer"
                                                            className="text-warning font-monospace text-end hover-underline text-decoration-none"
                                                        >
                                                            {movie.wikidataId}
                                                        </a>
                                                    </div>
                                                    <div className="d-flex justify-content-between">
                                                        <span className="opacity-50">{t.directorQid}</span>
                                                        <a 
                                                            href={movie.directorId ? `https://www.wikidata.org/wiki/${movie.directorId}` : '#'} 
                                                            target="_blank" 
                                                            rel="noopener noreferrer"
                                                            className="text-info font-monospace text-end hover-underline text-decoration-none"
                                                            style={{ pointerEvents: movie.directorId ? 'auto' : 'none' }}
                                                        >
                                                            {movie.directorId || 'N/A'}
                                                        </a>
                                                    </div>
                                                </div>
                                            </div>

                                            {movie.wikidataId?.startsWith('indie-') && (
                                                <div className="mt-4 p-3 bg-info bg-opacity-10 border border-info rounded animate-in">
                                                    <h6 className="text-info small fw-bold mb-2 d-flex align-items-center gap-2">
                                                        <BookOpen size={14} /> {t.independentProduction}
                                                    </h6>
                                                    <p className="text-white-50 xsmall mb-3">
                                                        {t.noWikidataInfo}
                                                    </p>
                                                    <button 
                                                        className="btn btn-sm btn-info text-white w-100 fw-bold d-flex align-items-center justify-content-center gap-2"
                                                        onClick={() => setShowWikidataHelper(true)}
                                                    >
                                                        <Sparkles size={14} /> {t.prepareWikidata}
                                                    </button>
                                                </div>
                                            )}

                                            {details?.externalRatings && (
                                                <div className="bg-black bg-opacity-50 p-4 rounded border border-secondary shadow mt-4">
                                                    <h6 className="text-danger uppercase xsmall fw-bold mb-3 tracking-wider">{t.externalRatings}</h6>
                                                    <div className="d-flex flex-column gap-3 small">
                                                        {details.externalRatings.imdb && (
                                                            <div className="d-flex justify-content-between border-bottom border-secondary pb-2">
                                                                <span className="opacity-50">IMDb</span>
                                                                <span className="text-warning fw-bold">{details.externalRatings.imdb}/10</span>
                                                            </div>
                                                        )}
                                                        {details.externalRatings.rottenTomatoes && (
                                                            <div className="d-flex justify-content-between border-bottom border-secondary pb-2">
                                                                <span className="opacity-50">Rotten Tomatoes</span>
                                                                <span className="text-danger fw-bold">{details.externalRatings.rottenTomatoes}</span>
                                                            </div>
                                                        )}
                                                        {details.externalRatings.metacritic && (
                                                            <div className="d-flex justify-content-between border-bottom border-secondary pb-2">
                                                                <span className="opacity-50">Metacritic</span>
                                                                <span className="text-info fw-bold">{details.externalRatings.metacritic}/100</span>
                                                            </div>
                                                        )}
                                                        {details.externalRatings.tmdb && (
                                                            <div className="d-flex justify-content-between">
                                                                <span className="opacity-50">TMDb</span>
                                                                <span className="text-success fw-bold">{details.externalRatings.tmdb.toFixed(1)}/10</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                                {activeTab === 'technical' && (
                                    <div className="row g-4">
                                        <div className="col-md-8">
                                            <div className="row g-4">
                                                <div className="col-12">
                                                    <h6 className="text-danger xsmall fw-bold mb-2 uppercase">{t.mainCast}</h6>
                                                    <div className="d-flex flex-wrap gap-2">
                                                        {details?.cast.map((actor, i) => (
                                                            <button 
                                                                key={i}
                                                                onClick={() => handleOpenWiki(actor)}
                                                                className="btn btn-sm btn-outline-light rounded-pill px-3 py-1 text-white-50 hover-white"
                                                            >
                                                                {actor}
                                                            </button>
                                                        )) || 'N/A'}
                                                    </div>
                                                </div>
                                                <div className="col-md-6"><h6 className="text-danger xsmall fw-bold mb-2 uppercase">{t.producers}</h6><p className="opacity-75">{details?.producers?.join(', ') || 'N/A'}</p></div>
                                                <div className="col-md-6"><h6 className="text-danger xsmall fw-bold mb-2 uppercase">{t.cinematography}</h6><p className="opacity-75">{details?.cinematographers?.join(', ') || 'N/A'}</p></div>
                                                <div className="col-md-6"><h6 className="text-danger xsmall fw-bold mb-2 uppercase">{t.originCountries}</h6><p className="opacity-75">{details?.countries?.join(', ') || 'N/A'}</p></div>
                                                <div className="col-md-6"><h6 className="text-danger xsmall fw-bold mb-2 uppercase">{t.distribution}</h6><p className="opacity-75">{details?.distributors?.join(', ') || 'N/A'}</p></div>
                                            </div>
                                        </div>
                                        <div className="col-md-4">
                                            <div className="bg-black bg-opacity-25 p-4 rounded border border-secondary">
                                                <h6 className="text-white-50 xsmall fw-bold mb-3 uppercase">{t.technicalSheet}</h6>
                                                <ul className="list-unstyled small d-flex flex-column gap-2 m-0">
                                                    <li><span className="opacity-50">{t.durationLabel}</span> {movie.duration}</li>
                                                    <li><span className="opacity-50">{t.colorLabel}</span> {details?.color || 'N/A'}</li>
                                                    <li><span className="opacity-50">{t.language}:</span> {movie.language}</li>
                                                    <li><span className="opacity-50">{t.ratingLabel}</span> {movie.rating}</li>
                                                </ul>
                                            </div>
                                        </div>
                                    </div>
                                )}
                                {(activeTab === 'reviews' || activeTab === 'history') && (
                                    <div className="bg-black bg-opacity-25 p-4 p-lg-5 rounded border border-secondary shadow">
                                        {isAiLoading ? <Loader2 className="animate-spin text-danger mx-auto" size={32} /> : (
                                            <div className="lh-lg markdown-content" dangerouslySetInnerHTML={{ __html: (activeTab === 'reviews' ? aiReviews : aiHistory).replace(/\*\*(.*?)\*\*/g, '<b>$1</b>').replace(/\n/g, '<br/>') }} />
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
                                {activeTab === 'community' && (
                                    <ReviewSection movieId={movie.id} language={language} isUserLoggedIn={isUserLoggedIn} />
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    </div>
  );

  if (isPlayerActive && effectiveVideoUrl) {
    return <VideoPlayer id={movie.id} wikidataId={movie.wikidataId} src={effectiveVideoUrl} poster={movie.posterUrl} title={displayTitle} initialTime={interactions.progress_seconds} subtitleUrl={movie.subtitleUrl} onClose={() => setIsPlayerActive(false)} isUserLoggedIn={isUserLoggedIn} />;
  }

  const renderEditMetadataModal = () => (
    <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.95)', zIndex: 1200 }}>
      <div className="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable" style={{ maxWidth: '90vw' }}>
        <div className="modal-content bg-dark border-secondary shadow-lg overflow-hidden" style={{ minHeight: '80vh' }}>
          <div className="modal-header border-secondary d-flex justify-content-between align-items-center py-3 bg-black">
            <h4 className="m-0 text-white fw-bold d-flex align-items-center gap-2"><Edit3 size={20}/>{t.editMetadata}</h4>
            <button className="btn btn-icon text-white" onClick={() => setIsEditingTags(false)}> <X size={32} /> </button>
          </div>
          <div className="modal-body p-4 p-lg-5 custom-scrollbar">
            <div className="row g-3">
              <div className="col-md-6"><label className="form-label text-white-50 small">{t.title} (EN)</label><input className="form-control bg-black text-white border-secondary shadow-none" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} /></div>
              <div className="col-md-6"><label className="form-label text-white-50 small">{t.title} (PT)</label><input className="form-control bg-black text-white border-secondary shadow-none" value={formData.titlePt} onChange={e => setFormData({...formData, titlePt: e.target.value})} /></div>
              
              <div className="col-md-9"><label className="form-label text-white-50 small">{t.originalTitle}</label><input className="form-control bg-black text-white border-secondary shadow-none" value={formData.originalTitle} onChange={e => setFormData({...formData, originalTitle: e.target.value})} /></div>
              <div className="col-md-3"><label className="form-label text-white-50 small">QID (Wikidata)</label><input className="form-control bg-dark text-secondary border-secondary shadow-none" value={formData.wikidataId} readOnly disabled /></div>
              
              <div className="col-md-3"><label className="form-label text-white-50 small">{t.year}</label><input type="number" className="form-control bg-black text-white border-secondary shadow-none" value={formData.year} onChange={e => setFormData({...formData, year: e.target.value})} /></div>
              <div className="col-md-3"><label className="form-label text-white-50 small">{t.language}</label><input className="form-control bg-black text-white border-secondary shadow-none" value={formData.language} onChange={e => setFormData({...formData, language: e.target.value})} /></div>
              <div className="col-md-3"><label className="form-label text-white-50 small">{t.duration}</label><input className="form-control bg-black text-white border-secondary shadow-none" value={formData.duration} onChange={e => setFormData({...formData, duration: e.target.value})} /></div>
              <div className="col-md-3"><label className="form-label text-white-50 small">{t.ratingLabel}</label><input className="form-control bg-black text-white border-secondary shadow-none" value={formData.rating} onChange={e => setFormData({...formData, rating: e.target.value})} /></div>
              
              <div className="col-12">
                <label className="form-label text-white-50 small d-flex justify-content-between">
                  {t.director} 
                  {movie.directorId && (
                    <a 
                      href={`https://www.wikidata.org/wiki/${movie.directorId}`} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-warning font-monospace small hover-underline text-decoration-none"
                    >
                      QID: {movie.directorId}
                    </a>
                  )}
                </label>
                <input className="form-control bg-black text-white border-secondary shadow-none" value={formData.director} onChange={e => setFormData({...formData, director: e.target.value})} />
              </div>

              <div className="col-md-6"><label className="form-label text-white-50 small">{t.genresLabel}</label><input className="form-control bg-black text-white border-secondary shadow-none" value={formData.genres} onChange={e => setFormData({...formData, genres: e.target.value})} /></div>
              <div className="col-md-6"><label className="form-label text-white-50 small">{t.themesLabel}</label><input className="form-control bg-black text-white border-secondary shadow-none" value={formData.themes} onChange={e => setFormData({...formData, themes: e.target.value})} /></div>

              <div className="col-12"><label className="form-label text-white-50 small">{t.awards}</label><input className="form-control bg-black text-white border-secondary shadow-none" value={formData.awards} onChange={e => setFormData({...formData, awards: e.target.value})} placeholder="Oscar, Cannes, etc." /></div>

              <div className="col-md-6"><label className="form-label text-white-50 small">{t.producers}</label><input className="form-control bg-black text-white border-secondary shadow-none" value={formData.producers} onChange={e => setFormData({...formData, producers: e.target.value})} /></div>
              <div className="col-md-6"><label className="form-label text-white-50 small">{t.originCountries}</label><input className="form-control bg-black text-white border-secondary shadow-none" value={formData.countries} onChange={e => setFormData({...formData, countries: e.target.value})} /></div>

              <div className="col-md-6"><label className="form-label text-white-50 small">{t.cinematography}</label><input className="form-control bg-black text-white border-secondary shadow-none" value={formData.cinematography} onChange={e => setFormData({...formData, cinematography: e.target.value})} /></div>
              <div className="col-md-6"><label className="form-label text-white-50 small">{t.distribution}</label><input className="form-control bg-black text-white border-secondary shadow-none" value={formData.distribution} onChange={e => setFormData({...formData, distribution: e.target.value})} /></div>

              <div className="col-12"><label className="form-label text-white-50 small">{t.videoLink}</label><input className="form-control bg-black text-white border-secondary shadow-none" value={formData.videoUrl} onChange={e => setFormData({...formData, videoUrl: e.target.value})} /></div>
              <div className="col-12"><label className="form-label text-white-50 small"><Captions size={14} className="me-1"/>{t.subtitleLink}</label><input className="form-control bg-black text-white border-secondary shadow-none" placeholder="https://..." value={formData.subtitleUrl} onChange={e => setFormData({...formData, subtitleUrl: e.target.value})} /></div>
              
              <div className="col-md-6"><label className="form-label text-white-50 small">{t.description} (EN)</label><textarea className="form-control bg-black text-white border-secondary shadow-none" rows={3} value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} /></div>
              <div className="col-md-6"><label className="form-label text-white-50 small">{t.description} (PT)</label><textarea className="form-control bg-black text-white border-secondary shadow-none" rows={3} value={formData.descriptionPt} onChange={e => setFormData({...formData, descriptionPt: e.target.value})} /></div>
              
              <div className="col-12 border-top border-secondary pt-3 mt-3">
                 <h6 className="text-warning small fw-bold mb-3 d-flex align-items-center gap-2"><RefreshCw size={14}/> {t.wikidataSync}</h6>
                 <div className="row g-2">
                    <div className="col-md-8">
                        <label className="form-label text-white-50 small">{t.backendUrl}</label>
                        <input className="form-control form-control-sm bg-black text-white border-secondary shadow-none" value={formData.backendUrl} onChange={e => setFormData({...formData, backendUrl: e.target.value})} placeholder="https://seu-proxy.repl.co" />
                    </div>
                    <div className="col-md-4 d-flex align-items-end pb-1">
                        <div className="form-check form-switch">
                            <input className="form-check-input" type="checkbox" role="switch" checked={formData.syncToWikidata} onChange={e => setFormData({...formData, syncToWikidata: e.target.checked})} />
                            <label className="form-check-label text-white small">{t.syncOnSave}</label>
                        </div>
                    </div>
                 </div>
              </div>
            </div>
          </div>
          <div className="modal-footer border-secondary bg-black">
            <button className="btn btn-outline-secondary px-4" onClick={() => setIsEditingTags(false)}>{t.cancel}</button>
            <button className="btn btn-primary px-4" onClick={handleUpdateWikidata} disabled={isUpdatingWikidata || !movie.wikidataId}>
              {isUpdatingWikidata ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />} 
              {t.wikidataSync || 'Atualizar Wikidata'}
            </button>
            <button className="btn btn-success px-4" onClick={handleSaveTags} disabled={isSaving}>
              {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} 
              {t.save || 'Salvar no Supabase'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 1055, backdropFilter: 'blur(8px)' }}>
        <div className="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable">
          <motion.div 
            initial={{ scale: 0.7, rotate: -10, opacity: 0 }}
            animate={{ scale: 1, rotate: 0, opacity: 1 }}
            transition={{ 
              type: "spring", 
              damping: 20, 
              stiffness: 260,
              duration: 0.5 
            }}
            className="modal-content modal-content-custom shadow-lg overflow-hidden" 
            style={{ minHeight: '70vh' }}
          >
            
            <div className="modal-hero position-relative overflow-hidden" style={{ minHeight: '450px' }}>
              <div 
                className="position-absolute top-0 start-0 w-100 h-100 z-0" 
                style={{ 
                  backgroundImage: `url("${fixUrl(details?.backdropUrl || movie.posterUrl)}")`, 
                  backgroundSize: 'cover', 
                  backgroundPosition: 'center 20%',
                  filter: 'brightness(0.6)'
                }}
              >
                <div className="position-absolute top-0 start-0 w-100 h-100" style={{ background: 'linear-gradient(to bottom, transparent 0%, rgba(20,20,20,1) 100%)' }}></div>
              </div>
              
              <button className="btn-close btn-close-white position-absolute top-0 end-0 m-4 z-3 shadow-none" onClick={onClose}></button>
              
              <div className="modal-hero-content position-absolute bottom-0 start-0 w-100 p-4 p-lg-5 z-2 d-flex flex-column justify-content-end">
                <div className="mb-4 d-flex align-items-center gap-3">
                  <motion.button
                    whileHover={{ scale: 1.08 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handlePlayOrSearch}
                    disabled={isSearchingVideo}
                    className="btn btn-danger rounded-circle p-4 shadow-lg d-flex align-items-center justify-content-center position-relative"
                    style={{ width: '80px', height: '80px' }}
                    title={effectiveVideoUrl ? (language === 'pt' ? 'Assistir Agora' : 'Watch Now') : (language === 'pt' ? 'Buscar e Reproduzir Filme' : 'Search & Play Movie')}
                  >
                    {isSearchingVideo ? (
                      <Loader2 size={34} className="animate-spin text-white" />
                    ) : (
                      <Play fill="white" size={32} />
                    )}
                  </motion.button>
                  <div className="d-flex flex-column">
                    <span className="text-white fw-bold fs-5">
                      {isSearchingVideo 
                        ? (videoSearchMessage || (language === 'pt' ? 'Buscando vídeo...' : 'Searching video...'))
                        : effectiveVideoUrl 
                          ? (language === 'pt' ? 'Assistir Filme' : 'Play Movie') 
                          : (language === 'pt' ? 'Buscar e Assistir' : 'Search & Play')}
                    </span>
                    <span className="text-white-50 xsmall">
                      {effectiveVideoUrl 
                        ? (sources?.archiveid ? 'Internet Archive' : sources?.commons ? 'Wikimedia Commons' : 'ClassicFlix Stream') 
                        : (language === 'pt' ? 'Procurar cópia no Archive.org ou Wikimedia Commons' : 'Find stream on Archive.org or Wikimedia Commons')}
                    </span>
                  </div>
                </div>
                <h1 className="fw-bold text-white text-shadow-lg mb-2" style={{ fontSize: 'min(4rem, 8vw)', lineHeight: '1.1' }}>{displayTitle}</h1>
                <div className="d-flex align-items-center gap-3 text-white-50 fw-medium">
                   <span className="badge bg-danger shadow-sm px-2 py-1">{movie.rating || 'N/A'}</span>
                   <span>{movie.year}</span>
                   <span>{movie.duration}</span>
                   <span className="badge border border-secondary text-white-50">{movie.type}</span>
                </div>
              </div>
            </div>

            <div className="modal-body p-4 p-lg-5 pt-4">
              <div className="row g-4 animate-in">
                <div className="col-lg-8">
                      <div className="d-flex flex-column gap-4 mb-5">
                          {/* Mensagem de Feedback de Busca Ativa */}
                          {(videoSearchMessage || bannerSearchMessage) && (
                            <div className="alert alert-info py-2 px-3 border-info d-flex align-items-center gap-2 rounded-pill shadow-sm mb-2" style={{ backgroundColor: 'rgba(13, 202, 240, 0.15)' }}>
                              <Loader2 size={16} className="animate-spin text-info" />
                              <span className="small text-white fw-bold">{videoSearchMessage || bannerSearchMessage}</span>
                            </div>
                          )}

                          {/* Botões de Ação Principais */}
                          <div className="d-flex gap-2 flex-wrap">
                              <button 
                                className={`btn btn-lg px-4 d-flex align-items-center gap-2 shadow-sm rounded-pill ${effectiveVideoUrl ? 'btn-danger' : 'btn-outline-danger text-white'}`}
                                onClick={handlePlayOrSearch}
                                disabled={isSearchingVideo}
                              >
                                {isSearchingVideo ? <Loader2 size={20} className="animate-spin" /> : <Play size={20} fill={effectiveVideoUrl ? "white" : "none"} />}
                                {effectiveVideoUrl ? (language === 'pt' ? 'Assistir Filme' : 'Play Movie') : (language === 'pt' ? 'Buscar no Archive/Commons' : 'Search Archive/Commons')}
                              </button>

                              {/* Botão Dedicado: Pesquisar Vídeo (findAndSaveMovieVideoSource) */}
                              <button 
                                className="btn btn-lg btn-outline-info px-4 d-flex align-items-center gap-2 shadow-sm rounded-pill"
                                onClick={handleExplicitSearchVideo}
                                disabled={isSearchingVideo}
                                title={language === 'pt' ? 'Pesquisar vídeo no Archive.org e Wikimedia Commons via APIs' : 'Search video stream on Archive.org & Commons'}
                              >
                                {isSearchingVideo ? <Loader2 size={20} className="animate-spin text-info" /> : <Search size={20} className="text-info" />}
                                <span>{language === 'pt' ? 'Buscar Vídeo' : 'Search Video'}</span>
                              </button>

                              {/* Botão Dedicado: Pesquisar Imagem/Banner (findAndSaveMovieBannerOrPoster) */}
                              <button 
                                className="btn btn-lg btn-outline-warning px-4 d-flex align-items-center gap-2 shadow-sm rounded-pill"
                                onClick={handleSearchBanner}
                                disabled={isSearchingBanner}
                                title={language === 'pt' ? 'Pesquisar poster/banner no Archive.org, Wikimedia Commons, IMDb e TMDB e salvar na pasta banner' : 'Search poster/banner in Archive.org, Commons, IMDb, TMDB and save to banner folder'}
                              >
                                {isSearchingBanner ? <Loader2 size={20} className="animate-spin text-warning" /> : <ImageIcon size={20} className="text-warning" />}
                                <span>{language === 'pt' ? 'Buscar Poster/Banner' : 'Search Banner'}</span>
                              </button>

                              <button 
                                className={`btn btn-lg px-4 d-flex align-items-center gap-2 shadow-sm rounded-pill ${movie.trailerUrl ? 'btn-warning text-dark' : 'btn-outline-secondary text-white-50'}`}
                                onClick={openTrailer} 
                                disabled={!movie.trailerUrl}
                              >
                                <PlayCircle size={20} /> {t.trailer}
                              </button>

                              <button 
                                className="btn btn-lg btn-info px-4 d-flex align-items-center gap-2 shadow-sm text-white rounded-pill"
                                onClick={() => setShowSourcesLightbox(true)}
                              >
                                <Search size={20} /> {t.whereToWatch}
                              </button>

                              <button className="btn btn-lg btn-outline-light px-4 d-flex align-items-center gap-2 shadow-sm rounded-pill" onClick={handleOpenInfo}>
                                <Info size={20} /> {t.moreInfo}
                              </button>
                          </div>

                          <div className="d-flex gap-2 flex-wrap">
                              {/* Botão MCP & Google Connected Apps Platform */}
                              <button 
                                className="btn btn-dark border-secondary px-3 py-2 d-flex align-items-center gap-2 rounded-3 text-warning shadow-sm" 
                                onClick={() => setShowMcpModal(true)}
                                title="Model Context Protocol & Google Connected Apps Platform (OAuth 2.1)"
                              >
                                <Cpu size={18} /> <span>MCP / Connected Apps</span>
                              </button>

                              <button 
                                className="btn btn-dark border-secondary px-3 py-2 d-flex align-items-center gap-2 rounded-3" 
                                onClick={() => {
                                  setActiveTab('community');
                                  setShowInfoModal(true);
                                }}
                              >
                                <MessageSquare size={18} /> {t.comments}
                              </button>

                              <button 
                                className="btn btn-dark border-secondary px-3 py-2 d-flex align-items-center gap-2 rounded-3" 
                                onClick={() => setShowQuizModal(true)}
                              >
                                <Award size={18} /> {t.quiz}
                              </button>

                              <button 
                                className="btn btn-dark border-secondary px-3 py-2 d-flex align-items-center gap-2 rounded-3" 
                                onClick={handleShareCard}
                                disabled={isExportingCard}
                              >
                                {isExportingCard ? <Loader2 size={18} className="animate-spin" /> : <Share2 size={18} />} 
                                {isExportingCard ? t.generating : t.share}
                              </button>

                              {isUserLoggedIn && (
                                <button 
                                  className="btn btn-dark border-secondary px-3 py-2 d-flex align-items-center gap-2 rounded-3 text-info" 
                                  onClick={() => setIsEditingTags(true)}
                                >
                                  <Edit3 size={18} /> {t.editMetadata || 'Editar'}
                                </button>
                              )}
                          </div>

                          {/* Interações (Like, Watchlist, Watched) */}
                          <div className="d-flex gap-2 p-2 bg-dark bg-opacity-50 rounded-4 border border-secondary" style={{ maxWidth: '400px' }}>
                              <button 
                                 className={`btn border-0 flex-grow-1 py-1 rounded-3 ${interactions.isfavorite ? 'btn-danger' : 'btn-transparent text-white-50 hover-white'}`} 
                                 onClick={() => onToggleInteraction('isfavorite')}
                                 title={t.favTooltip}
                              >
                                 <Heart fill={interactions.isfavorite ? "white" : "none"} size={22} className="mx-auto" />
                              </button>

                              <button 
                                 className={`btn border-0 flex-grow-1 py-1 rounded-3 ${interactions.iswatchlist ? 'btn-primary' : 'btn-transparent text-white-50 hover-white'}`} 
                                 onClick={() => onToggleInteraction('iswatchlist')}
                                 title={t.watchLaterTooltip}
                              >
                                 <Clock fill={interactions.iswatchlist ? "white" : "none"} size={22} className="mx-auto" />
                              </button>

                              <button 
                                 className={`btn border-0 flex-grow-1 py-1 rounded-3 ${interactions.iswatched ? 'btn-success' : 'btn-transparent text-white-50 hover-white'}`} 
                                 onClick={() => onToggleInteraction('iswatched')}
                                 title={t.watchedTooltip}
                              >
                                 <CheckCircle fill={interactions.iswatched ? "white" : "none"} size={22} className="mx-auto" />
                              </button>
                          </div>
                      </div>
                      
                      <div className="pe-lg-5">
                        <p className="lead text-white lh-base mb-4" style={{ fontSize: '1.2rem', fontWeight: '300' }}>{displayDescription}</p>
                      </div>
                    </div>
                    <div className="col-lg-4">
                      <div className="bg-dark bg-opacity-25 p-4 rounded border border-secondary shadow-sm">
                          <h6 className="text-danger text-uppercase xsmall fw-bold mb-4 border-bottom border-secondary pb-2 tracking-wider">{t.quickMetadata}</h6>
                          <dl className="row g-0 small">
                              <dt className="col-4 text-white-50 mb-3"><User size={14} className="me-2"/>{t.director}</dt>
                              <dd className="col-8 text-white mb-3">
                                <div className="d-flex align-items-center gap-2">
                                  <button 
                                      onClick={() => handleOpenWiki(movie.director)}
                                      className="btn btn-link p-0 text-info text-decoration-none hover-underline text-start"
                                  >
                                      {movie.director}
                                  </button>
                                  {(!movie.director || movie.director.toLowerCase() === 'unknown' || movie.director.toLowerCase() === 'desconhecido' || movie.director.toLowerCase() === 'n/a' || movie.director.toLowerCase() === 'desconhecida' || movie.director.toLowerCase() === 'none') && (
                                    <button 
                                      className="btn btn-sm btn-outline-info p-1 py-0 xsmall"
                                      onClick={handleSearchDirector}
                                      title={t.searchDirector}
                                    >
                                      <Search size={12} />
                                    </button>
                                  )}
                                </div>
                                {movie.directorId && (
                                    <a 
                                        href={`https://www.wikidata.org/wiki/${movie.directorId}`} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="text-white-50 xsmall font-monospace ms-1 hover-underline text-decoration-none"
                                    >
                                        ({movie.directorId})
                                    </a>
                                 )}
                              </dd>
                              <dt className="col-4 text-white-50 mb-3"><Calendar size={14} className="me-2"/>{t.year}</dt>
                              <dd className="col-8 text-white mb-3 d-flex align-items-center gap-2">
                                {movie.year}
                                {(!movie.year || movie.year === 0) && (
                                  <button 
                                    className="btn btn-sm btn-outline-info p-1 py-0 xsmall"
                                    onClick={handleSearchYear}
                                    title="Pesquisar Ano"
                                  >
                                    <Search size={12} />
                                  </button>
                                )}
                              </dd>
                              <dt className="col-4 text-white-50 mb-3"><Globe size={14} className="me-2"/>{t.language}</dt>
                              <dd className="col-8 text-white mb-3 d-flex align-items-center gap-2">
                                {movie.language}
                                {(!movie.language || movie.language.toLowerCase() === 'unknown' || movie.language.toLowerCase() === 'desconhecido' || movie.language.toLowerCase() === 'n/a' || movie.language.toLowerCase() === 'none') && (
                                  <button 
                                    className="btn btn-sm btn-outline-info p-1 py-0 xsmall"
                                    onClick={handleSearchLanguage}
                                    title="Pesquisar Idioma"
                                  >
                                    <Search size={12} />
                                  </button>
                                )}
                              </dd>
                              <dt className="col-4 text-white-50 mb-3"><Award size={14} className="me-2"/>{t.genres}</dt><dd className="col-8 text-white mb-3">{movie.genres && Array.isArray(movie.genres) ? movie.genres.join(', ') : (movie.genres || 'N/A')}</dd>
                          </dl>
                          <div className="mt-4 pt-4 border-top border-secondary text-end">
                              <a 
                                href={`https://www.wikidata.org/wiki/${movie.wikidataId}`} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="badge bg-black border border-secondary text-warning font-monospace hover-underline text-decoration-none"
                              >
                                {movie.wikidataId || 'N/A'}
                              </a>
                          </div>
                      </div>
                    </div>
                  </div>
            </div>
          </motion.div>
        </div>
      </div>
      {showInfoModal && createPortal(renderInfoModalContent(), document.body)}
      <BestReviewsModal isOpen={showBestReviewsModal} onClose={() => setShowBestReviewsModal(false)} language={language} />
      
      <WikipediaModal 
        isOpen={showWikiModal} 
        onClose={() => setShowWikiModal(false)} 
        searchTerm={wikiSearch} 
        onFilterDirector={onFilterDirector}
      />

      <QuizModal 
        isOpen={showQuizModal} 
        onClose={() => setShowQuizModal(false)} 
        movie={movie} 
        currentUser={currentUser}
      />

      <McpConnectedAppsModal
        isOpen={showMcpModal}
        onClose={() => setShowMcpModal(false)}
        appLanguage={language}
        currentMovie={movie}
      />

      {/* Hidden Card for Export */}
      <div style={{ position: 'absolute', left: '-9999px', top: '-9999px' }}>
        <div 
          ref={cardRef}
          className="d-flex flex-column shadow-lg"
          style={{ 
            width: '600px', 
            height: '900px', 
            backgroundColor: '#09090b', 
            padding: '2rem', 
            borderRadius: '1.5rem', 
            border: '4px solid #e50914',
            gap: '1.5rem'
          }}
        >
          <div className="d-flex justify-content-between align-items-start">
            <div className="text-white px-3 py-2 rounded font-weight-bold" style={{ backgroundColor: '#e50914', fontSize: '1.25rem', letterSpacing: '-0.05em' }}>
              CLASSICFLIX
            </div>
            <div className="text-secondary font-monospace small">
              {movie.wikidataId}
            </div>
          </div>

          <div className="position-relative flex-grow-1 rounded overflow-hidden border border-secondary" style={{ borderRadius: '1rem' }}>
            <img 
              src={fixUrl(movie.posterUrl) || null} 
              alt={movie.title} 
              className="w-100 h-100"
              style={{ objectFit: 'cover' }}
              referrerPolicy="no-referrer"
              crossOrigin="anonymous"
            />
            <div className="position-absolute inset-0 w-100 h-100" style={{ background: 'linear-gradient(to top, black, transparent)', top: 0, left: 0 }} />
            <div className="position-absolute bottom-0 start-0 end-0 p-4">
              <h1 className="text-white fw-bold text-uppercase text-shadow-lg" style={{ fontSize: '2.5rem', lineHeight: 1.1 }}>
                {movie.titlePt || movie.title}
              </h1>
              <div className="d-flex gap-2 mt-2">
                <span className="badge bg-danger">{movie.year}</span>
                <span className="badge bg-dark border border-secondary">{movie.duration}</span>
              </div>
            </div>
          </div>

          <div className="d-flex flex-column gap-3">
            <div className="d-flex align-items-center gap-2 text-secondary">
              <User size={20} className="text-danger" />
              <span className="fw-bold fs-5 text-white">{movie.director}</span>
            </div>
            <p className="text-light fst-italic lh-base" style={{ fontSize: '1.1rem', display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
              "{movie.descriptionPt || movie.description}"
            </p>
          </div>

          <div className="pt-4 border-top border-secondary d-flex justify-content-between align-items-center">
            <div className="d-flex align-items-center gap-2 text-secondary">
              <Globe size={16} />
              <span className="small text-uppercase tracking-widest">{t.publicDomain}</span>
            </div>
            <div className="text-danger fw-bold small tracking-widest">
              ASSISTA AGORA
            </div>
          </div>
        </div>
      </div>
      {/* Where to Watch Lightbox */}
      <AnimatePresence>
        {showSourcesLightbox && (
          <div 
            className="modal fade show d-block" 
            style={{ backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 1100, backdropFilter: 'blur(10px)' }}
            onClick={() => setShowSourcesLightbox(false)}
          >
            <div className="modal-dialog modal-dialog-centered" onClick={e => e.stopPropagation()}>
              <motion.div 
                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.9, opacity: 0, y: 20 }}
                className="modal-content bg-dark border-secondary shadow-2xl"
              >
                <div className="modal-header border-secondary">
                  <h5 className="modal-title text-white d-flex align-items-center gap-2">
                    <Search size={20} className="text-info" />
                    {t.whereToWatch} "{displayTitle}"
                    <button 
                      className="btn btn-sm btn-link text-white-50 p-0 ms-2" 
                      onClick={(e) => { e.stopPropagation(); refreshSources(); }}
                      title="Atualizar fontes"
                    >
                      <RefreshCw size={14} className={isLoadingSources ? 'animate-spin' : ''} />
                    </button>
                  </h5>
                  <button className="btn-close btn-close-white" onClick={() => setShowSourcesLightbox(false)}></button>
                </div>
                <div className="modal-body p-4 text-center">
                  {isLoadingSources ? (
                    <div className="py-5">
                      <Loader2 size={40} className="animate-spin text-info mx-auto mb-3" />
                      <p className="text-white-50">{t.searchingSources}</p>
                    </div>
                  ) : (
                    <>
                      <p className="text-white-50 mb-4">{t.chooseRepository}</p>
                      <div className="d-flex justify-content-center gap-5 flex-wrap">
                        {movie.videoUrl && !sources?.commons && !sources?.youtube && !sources?.archiveid && (
                          <motion.a 
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.95 }}
                            href={movie.videoUrl} 
                            target="_blank" 
                            className="text-decoration-none d-flex flex-column align-items-center gap-2"
                            title="Link Direto"
                          >
                            <div className="bg-white p-3 rounded-circle shadow-lg" style={{ width: '80px', height: '80px', display: 'grid', placeItems: 'center' }}>
                              <Play size={40} className="text-danger" />
                            </div>
                            <span className="text-white small fw-bold">Direto</span>
                          </motion.a>
                        )}
                        {sources?.commons && (
                          <motion.a 
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.95 }}
                            href={sources.commons.includes('Special:FilePath/') ? sources.commons.replace('Special:FilePath/', 'File:') : sources.commons} 
                            target="_blank" 
                            className="text-decoration-none d-flex flex-column align-items-center gap-2"
                            title="Wikimedia Commons"
                          >
                            <div className="bg-white p-3 rounded-circle shadow-lg" style={{ width: '80px', height: '80px', display: 'grid', placeItems: 'center' }}>
                              <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/4/4a/Commons-logo.svg/1024px-Commons-logo.svg.png" width="50" alt="Commons" />
                            </div>
                            <span className="text-white small fw-bold">Commons</span>
                          </motion.a>
                        )}
                        {sources?.youtube && (
                          <motion.a 
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.95 }}
                            href={sources.youtube} 
                            target="_blank" 
                            className="text-decoration-none d-flex flex-column align-items-center gap-2"
                            title="YouTube"
                          >
                            <div className="bg-white p-3 rounded-circle shadow-lg" style={{ width: '80px', height: '80px', display: 'grid', placeItems: 'center' }}>
                              <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/0/09/YouTube_full-color_icon_%282017%29.svg/1024px-YouTube_full-color_icon_%282017%29.svg.png" width="50" alt="YouTube" />
                            </div>
                            <span className="text-white small fw-bold">YouTube</span>
                          </motion.a>
                        )}
                        {sources?.archiveid && (
                          <motion.a 
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.95 }}
                            href={`https://archive.org/details/${sources.archiveid}`} 
                            target="_blank" 
                            className="text-decoration-none d-flex flex-column align-items-center gap-2"
                            title="Internet Archive"
                          >
                            <div className="bg-white p-3 rounded-circle shadow-lg" style={{ width: '80px', height: '80px', display: 'grid', placeItems: 'center' }}>
                              <img src="https://archive.org/images/glogo.png" width="50" alt="Archive" />
                            </div>
                            <span className="text-white small fw-bold">Archive</span>
                          </motion.a>
                        )}
                        {!sources?.commons && !sources?.youtube && !sources?.archiveid && (
                          <div className="py-4">
                            <AlertCircle size={48} className="text-warning mx-auto mb-3 opacity-50" />
                            <p className="text-white-50">{t.noSourcesFound}</p>
                            <button 
                              className="btn btn-sm btn-outline-info mt-3"
                              onClick={() => window.open(`https://www.google.com/search?q=${encodeURIComponent(displayTitle + " " + movie.year + " onde assistir")}`, '_blank')}
                            >
                              Buscar no Google
                            </button>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
                <div className="modal-footer border-secondary">
                  <button className="btn btn-secondary" onClick={() => setShowSourcesLightbox(false)}>{t.close}</button>
                </div>
              </motion.div>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* Universal Video Player */}
      {isPlayerActive && (
        <VideoPlayer 
          src={effectiveVideoUrl || movie.videoUrl || ''} 
          poster={fixUrl(details?.backdropUrl || movie.posterUrl)} 
          title={displayTitle} 
          id={movie.id} 
          wikidataId={movie.wikidataId} 
          subtitleUrl={movie.subtitleUrl} 
          onClose={() => setIsPlayerActive(false)} 
          isUserLoggedIn={isUserLoggedIn} 
        />
      )}

      {isEditingTags && renderEditMetadataModal()}
      
      {/* Wikidata Helper Modal */}
      {showWikidataHelper && (
          <WikidataHelperModal 
              movie={movie} 
              onClose={() => setShowWikidataHelper(false)} 
          />
      )}
    </>
  );
};
