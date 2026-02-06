
import React, { useState } from 'react';
import { 
  X, Edit3, Save, Loader2, Sparkles,
  Film, Calendar, Clock, Globe, User, Hash,
  Video, Tag, PlusCircle, CheckCircle, MonitorPlay,
  Palette, Music, Camera, Users, LayoutGrid, Search, Database, BookOpen, Tv, Globe2, Clapperboard
} from 'lucide-react';
import { addSupabaseMovie } from '../services/supabaseClient';
import { extractMetadataFromUrl } from '../services/geminiService';
import { searchOmdbMovies, getOmdbMovieDetails } from '../services/omdbService';
import { fetchMovieByQid } from '../services/wikidataService';
import { searchTvMaze, getTvMazeDetails } from '../services/tvmazeService';
import { searchOfdb } from '../services/ofdbService';
import { searchTmdbMovies, getTmdbMovieDetails } from '../services/tmdbService';
import { Movie } from '../types';

interface AddMovieModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export const AddMovieModal: React.FC<AddMovieModalProps> = ({ onClose, onSuccess }) => {
  const [activeTab, setActiveTab] = useState<'url' | 'tmdb' | 'omdb' | 'tvmaze' | 'ofdb' | 'qid'>('url');
  
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
  
  // Final Data State
  const [movieData, setMovieData] = useState<Partial<Movie> | null>(null);

  // --- HANDLERS FOR URL MODE ---
  const handleExtract = async () => {
    if (!url) return;
    setIsLoading(true);
    try {
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
                  themes: [], // TMDb doesn't give themes directly, user fills
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
      // OFDb scraping details is hard client-side, we use the basic info and let user fill rest
      setMovieData({
          ...ofdbMovie,
          id: `db-${Date.now()}`,
          videoUrl: '',
          genres: [],
          themes: [],
          description: `Imported from OFDb: ${ofdbMovie.title}`,
          posterUrl: '' // OFDb posters often protected or hard to scrape
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

  // --- SAVE HANDLER ---
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
      const arr = value.split(',').map(s => s.trim()).filter(Boolean);
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
                    {/* Mode Selection */}
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
                                    <BookOpen size={16} className="me-2 d-none d-md-inline" /> Wiki
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
                                                        <img src={movie.posterUrl} alt={movie.title} style={{ width: '40px', height: '60px', objectFit: 'cover' }} />
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
                                                        <img src={movie.posterUrl} alt={movie.title} style={{ width: '40px', height: '60px', objectFit: 'cover' }} />
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
                                                        <img src={show.posterUrl} alt={show.title} style={{ width: '40px', height: '60px', objectFit: 'cover' }} />
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
                        </>
                    ) : (
                        <div className="row g-3">
                             <div className="col-12 text-center mb-3">
                                 {movieData.posterUrl && movieData.posterUrl !== "N/A" ? (
                                     <img src={movieData.posterUrl} alt="Poster" className="rounded shadow-sm border border-secondary" style={{ height: '200px' }} />
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
                                <input className="form-control bg-black text-white border-secondary" value={movieData.videoUrl || ''} onChange={e => updateField('videoUrl', e.target.value)} />
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
