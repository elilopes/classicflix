
import React, { useState, useRef, useEffect } from 'react';
import { 
  X, Edit3, Save, Loader2, Sparkles,
  Film, Calendar, Clock, Globe, User, Hash, Info,
  Video, Tag, PlusCircle, CheckCircle, MonitorPlay, Orbit, RefreshCw,
  Palette, Music, Camera, Users, LayoutGrid, Search, Database, BookOpen, Tv, Globe2, Clapperboard, Captions, FileText, Upload, Radio
} from 'lucide-react';
import { addSupabaseMovie, getExistingWikidataIds } from '../services/supabaseClient';
import { extractMetadataFromUrl } from '../services/geminiService';
import { searchOmdbMovies, getOmdbMovieDetails } from '../services/omdbService';
import { fetchMovieByQid, findPublicDomainMovies } from '../services/wikidataService';
import { searchTvMaze, getTvMazeDetails } from '../services/tvmazeService';
import { searchOfdb } from '../services/ofdbService';
import { searchTmdbMovies, getTmdbMovieDetails } from '../services/tmdbService';
import { Movie } from '../types';
import { P2PManager } from '../services/p2pService';
import { getCurrentUser } from '../services/bd';
import { AppLanguage } from '../types';

interface AddMovieModalProps {
  onClose: () => void;
  onSuccess: () => void;
  t: any;
  language: AppLanguage;
}

export const AddMovieModal: React.FC<AddMovieModalProps> = ({ onClose, onSuccess, t, language }) => {
  const [activeTab, setActiveTab] = useState<'url' | 'tmdb' | 'omdb' | 'tvmaze' | 'ofdb' | 'qid' | 'discover' | 'csv' | 'manual'>('url');
  
  // Discovery State
  const [discoveredMovies, setDiscoveredMovies] = useState<Partial<Movie>[]>([]);
  const [isDiscovering, setIsDiscovering] = useState(false);
  
  // URL Extraction State
  const [url, setUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  // OMDb State
  const [omdbQuery, setOmdbQuery] = useState('');
  const [omdbResults, setOmdbResults] = useState<Partial<Movie>[]>([]);
  const [isOmdbLoading, setIsOmdbLoading] = useState(false);

  // TMDb State
  const [tmdbQuery, setTmdbQuery] = useState('');
  const [tmdbResults, setTmdbResults] = useState<Partial<Movie>[]>([]);
  const [isTmdbLoading, setIsTmdbLoading] = useState(false);

  // TVMaze State
  const [tvmazeQuery, setTvmazeQuery] = useState('');
  const [tvmazeResults, setTvmazeResults] = useState<Partial<Movie>[]>([]);
  const [isTvmazeLoading, setIsTvmazeLoading] = useState(false);

  // OFDb State
  const [ofdbQuery, setOfdbQuery] = useState('');
  const [ofdbResults, setOfdbResults] = useState<Partial<Movie>[]>([]);
  const [isOfdbLoading, setIsOfdbLoading] = useState(false);

  // qID State
  const [qidQuery, setQidQuery] = useState('');

  // CSV State
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvMovies, setCsvMovies] = useState<Partial<Movie>[]>([]);
  const [isCsvProcessing, setIsCsvProcessing] = useState(false);
  const [importProgress, setImportProgress] = useState<{current: number, total: number} | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Final Data State
  const [movieData, setMovieData] = useState<Partial<Movie> | null>(null);

  // P2P State
  const [isP2P, setIsP2P] = useState(false);
  const [p2pStream, setP2PStream] = useState<MediaStream | null>(null);
  const p2pVideoRef = useRef<HTMLVideoElement>(null);
  const p2pFileInputRef = useRef<HTMLInputElement>(null);
  const p2pManagerRef = useRef<P2PManager | null>(null);

  useEffect(() => {
    return () => {
      p2pManagerRef.current?.destroy();
    };
  }, []);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const videoUrl = URL.createObjectURL(file);
    if (p2pVideoRef.current) {
      p2pVideoRef.current.src = videoUrl;
      p2pVideoRef.current.onloadedmetadata = async () => {
        // @ts-ignore
        const stream = p2pVideoRef.current?.captureStream();
        if (stream && movieData) {
          setP2PStream(stream);
          setIsP2P(true);
          updateField('videoUrl', `p2p:${movieData.id}`);
          
          const user = await getCurrentUser();
          if (user) {
            const manager = new P2PManager(movieData.id!, user.id);
            p2pManagerRef.current = manager;
            await manager.initialize();
            await manager.startBroadcast(stream);
            p2pVideoRef.current?.play();
          }
        }
      };
    }
  };

  // --- HANDLERS FOR URL MODE ---
  const handleExtract = async () => {
    if (!url) return;
    setIsLoading(true);
    try {
      // Check if it's a Wikidata URL
      const wikidataMatch = url.match(/wikidata\.org\/wiki\/(Q\d+)/i);
      if (wikidataMatch) {
        const qid = wikidataMatch[1];
        const movie = await fetchMovieByQid(qid);
        if (movie) {
          setMovieData({
            ...movie,
            id: `db-${Date.now()}`,
            genres: movie.genres || [],
            themes: movie.themes || [],
            cast: movie.cast || [],
            videoUrl: url.includes('archive.org') ? url : movie.videoUrl
          });
          setIsLoading(false);
          return;
        }
      }

      const data = await extractMetadataFromUrl(url);
      setMovieData({
        ...data,
        videoUrl: url,
        id: `db-${Date.now()}`,
        type: data.type || 'Movie',
        year: data.year || new Date().getFullYear(),
        genres: data.genres || [],
        themes: data.themes || [],
        cast: data.cast || [],
      });
    } catch (error) {
      console.error(error);
      alert("Falha ao extrair dados. Tente manualmente.");
      setMovieData({ videoUrl: url, title: 'Novo Filme', year: new Date().getFullYear(), genres: [] });
    } finally {
      setIsLoading(false);
    }
  };

  // --- HANDLERS FOR TMDB MODE ---
  const handleTmdbSearch = async () => {
      if (!tmdbQuery) return;
      setIsTmdbLoading(true);
      try {
          const results = await searchTmdbMovies(tmdbQuery);
          setTmdbResults(results);
      } catch (e) { console.error(e); } finally { setIsTmdbLoading(false); }
  };

  const handleSelectTmdbMovie = async (tmdbMovie: Partial<Movie>) => {
      setIsTmdbLoading(true);
      try {
          const details = await getTmdbMovieDetails(tmdbMovie.id as string);
          if (details) {
              setMovieData({
                  ...details,
                  id: `db-${Date.now()}`,
                  videoUrl: '', 
                  themes: [], 
                  posterUrl: details.posterUrl || tmdbMovie.posterUrl || ''
              });
          }
      } catch (e) { console.error(e); } finally { setIsTmdbLoading(false); }
  };

  // --- HANDLERS FOR OMDb MODE ---
  const handleOmdbSearch = async () => {
      if (!omdbQuery) return;
      setIsOmdbLoading(true);
      try {
          const results = await searchOmdbMovies(omdbQuery);
          setOmdbResults(results);
      } catch (e) {
          console.error(e);
      } finally {
          setIsOmdbLoading(false);
      }
  };

  const handleSelectOmdbMovie = async (omdbMovie: Partial<Movie>) => {
      setIsOmdbLoading(true);
      try {
          const details = await getOmdbMovieDetails(omdbMovie.wikidataId as string);
          if (details) {
              setMovieData({
                  ...details,
                  id: `db-${Date.now()}`,
                  videoUrl: '', 
                  themes: [],
                  cinematographers: [],
                  composers: [],
                  posterUrl: details.posterUrl || omdbMovie.posterUrl || ''
              });
          }
      } catch (e) {
          console.error(e);
      } finally {
          setIsOmdbLoading(false);
      }
  };

  // --- HANDLERS FOR TVMAZE MODE ---
  const handleTvmazeSearch = async () => {
      if (!tvmazeQuery) return;
      setIsTvmazeLoading(true);
      try {
          const results = await searchTvMaze(tvmazeQuery);
          setTvmazeResults(results);
      } catch (e) {
          console.error(e);
      } finally {
          setIsTvmazeLoading(false);
      }
  };

  const handleSelectTvmazeShow = async (show: Partial<Movie>) => {
      setIsTvmazeLoading(true);
      try {
          const details = await getTvMazeDetails(show.id as string);
          if (details) {
              setMovieData({
                  ...details,
                  id: `db-${Date.now()}`,
                  videoUrl: '', 
                  themes: [],
                  cinematographers: [],
                  composers: [],
                  posterUrl: details.posterUrl || show.posterUrl || ''
              });
          }
      } catch(e) {
          console.error(e);
      } finally {
          setIsTvmazeLoading(false);
      }
  };

  // --- HANDLERS FOR OFDB MODE ---
  const handleOfdbSearch = async () => {
      if (!ofdbQuery) return;
      setIsOfdbLoading(true);
      try {
          const results = await searchOfdb(ofdbQuery);
          setOfdbResults(results);
      } catch (e) {
          console.error(e);
      } finally {
          setIsOfdbLoading(false);
      }
  };

  const handleSelectOfdbMovie = async (ofdbMovie: Partial<Movie>) => {
      setMovieData({
          ...ofdbMovie,
          id: `db-${Date.now()}`,
          videoUrl: '',
          genres: [],
          themes: [],
          description: `Imported from OFDb: ${ofdbMovie.title}`,
          posterUrl: '' 
      });
  };

  // --- HANDLERS FOR qID MODE ---
  const handleQidSearch = async () => {
      if (!qidQuery) return;
      setIsLoading(true);
      try {
          const qid = qidQuery.toUpperCase().startsWith('Q') ? qidQuery : `Q${qidQuery}`;
          const movie = await fetchMovieByQid(qid);
          
          if (movie) {
              setMovieData({
                  ...movie,
                  id: `db-${Date.now()}`,
                  genres: movie.genres || [],
                  themes: movie.themes || [],
                  cast: movie.cast || [],
              });
          } else {
              alert("Filme não encontrado ou dados incompletos no Wikidata.");
          }
      } catch (e) {
          console.error(e);
          alert("Erro ao buscar no Wikidata.");
      } finally {
          setIsLoading(false);
      }
  };

  // --- DISCOVERY HANDLERS ---
  const handleDiscoverPublicDomain = async () => {
      setIsDiscovering(true);
      try {
          const existingIds = await getExistingWikidataIds();
          const results = await findPublicDomainMovies(existingIds);
          setDiscoveredMovies(results);
      } catch (e) {
          console.error(e);
      } finally {
          setIsDiscovering(false);
      }
  };

  const handleSelectDiscoveredMovie = async (movie: Partial<Movie>) => {
      setIsLoading(true);
      try {
          const details = await fetchMovieByQid(movie.wikidataId!);
          if (details) {
              setMovieData({
                  ...details,
                  id: `db-${Date.now()}`
              });
          }
      } catch (e) {
          console.error(e);
      } finally {
          setIsLoading(false);
      }
  };

  // --- CSV PARSER UTILS ---
  const parseCSVLine = (str: string, delimiter: string = ',') => {
      const result = [];
      let cell = '';
      let quote = false;
      for (let i = 0; i < str.length; i++) {
          const char = str[i];
          if (char === '"' && str[i+1] === '"') {
               cell += '"'; i++; 
          } else if (char === '"') {
               quote = !quote;
          } else if (char === delimiter && !quote) {
               result.push(cell.trim()); cell = '';
          } else {
               cell += char;
          }
      }
      result.push(cell.trim());
      return result;
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setCsvFile(file);
      setCsvMovies([]);
      setImportProgress(null);

      const reader = new FileReader();
      reader.onload = (evt) => {
          const text = evt.target?.result as string;
          if (!text) return;

          const lines = text.split('\n').filter(l => l.trim());
          if (lines.length < 2) {
              alert("Arquivo CSV inválido ou vazio. Certifique-se de incluir o cabeçalho.");
              return;
          }

          const firstLine = lines[0];
          const delimiter = firstLine.includes(';') ? ';' : ',';
          const headers = parseCSVLine(firstLine, delimiter).map(h => 
              h.toLowerCase()
               .trim()
               .replace(/^[\uFEFF\uFFFE]/, '') // Remove BOM
               .replace(/['"]+/g, '')
          );
          
          console.log("Parsed CSV Headers:", headers);
          
          const qidIndex = headers.findIndex(h => h === 'qid' || h === 'wikidataid');
          if (qidIndex === -1) {
              alert("Erro: O arquivo CSV deve conter uma coluna 'qid' ou 'wikidataid'.");
              setCsvFile(null);
              return;
          }

          const parsedMovies: Partial<Movie>[] = [];

          for (let i = 1; i < lines.length; i++) {
              const row = parseCSVLine(lines[i], delimiter);
              if (row.length < headers.length) continue; 

              const movie: any = {
                  title: 'Untitled',
                  year: new Date().getFullYear(),
                  genres: [],
                  type: 'Movie'
              };

              headers.forEach((header, index) => {
                  const value = row[index];
                  if (!value) return;

                  if (header === 'qid' || header === 'wikidataid') {
                      let qid = value.trim();
                      if (qid.includes('wikidata.org/wiki/')) qid = qid.split('wikidata.org/wiki/').pop() || qid;
                      else if (qid.includes('wikidata.org/entity/')) qid = qid.split('wikidata.org/entity/').pop() || qid;
                      movie.wikidataId = qid.split(/[?#]/)[0].toUpperCase();
                  }
                  else if (header === 'title' || header === 'titulo') movie.title = value;
                  else if (header === 'year' || header === 'ano') movie.year = parseInt(value) || 0;
                  else if (header === 'video' || header === 'videourl' || header === 'url') movie.videoUrl = value;
                  else if (header === 'poster' || header === 'posterurl' || header === 'image') movie.posterUrl = value;
                  else if (header === 'description' || header === 'sinopse' || header === 'plot') movie.description = value;
                  else if (header === 'subtitle' || header === 'subtitleurl' || header === 'legenda') movie.subtitleUrl = value;
                  else if (header === 'genres' || header === 'generos') {
                      movie.genres = value.includes('|') ? value.split('|') : value.split(',').map(s => s.trim());
                  }
                  else if (header === 'language' || header === 'idioma') movie.language = value;
                  else if (header === 'director' || header === 'diretor') movie.director = value;
                  else if (header === 'duration' || header === 'duracao') movie.duration = value;
              });

              // Set ID after parsing all fields, using wikidataId if available
              movie.id = movie.wikidataId || `db-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

              if (movie.wikidataId) {
                  parsedMovies.push(movie);
              }
          }

          setCsvMovies(parsedMovies);
      };
      reader.readAsText(file);
  };

  const handleImportCSV = async () => {
      if (csvMovies.length === 0) return;
      setIsCsvProcessing(true);
      let successCount = 0;

      for (let i = 0; i < csvMovies.length; i++) {
          setImportProgress({ current: i + 1, total: csvMovies.length });
          let movie = { ...csvMovies[i] };
          console.log(`Processing movie ${i + 1}/${csvMovies.length}: ${movie.title} (${movie.wikidataId})`);
          
          try {
              // Enrich with Wikidata if QID is present
              if (movie.wikidataId && movie.wikidataId.startsWith('Q')) {
                  console.log(`Fetching Wikidata for ${movie.wikidataId}...`);
                  const wikiData = await fetchMovieByQid(movie.wikidataId);
                  if (wikiData) {
                      console.log(`Found Wikidata for ${movie.title}`);
                      // Merge: CSV data takes precedence over Wikidata data
                      movie = { ...wikiData, ...movie };
                  } else {
                      console.warn(`No Wikidata found for ${movie.wikidataId}`);
                  }
              }
              
              await addSupabaseMovie(movie);
              console.log(`Successfully imported ${movie.title}`);
              successCount++;
          } catch (e) {
              console.error(`Failed to import ${movie.title} (${movie.wikidataId}):`, e);
          }
      }

      setIsCsvProcessing(false);
      alert(`Importação concluída! ${successCount} de ${csvMovies.length} filmes importados.`);
      onSuccess();
      onClose();
  };

  const handleSave = async () => {
     if (!movieData || !movieData.title) return;
     setIsLoading(true);
     try {
         await addSupabaseMovie(movieData);
         onSuccess();
         onClose();
     } catch(e) {
         console.error(e);
         alert("Error saving movie");
     } finally {
         setIsLoading(false);
     }
  };
  
  const updateField = (field: keyof Movie, value: any) => {
      if (!movieData) return;
      setMovieData({ ...movieData, [field]: value });
  };

  const updateArrayField = (field: keyof Movie, value: string) => {
      if (!movieData) return;
      // Limpa aspas e colchetes agressivamente antes de dividir
      const arr = value.replace(/[\[\]"]/g, '').split(',').map(s => s.trim()).filter(Boolean);
      setMovieData({ ...movieData, [field]: arr });
  };

  return (
    <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 1060 }}>
        <div className="modal-dialog modal-lg modal-dialog-centered">
            <div className="modal-content bg-dark border-secondary shadow-lg">
                <div className="modal-header border-bottom border-secondary">
                    <h5 className="modal-title text-white d-flex align-items-center gap-2">
                        <PlusCircle className="text-success" /> Adicionar Título
                    </h5>
                    <button className="btn-close btn-close-white" onClick={onClose}></button>
                </div>
                
                <div className="modal-body p-4">
                    {!movieData && (
                        <div className="d-flex justify-content-center mb-4 overflow-auto pb-2">
                            <div className="btn-group shadow border border-secondary" role="group">
                                <button 
                                    className={`btn ${activeTab === 'url' ? 'btn-primary-custom' : 'btn-dark'}`} 
                                    onClick={() => setActiveTab('url')}
                                    title="Extrair dados da URL"
                                >
                                    <Sparkles size={16} className="me-2 d-none d-md-inline" /> IA URL
                                </button>
                                <button 
                                    className={`btn ${activeTab === 'tmdb' ? 'btn-primary-custom' : 'btn-dark'}`} 
                                    onClick={() => setActiveTab('tmdb')}
                                    title="The Movie Database"
                                >
                                    <Clapperboard size={16} className="me-2 d-none d-md-inline" /> TMDb
                                </button>
                                <button 
                                    className={`btn ${activeTab === 'omdb' ? 'btn-primary-custom' : 'btn-dark'}`} 
                                    onClick={() => setActiveTab('omdb')}
                                    title="Filmes do OMDb"
                                >
                                    <Database size={16} className="me-2 d-none d-md-inline" /> OMDb
                                </button>
                                <button 
                                    className={`btn ${activeTab === 'tvmaze' ? 'btn-primary-custom' : 'btn-dark'}`} 
                                    onClick={() => setActiveTab('tvmaze')}
                                    title="Séries do TVMaze"
                                >
                                    <Tv size={16} className="me-2 d-none d-md-inline" /> TVMaze
                                </button>
                                <button 
                                    className={`btn ${activeTab === 'ofdb' ? 'btn-primary-custom' : 'btn-dark'}`} 
                                    onClick={() => setActiveTab('ofdb')}
                                    title="Online Filmdatenbank"
                                >
                                    <Globe2 size={16} className="me-2 d-none d-md-inline" /> OFDb
                                </button>
                                <button 
                                    className={`btn ${activeTab === 'qid' ? 'btn-primary-custom' : 'btn-dark'}`} 
                                    onClick={() => setActiveTab('qid')}
                                    title="Wikidata ID"
                                >
                                    <BookOpen size={16} className="me-2 d-none d-md-inline" /> Wikidata (QID)
                                </button>
                                <button 
                                    className={`btn ${activeTab === 'csv' ? 'btn-primary-custom' : 'btn-dark'}`} 
                                    onClick={() => setActiveTab('csv')}
                                    title="Importar CSV"
                                >
                                    <FileText size={16} className="me-2 d-none d-md-inline" /> CSV
                                </button>
                                <button 
                                    className={`btn ${activeTab === 'discover' ? 'btn-primary-custom' : 'btn-dark'}`} 
                                    onClick={() => setActiveTab('discover')}
                                    title={t.discoverTitle || "Descobrir Domínio Público"}
                                >
                                    <Orbit size={16} className="me-2 d-none d-md-inline" /> {t.discoverTab || "Descobrir"}
                                </button>
                                <button 
                                    className={`btn ${activeTab === 'manual' ? 'btn-primary-custom' : 'btn-dark'}`} 
                                    onClick={() => {
                                        setActiveTab('manual');
                                        setMovieData({
                                            id: `indie-${Date.now()}`,
                                            title: '',
                                            year: new Date().getFullYear(),
                                            genres: ['Independente'],
                                            themes: [],
                                            cast: [],
                                            type: 'Movie',
                                            description: ''
                                        });
                                    }}
                                    title="Entrada Manual (Produção Independente)"
                                >
                                    <Edit3 size={16} className="me-2 d-none d-md-inline" /> Manual / Independente
                                </button>
                            </div>
                        </div>
                    )}

                    {!movieData ? (
                        <>
                            {activeTab === 'url' && (
                                <div className="text-center py-4">
                                    <h6 className="text-white mb-4">Cole a URL do vídeo (Archive.org, YouTube)</h6>
                                    <div className="input-group mb-3 max-w-lg mx-auto">
                                        <input 
                                            type="text" 
                                            className="form-control bg-black text-white border-secondary" 
                                            placeholder="https://..." 
                                            value={url}
                                            onChange={e => setUrl(e.target.value)}
                                        />
                                        <button className="btn btn-primary-custom d-flex align-items-center gap-2" onClick={handleExtract} disabled={isLoading || !url}>
                                            {isLoading ? <Loader2 className="animate-spin" /> : <Sparkles size={18} />} 
                                            {isLoading ? 'Analisando...' : 'Extrair'}
                                        </button>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'tmdb' && (
                                <div className="py-2">
                                    <div className="input-group mb-4">
                                        <input 
                                            type="text" 
                                            className="form-control bg-black text-white border-secondary" 
                                            placeholder="Busca no TMDb (ex: O Poderoso Chefão)..." 
                                            value={tmdbQuery}
                                            onChange={e => setTmdbQuery(e.target.value)}
                                            onKeyDown={e => e.key === 'Enter' && handleTmdbSearch()}
                                        />
                                        <button className="btn btn-outline-secondary text-white" onClick={handleTmdbSearch} disabled={isTmdbLoading}>
                                            <Search size={18} />
                                        </button>
                                    </div>
                                    
                                    {isTmdbLoading ? (
                                        <div className="text-center py-5"><Loader2 className="animate-spin text-primary-custom" size={32} /></div>
                                    ) : (
                                        <div className="list-group custom-scrollbar" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                                            {tmdbResults.map((movie) => (
                                                <button 
                                                    key={movie.id} 
                                                    className="list-group-item list-group-item-action bg-black text-white border-secondary d-flex gap-3 align-items-center"
                                                    onClick={() => handleSelectTmdbMovie(movie)}
                                                >
                                                    {movie.posterUrl ? (
                                                        <img src={movie.posterUrl || null} alt={movie.title} style={{ width: '40px', height: '60px', objectFit: 'cover' }} />
                                                    ) : (
                                                        <div className="bg-secondary" style={{ width: '40px', height: '60px' }}></div>
                                                    )}
                                                    <div>
                                                        <div className="fw-bold">{movie.title}</div>
                                                        <div className="small text-white-50">{movie.year} • <span className="text-warning">★ {movie.rating}</span></div>
                                                    </div>
                                                </button>
                                            ))}
                                            {tmdbResults.length === 0 && tmdbQuery && !isTmdbLoading && (
                                                <p className="text-center text-white-50">Nenhum resultado encontrado no TMDb.</p>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}

                            {activeTab === 'omdb' && (
                                <div className="py-2">
                                    <div className="input-group mb-4">
                                        <input 
                                            type="text" 
                                            className="form-control bg-black text-white border-secondary" 
                                            placeholder="Nome do filme (ex: Metropolis)..." 
                                            value={omdbQuery}
                                            onChange={e => setOmdbQuery(e.target.value)}
                                            onKeyDown={e => e.key === 'Enter' && handleOmdbSearch()}
                                        />
                                        <button className="btn btn-outline-secondary text-white" onClick={handleOmdbSearch} disabled={isOmdbLoading}>
                                            <Search size={18} />
                                        </button>
                                    </div>
                                    
                                    {isOmdbLoading ? (
                                        <div className="text-center py-5"><Loader2 className="animate-spin text-primary-custom" size={32} /></div>
                                    ) : (
                                        <div className="list-group custom-scrollbar" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                                            {omdbResults.map((movie) => (
                                                <button 
                                                    key={movie.id} 
                                                    className="list-group-item list-group-item-action bg-black text-white border-secondary d-flex gap-3 align-items-center"
                                                    onClick={() => handleSelectOmdbMovie(movie)}
                                                >
                                                    {movie.posterUrl && movie.posterUrl !== "N/A" ? (
                                                        <img src={movie.posterUrl || null} alt={movie.title} style={{ width: '40px', height: '60px', objectFit: 'cover' }} />
                                                    ) : (
                                                        <div className="bg-secondary" style={{ width: '40px', height: '60px' }}></div>
                                                    )}
                                                    <div>
                                                        <div className="fw-bold">{movie.title}</div>
                                                        <div className="small text-white-50">{movie.year}</div>
                                                    </div>
                                                </button>
                                            ))}
                                            {omdbResults.length === 0 && omdbQuery && !isOmdbLoading && (
                                                <p className="text-center text-white-50">Nenhum resultado encontrado.</p>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}

                            {activeTab === 'tvmaze' && (
                                <div className="py-2">
                                    <div className="input-group mb-4">
                                        <input 
                                            type="text" 
                                            className="form-control bg-black text-white border-secondary" 
                                            placeholder="Nome da série (ex: Doctor Who)..." 
                                            value={tvmazeQuery}
                                            onChange={e => setTvmazeQuery(e.target.value)}
                                            onKeyDown={e => e.key === 'Enter' && handleTvmazeSearch()}
                                        />
                                        <button className="btn btn-outline-secondary text-white" onClick={handleTvmazeSearch} disabled={isTvmazeLoading}>
                                            <Search size={18} />
                                        </button>
                                    </div>
                                    
                                    {isTvmazeLoading ? (
                                        <div className="text-center py-5"><Loader2 className="animate-spin text-primary-custom" size={32} /></div>
                                    ) : (
                                        <div className="list-group custom-scrollbar" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                                            {tvmazeResults.map((show) => (
                                                <button 
                                                    key={show.id} 
                                                    className="list-group-item list-group-item-action bg-black text-white border-secondary d-flex gap-3 align-items-center"
                                                    onClick={() => handleSelectTvmazeShow(show)}
                                                >
                                                    {show.posterUrl ? (
                                                        <img src={show.posterUrl || null} alt={show.title} style={{ width: '40px', height: '60px', objectFit: 'cover' }} />
                                                    ) : (
                                                        <div className="bg-secondary" style={{ width: '40px', height: '60px' }}></div>
                                                    )}
                                                    <div>
                                                        <div className="fw-bold">{show.title}</div>
                                                        <div className="small text-white-50">{show.year} • {show.type}</div>
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {activeTab === 'ofdb' && (
                                <div className="py-2">
                                    <div className="input-group mb-4">
                                        <input 
                                            type="text" 
                                            className="form-control bg-black text-white border-secondary" 
                                            placeholder="Nome em Alemão ou Inglês..." 
                                            value={ofdbQuery}
                                            onChange={e => setOfdbQuery(e.target.value)}
                                            onKeyDown={e => e.key === 'Enter' && handleOfdbSearch()}
                                        />
                                        <button className="btn btn-outline-secondary text-white" onClick={handleOfdbSearch} disabled={isOfdbLoading}>
                                            <Search size={18} />
                                        </button>
                                    </div>
                                    <p className="small text-white-50 fst-italic">* Busca feita via CORS Proxy no OFDb.de. Resultados podem variar.</p>
                                    
                                    {isOfdbLoading ? (
                                        <div className="text-center py-5"><Loader2 className="animate-spin text-primary-custom" size={32} /></div>
                                    ) : (
                                        <div className="list-group custom-scrollbar" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                                            {ofdbResults.map((movie) => (
                                                <button 
                                                    key={movie.id} 
                                                    className="list-group-item list-group-item-action bg-black text-white border-secondary d-flex gap-3 align-items-center"
                                                    onClick={() => handleSelectOfdbMovie(movie)}
                                                >
                                                    <div className="bg-secondary d-flex align-items-center justify-content-center" style={{ width: '40px', height: '60px' }}>
                                                        <Globe2 size={20} className="text-white-50"/>
                                                    </div>
                                                    <div>
                                                        <div className="fw-bold">{movie.title}</div>
                                                        <div className="small text-white-50">{movie.year}</div>
                                                    </div>
                                                </button>
                                            ))}
                                            {ofdbResults.length === 0 && ofdbQuery && !isOfdbLoading && (
                                                <p className="text-center text-white-50">Nenhum resultado encontrado no OFDb.</p>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}

                            {activeTab === 'qid' && (
                                <div className="text-center py-4">
                                    <h6 className="text-white mb-4">Insira o ID do Wikidata (Ex: Q42)</h6>
                                    <div className="input-group mb-3 max-w-lg mx-auto">
                                        <span className="input-group-text bg-secondary border-secondary text-white fw-bold">Q</span>
                                        <input 
                                            type="text" 
                                            className="form-control bg-black text-white border-secondary" 
                                            placeholder="12345..." 
                                            value={qidQuery}
                                            onChange={e => setQidQuery(e.target.value.replace(/^Q/i, ''))}
                                            onKeyDown={e => e.key === 'Enter' && handleQidSearch()}
                                        />
                                        <button className="btn btn-primary-custom d-flex align-items-center gap-2" onClick={handleQidSearch} disabled={isLoading || !qidQuery}>
                                            <Search size={18} />
                                        </button>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'discover' && (
                <div className="tab-pane active animate-in">
                  <div className="p-4 border border-info border-opacity-25 rounded-4 bg-info bg-opacity-5 mb-4 d-flex align-items-center gap-4">
                    <div className="bg-info p-3 rounded-circle shadow-sm">
                      <Orbit size={32} className="text-white" />
                    </div>
                    <div>
                      <h5 className="fw-bold mb-1 text-info">{t.discoverHeader || "Public Domain Scanner"}</h5>
                      <p className="text-white-50 small mb-0">{t.discoverSub || "Search Wikidata for public domain movies not yet in ClassicFlix."}</p>
                    </div>
                    <button 
                      onClick={handleDiscoverPublicDomain}
                      disabled={isDiscovering}
                      className="btn btn-info px-4 py-2 fw-bold text-white d-flex align-items-center gap-2 ms-auto shadow h-100"
                    >
                      {isDiscovering ? <Loader2 size={18} className="animate-spin" /> : <RefreshCw size={18} />}
                      {t.scanNow || "Scan Now"}
                    </button>
                  </div>

                  <div className="row g-3">
                    {discoveredMovies.map(movie => (
                      <div key={movie.wikidataId} className="col-md-6 col-lg-4">
                        <div className="card h-100 bg-dark border-secondary hover-scale shadow-sm overflow-hidden group">
                           {movie.posterUrl && (
                             <div className="position-relative" style={{ height: '140px' }}>
                               <img src={movie.posterUrl} className="w-100 h-100 object-fit-cover opacity-50 transition-all group-hover:opacity-100" referrerPolicy="no-referrer" />
                               <div className="position-absolute bottom-0 start-0 p-2 w-100 bg-dark bg-opacity-75">
                                 <span className="badge bg-danger text-white">{movie.year}</span>
                               </div>
                             </div>
                           )}
                           <div className="p-3">
                             <div className="fw-bold text-white text-truncate mb-1">{movie.title}</div>
                             <div className="xsmall text-white-50 mb-3 text-truncate">{movie.director}</div>
                             <button 
                               onClick={() => handleSelectDiscoveredMovie(movie)}
                               className="btn btn-sm btn-outline-info w-100 rounded-pill fw-bold"
                             >
                               {t.moreInfo || "Select & Detail"}
                             </button>
                           </div>
                        </div>
                      </div>
                    ))}
                    {!isDiscovering && discoveredMovies.length === 0 && (
                      <div className="col-12 text-center py-5">
                        <div className="opacity-25 mb-3">
                          <Search size={64} className="mx-auto" />
                        </div>
                        <p className="text-white-50">{t.noDiscoverResults || "Click \"Scan Now\" to find new gems across Wikidata."}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'csv' && (
                                <div className="py-2 text-center animate-in">
                                    <h6 className="text-white mb-4 d-flex align-items-center justify-content-center gap-2">
                                        <FileText className="text-success" /> Importar Filmes em Massa (CSV)
                                    </h6>
                                    
                                    {!csvFile ? (
                                        <div 
                                            className="border border-secondary border-dashed rounded p-5 bg-black bg-opacity-50 cursor-pointer hover-bg-dark transition"
                                            onClick={() => fileInputRef.current?.click()}
                                        >
                                            <Upload size={48} className="text-secondary mb-3 mx-auto" />
                                            <p className="text-white-50 mb-1">Clique para selecionar um arquivo .csv</p>
                                            <p className="text-secondary xsmall">Colunas obrigatórias: <code>qid</code> (ou wikidataid)</p>
                                            <p className="text-secondary xsmall">Opcionais: title, year, video, poster, genres, description, subtitle</p>
                                            <input 
                                                type="file" 
                                                accept=".csv" 
                                                className="d-none" 
                                                ref={fileInputRef}
                                                onChange={handleFileUpload}
                                            />
                                        </div>
                                    ) : (
                                        <div className="text-start">
                                            <div className="d-flex justify-content-between align-items-center mb-3">
                                                <span className="badge bg-success">{csvMovies.length} Filmes Encontrados</span>
                                                <button className="btn btn-sm btn-outline-secondary" onClick={() => { setCsvFile(null); setCsvMovies([]); }}>Trocar Arquivo</button>
                                            </div>
                                            
                                            <div className="table-responsive border border-secondary rounded mb-3" style={{ maxHeight: '300px' }}>
                                                <table className="table table-dark table-sm table-striped mb-0 small">
                                                    <thead>
                                                        <tr>
                                                            <th>QID (Required)</th>
                                                            <th>Título</th>
                                                            <th>Ano</th>
                                                            <th>Vídeo</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {csvMovies.slice(0, 10).map((m, i) => (
                                                            <tr key={i}>
                                                                <td className="font-monospace text-warning">{m.wikidataId}</td>
                                                                <td>{m.title || 'Untitled'}</td>
                                                                <td>{m.year}</td>
                                                                <td className="text-truncate" style={{ maxWidth: '150px' }}>{m.videoUrl}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                                {csvMovies.length > 10 && <div className="text-center p-2 text-white-50 xsmall">... e mais {csvMovies.length - 10} itens</div>}
                                            </div>

                                            {isCsvProcessing ? (
                                                <div className="text-center py-3">
                                                    <p className="mb-2">Importando... {importProgress?.current} / {importProgress?.total}</p>
                                                    <div className="progress" style={{ height: '10px' }}>
                                                        <div 
                                                            className="progress-bar bg-success progress-bar-striped progress-bar-animated" 
                                                            style={{ width: `${importProgress ? (importProgress.current / importProgress.total) * 100 : 0}%` }}
                                                        ></div>
                                                    </div>
                                                </div>
                                            ) : (
                                                <button className="btn btn-success w-100 py-2 fw-bold" onClick={handleImportCSV}>
                                                    <Upload size={18} className="me-2" /> Iniciar Importação
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
                            {activeTab === 'manual' && (
                                <div className="text-center py-4 animate-in">
                                    <h6 className="text-white mb-2">Sugira uma Produção Independente</h6>
                                    <p className="text-white-50 small mb-4 mx-auto" style={{ maxWidth: '500px' }}>
                                        Use esta opção para obras que não estão no Wikidata ou outros catálogos. 
                                        O gênero <strong>"Independente"</strong> será adicionado automaticamente.
                                    </p>
                                    <button 
                                        className="btn btn-success px-5 py-2 fw-bold shadow d-flex align-items-center gap-2 mx-auto"
                                        onClick={() => {
                                            setMovieData({
                                                id: `indie-${Date.now()}`,
                                                title: '',
                                                year: new Date().getFullYear(),
                                                genres: ['Independente'],
                                                themes: [],
                                                cast: [],
                                                type: 'Movie',
                                                description: ''
                                            });
                                        }}
                                    >
                                        <PlusCircle size={20} /> Começar Cadastro Manual
                                    </button>
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="row g-3">
                             <div className="col-12 text-center mb-3">
                                 {movieData.posterUrl && movieData.posterUrl !== "N/A" ? (
                                     <img src={movieData.posterUrl || null} alt="Poster" className="rounded shadow-sm border border-secondary" style={{ height: '200px' }} />
                                 ) : (
                                     <div className="d-flex align-items-center justify-content-center bg-dark border border-secondary rounded" style={{ height: '200px', width: '140px', margin: '0 auto' }}>
                                         <p className="text-white-50 small text-center px-2">Sem Imagem</p>
                                     </div>
                                 )}
                             </div>

                             <div className="col-12">
                                <label className="form-label text-white-50 small">Link do Poster</label>
                                <input className="form-control bg-black text-white border-secondary" value={movieData.posterUrl || ''} onChange={e => updateField('posterUrl', e.target.value)} />
                             </div>

                             <div className="col-12">
                                <label className="form-label text-white-50 small">Link do Vídeo</label>
                                <div className="input-group">
                                    <input className="form-control bg-black text-white border-secondary" value={movieData.videoUrl || ''} onChange={e => updateField('videoUrl', e.target.value)} />
                                    <button 
                                        type="button"
                                        className={`btn ${isP2P ? 'btn-danger' : 'btn-outline-danger'} d-flex align-items-center gap-2`}
                                        onClick={() => p2pFileInputRef.current?.click()}
                                        title="Transmitir via P2P (Arquivo Local)"
                                    >
                                        <Radio size={16} className={isP2P ? 'animate-pulse' : ''} /> {isP2P ? 'Transmitindo P2P' : 'P2P'}
                                    </button>
                                </div>
                                <input 
                                    type="file" 
                                    ref={p2pFileInputRef} 
                                    className="d-none" 
                                    accept="video/*" 
                                    onChange={handleFileSelect} 
                                />
                                <video ref={p2pVideoRef} className="d-none" muted loop />
                             </div>

                             <div className="col-12">
                                <label className="form-label text-white-50 small"><Captions size={14} className="me-1"/>Link da Legenda (Recomendado: .vtt)</label>
                                <input className="form-control bg-black text-white border-secondary" placeholder="https://exemplo.com/legenda.vtt" value={movieData.subtitleUrl || ''} onChange={e => updateField('subtitleUrl', e.target.value)} />
                             </div>

                             <div className="col-md-8">
                                <label className="form-label text-white-50 small">Título</label>
                                <input className="form-control bg-black text-white border-secondary" value={movieData.title || ''} onChange={e => updateField('title', e.target.value)} />
                             </div>
                             <div className="col-md-4">
                                <label className="form-label text-white-50 small">Ano</label>
                                <input className="form-control bg-black text-white border-secondary" type="number" value={movieData.year || ''} onChange={e => updateField('year', parseInt(e.target.value))} />
                             </div>
                             
                             <div className="col-12">
                                <label className="form-label text-white-50 small">Descrição</label>
                                <textarea className="form-control bg-black text-white border-secondary" rows={3} value={movieData.description || ''} onChange={e => updateField('description', e.target.value)} />
                             </div>

                             <div className="col-md-6">
                                <label className="form-label text-white-50 small">Gêneros (separados por vírgula)</label>
                                <input className="form-control bg-black text-white border-secondary" value={Array.isArray(movieData.genres) ? movieData.genres.join(', ') : ''} onChange={e => updateArrayField('genres', e.target.value)} />
                             </div>
                             <div className="col-md-6">
                                <label className="form-label text-white-50 small">Temas (separados por vírgula)</label>
                                <input className="form-control bg-black text-white border-secondary" value={Array.isArray(movieData.themes) ? movieData.themes.join(', ') : ''} onChange={e => updateArrayField('themes', e.target.value)} />
                             </div>
                             <div className="col-md-6">
                                <label className="form-label text-white-50 small">Wikidata ID / IMDb ID</label>
                                <input className="form-control bg-black text-white border-secondary" value={movieData.wikidataId || ''} onChange={e => updateField('wikidataId', e.target.value)} />
                             </div>

                             <div className="col-12 mt-4 d-flex justify-content-end gap-2">
                                 <button className="btn btn-outline-secondary" onClick={() => setMovieData(null)}>Voltar</button>
                                 <button className="btn btn-success d-flex align-items-center gap-2" onClick={handleSave} disabled={isLoading}>
                                     {isLoading ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />} Salvar
                                 </button>
                             </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    </div>
  );
};
