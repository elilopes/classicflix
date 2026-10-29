
import React, { useState, useEffect } from 'react';
import { Database, Loader2, Plus, RefreshCw, Save, X } from 'lucide-react';
import { Movie } from '../types';
import { EditMetadataService } from '../services/editMetadataService';
import { sendEditToBackend } from '../services/wikidataWriteService';
import { fetchMovieByQid } from '../services/wikidataService';

interface WikidataEditorProps {
  movie?: Movie;
  onSuccess?: (qid: string) => void;
  isUserLoggedIn: boolean;
  onClose?: () => void;
}

export const WikidataEditor: React.FC<WikidataEditorProps> = ({ movie, onSuccess, isUserLoggedIn, onClose }) => {
  const [label, setLabel] = useState('');
  const [titlePt, setTitlePt] = useState('');
  const [description, setDescription] = useState('');
  const [descriptionPt, setDescriptionPt] = useState('');
  const [director, setDirector] = useState('');
  const [year, setYear] = useState('');
  const [originalLanguage, setOriginalLanguage] = useState('');
  const [originalTitle, setOriginalTitle] = useState('');
  const [producers, setProducers] = useState('');
  const [country, setCountry] = useState('');
  const [cinematography, setCinematography] = useState('');
  const [distribution, setDistribution] = useState('');
  const [genres, setGenres] = useState('');
  const [themes, setThemes] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [subtitleUrl, setSubtitleUrl] = useState('');
  const [posterUrl, setPosterUrl] = useState('');
  const [duration, setDuration] = useState('');
  const [awards, setAwards] = useState('');
  const [rating, setRating] = useState('');
  
  const [syncWithWikidata, setSyncWithWikidata] = useState(false);
  const [loadingCreate, setLoadingCreate] = useState(false);
  const [loadingUpdate, setLoadingUpdate] = useState(false);
  const [loadingLocal, setLoadingLocal] = useState(false);
  const [loadingSync, setLoadingSync] = useState(false);
  const [message, setMessage] = useState<{text: string, type: 'success' | 'error'} | null>(null);

  useEffect(() => {
    if (movie) {
      setLabel(movie.title || '');
      setTitlePt(movie.titlePt || '');
      setDescription(movie.description?.substring(0, 500) || '');
      setDescriptionPt(movie.descriptionPt?.substring(0, 500) || '');
      setYear(movie.year?.toString() || '');
      setDirector(movie.director && movie.director !== 'Unknown' ? movie.director : '');
      setOriginalTitle(movie.originalTitle || '');
      setGenres(movie.genres?.join(', ') || '');
      setThemes(movie.themes?.join(', ') || '');
      setVideoUrl(movie.videoUrl || '');
      setSubtitleUrl(movie.subtitleUrl || '');
      setPosterUrl(movie.posterUrl || '');
      setDuration(movie.duration || '');
      setAwards(movie.awards?.join(', ') || '');
      setRating(movie.rating || '');
    }
  }, [movie]);

  // Apenas usuários logados podem ver
  if (!isUserLoggedIn) {
    return (
      <div className="position-fixed top-0 start-0 w-100 h-100 bg-black bg-opacity-75 d-flex align-items-center justify-content-center" style={{ zIndex: 1055 }}>
        <div className="bg-dark p-4 rounded border border-secondary shadow-lg text-center position-relative" style={{ maxWidth: '400px' }}>
          {onClose && (
            <button onClick={onClose} className="btn btn-link text-white-50 position-absolute top-0 end-0 m-2 p-0">
              <X size={24} />
            </button>
          )}
          <p className="text-warning mb-0 mt-3">Você precisa estar logado para usar o Wikidata Editor.</p>
        </div>
      </div>
    );
  }

  const handleSyncFromWikidata = async () => {
    if (!movie?.wikidataId) return;
    setLoadingSync(true);
    try {
      const data = await fetchMovieByQid(movie.wikidataId);
      if (data) {
        setLabel(data.title || label);
        setDescription(data.description || description);
        setYear(data.year?.toString() || year);
        setDirector(data.directorId || director);
        setOriginalTitle(data.originalTitle || originalTitle);
        if (data.genres) setGenres(data.genres.join(', '));
        if (data.themes) setThemes(data.themes.join(', '));
        if (data.duration) setDuration(data.duration);
        setMessage({text: 'Dados importados do Wikidata com sucesso!', type: 'success'});
      }
    } catch (error) {
      setMessage({text: 'Erro ao sincronizar do Wikidata.', type: 'error'});
    } finally {
      setLoadingSync(false);
    }
  };

  const handleCreate = async () => {
    if (!label.trim() || !description.trim()) {
      setMessage({text: 'Preencha todos os campos obrigatórios (Label e Descrição).', type: 'error'});
      return;
    }

    setLoadingCreate(true);
    setMessage(null);

    try {
      const response = await fetch('/api/wikidata/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          label, description, language: 'pt',
          director, year, originalLanguage, originalTitle, producers, country, cinematography, distribution
        })
      });

      const data = await response.json();

      if (!response.ok) throw new Error(data.error || 'Erro ao criar item');

      setMessage({text: `Item criado com sucesso! QID: ${data.qid}`, type: 'success'});
      if (onSuccess) onSuccess(data.qid);
    } catch (error: any) {
      setMessage({text: error.message, type: 'error'});
    } finally {
      setLoadingCreate(false);
    }
  };

  const handleUpdate = async () => {
    if (!movie?.wikidataId) {
      setMessage({text: 'Filme não possui um ID do Wikidata para atualizar.', type: 'error'});
      return;
    }
    if (!label.trim() || !description.trim()) {
      setMessage({text: 'Preencha todos os campos obrigatórios (Label e Descrição).', type: 'error'});
      return;
    }

    setLoadingUpdate(true);
    setMessage(null);

    try {
      const response = await fetch('/api/wikidata/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          id: movie.wikidataId, label, description, language: 'pt',
          director, year, originalLanguage, originalTitle, producers, country, cinematography, distribution
        })
      });

      const data = await response.json();

      if (!response.ok) throw new Error(data.error || 'Erro ao atualizar item');

      setMessage({text: `Item atualizado com sucesso! QID: ${data.qid}`, type: 'success'});
      if (onSuccess) onSuccess(data.qid);
    } catch (error: any) {
      setMessage({text: error.message, type: 'error'});
    } finally {
      setLoadingUpdate(false);
    }
  };

  const handleSaveLocal = async () => {
    if (!movie?.id) {
      setMessage({text: 'ID do filme não encontrado.', type: 'error'});
      return;
    }

    if (!label.trim()) {
      setMessage({text: 'O título do filme é obrigatório.', type: 'error'});
      return;
    }

    setLoadingLocal(true);
    setMessage(null);

    try {
      // 1. Preparar dados para salvar
      const updates = {
        title: label,
        titlePt: titlePt,
        description: description,
        descriptionPt: descriptionPt,
        year: parseInt(year) || movie.year,
        director: director,
        originalTitle: originalTitle,
        wikidataId: movie.wikidataId,
        genres: genres.split(',').map(s => s.trim()).filter(Boolean),
        themes: themes.split(',').map(s => s.trim()).filter(Boolean),
        videoUrl: videoUrl,
        subtitleUrl: subtitleUrl,
        posterUrl: posterUrl,
        duration: duration,
        awards: awards.split(',').map(s => s.trim()).filter(Boolean),
        rating: rating,
        language: movie.language,
        hasSubtitles: !!subtitleUrl,
        type: movie.type,
        cast: movie.cast,
        cinematographers: movie.cinematographers,
        composers: movie.composers,
        license: movie.license,
        isIndependent: movie.isIndependent
      };

      // 2. Usar o serviço unificado
      await EditMetadataService.saveMovieMetadata(movie.id, updates, syncWithWikidata);

      setMessage({text: 'Metadados salvos com sucesso no Banco de Dados!', type: 'success'});
      if (onSuccess) onSuccess(movie.wikidataId || '');
    } catch (error: any) {
      setMessage({text: `Erro ao salvar: ${error.message}`, type: 'error'});
    } finally {
      setLoadingLocal(false);
    }
  };

  return (
    <div className="position-fixed top-0 start-0 w-100 h-100 bg-black bg-opacity-75 d-flex align-items-center justify-content-center" style={{ zIndex: 1055 }}>
      <div className="bg-dark p-4 rounded border border-secondary shadow-lg w-100" style={{ maxWidth: '800px', maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="d-flex justify-content-between align-items-center mb-4 border-bottom border-secondary pb-3">
          <div className="d-flex align-items-center gap-2">
            <div className="bg-danger p-2 rounded">
              <Database className="text-white" size={24} />
            </div>
            <div>
              <h4 className="text-white mb-0 fw-bold">Editor de Metadados</h4>
              <p className="text-secondary xsmall mb-0">Sincronize Supabase e Wikidata</p>
            </div>
          </div>
          <div className="d-flex gap-2">
            {movie?.wikidataId && (
              <button 
                onClick={handleSyncFromWikidata}
                disabled={loadingSync}
                className="btn btn-outline-info btn-sm d-flex align-items-center gap-1"
                title="Importar dados do Wikidata"
              >
                {loadingSync ? <Loader2 className="animate-spin" size={16} /> : <RefreshCw size={16} />}
                Importar Wikidata
              </button>
            )}
            {onClose && (
              <button onClick={onClose} className="btn btn-link text-secondary p-0 ms-2">
                <X size={24} />
              </button>
            )}
          </div>
        </div>
        
        <input 
          className="form-control bg-black text-white border-secondary mb-2"
          placeholder="Nome da Produção (Label / Título EN)"
          value={label}
          onChange={e => setLabel(e.target.value)}
        />
        <input 
          className="form-control bg-black text-white border-secondary mb-2"
          placeholder="Título em Português"
          value={titlePt}
          onChange={e => setTitlePt(e.target.value)}
        />
        <textarea 
          className="form-control bg-black text-white border-secondary mb-2"
          placeholder="Descrição (Inglês)"
          rows={3}
          value={description}
          onChange={e => setDescription(e.target.value)}
        />
        <textarea 
          className="form-control bg-black text-white border-secondary mb-3"
          placeholder="Descrição (Português)"
          rows={3}
          value={descriptionPt}
          onChange={e => setDescriptionPt(e.target.value)}
        />
        
        <div className="row g-2 mb-3">
          <div className="col-12 col-md-6">
            <input 
              className="form-control bg-black text-white border-secondary"
              placeholder="Título Original"
              value={originalTitle}
              onChange={e => setOriginalTitle(e.target.value)}
            />
          </div>
          <div className="col-12 col-md-6">
            <input 
              className="form-control bg-black text-white border-secondary"
              placeholder="Ano (ex: 2023)"
              value={year}
              onChange={e => setYear(e.target.value)}
            />
          </div>
          <div className="col-12 col-md-6">
            <input 
              className="form-control bg-black text-white border-secondary"
              placeholder="Diretor (QID)"
              value={director}
              onChange={e => setDirector(e.target.value)}
            />
          </div>
          <div className="col-12 col-md-6">
            <input 
              className="form-control bg-black text-white border-secondary"
              placeholder="Idioma Original (QID)"
              value={originalLanguage}
              onChange={e => setOriginalLanguage(e.target.value)}
            />
          </div>
          <div className="col-12 col-md-6">
            <input 
              className="form-control bg-black text-white border-secondary"
              placeholder="Produtores (QID)"
              value={producers}
              onChange={e => setProducers(e.target.value)}
            />
          </div>
          <div className="col-12 col-md-6">
            <input 
              className="form-control bg-black text-white border-secondary"
              placeholder="País de Origem (QID)"
              value={country}
              onChange={e => setCountry(e.target.value)}
            />
          </div>
          <div className="col-12 col-md-6">
            <input 
              className="form-control bg-black text-white border-secondary"
              placeholder="Direção de Fotografia (QID)"
              value={cinematography}
              onChange={e => setCinematography(e.target.value)}
            />
          </div>
          <div className="col-12 col-md-6">
            <input 
              className="form-control bg-black text-white border-secondary"
              placeholder="Distribuição (QID)"
              value={distribution}
              onChange={e => setDistribution(e.target.value)}
            />
          </div>
        </div>

        <h6 className="text-danger xsmall fw-bold mb-3 uppercase border-bottom border-secondary pb-2">Metadados Adicionais (Supabase)</h6>
        <div className="row g-2 mb-3">
          <div className="col-12 col-md-6">
            <input 
              className="form-control bg-black text-white border-secondary"
              placeholder="Gêneros (ação, drama...)"
              value={genres}
              onChange={e => setGenres(e.target.value)}
            />
          </div>
          <div className="col-12 col-md-6">
            <input 
              className="form-control bg-black text-white border-secondary"
              placeholder="Temas (noir, cyberpunk...)"
              value={themes}
              onChange={e => setThemes(e.target.value)}
            />
          </div>
          <div className="col-12">
            <input 
              className="form-control bg-black text-white border-secondary"
              placeholder="URL do Vídeo"
              value={videoUrl}
              onChange={e => setVideoUrl(e.target.value)}
            />
          </div>
          <div className="col-12">
            <input 
              className="form-control bg-black text-white border-secondary"
              placeholder="URL da Legenda (.vtt)"
              value={subtitleUrl}
              onChange={e => setSubtitleUrl(e.target.value)}
            />
          </div>
          <div className="col-12">
            <input 
              className="form-control bg-black text-white border-secondary"
              placeholder="URL do Poster"
              value={posterUrl}
              onChange={e => setPosterUrl(e.target.value)}
            />
          </div>
          <div className="col-12 col-md-4">
            <input 
              className="form-control bg-black text-white border-secondary"
              placeholder="Duração (ex: 1h 30m)"
              value={duration}
              onChange={e => setDuration(e.target.value)}
            />
          </div>
          <div className="col-12 col-md-4">
            <input 
              className="form-control bg-black text-white border-secondary"
              placeholder="Classificação"
              value={rating}
              onChange={e => setRating(e.target.value)}
            />
          </div>
          <div className="col-12 col-md-4">
            <input 
              className="form-control bg-black text-white border-secondary"
              placeholder="Prêmios"
              value={awards}
              onChange={e => setAwards(e.target.value)}
            />
          </div>
        </div>
        
        <div className="d-flex flex-column gap-3 mt-4">
          <div className="form-check form-switch">
            <input 
              className="form-check-input" 
              type="checkbox" 
              id="syncSwitch"
              checked={syncWithWikidata}
              onChange={e => setSyncWithWikidata(e.target.checked)}
            />
            <label className="form-check-label text-white-50 small" htmlFor="syncSwitch">
              Sincronizar descrição com Wikidata ao salvar no BD
            </label>
          </div>

          <div className="d-flex gap-2">
            <button 
              className="btn btn-primary flex-grow-1 d-flex align-items-center justify-content-center gap-2 py-2"
              onClick={handleSaveLocal}
              disabled={loadingLocal || !movie?.id}
            >
              {loadingLocal ? <Loader2 size={20} className="animate-spin" /> : <><Database size={18} /> Salvar no Supabase</>}
            </button>

            {!movie?.wikidataId ? (
              <button 
                className="btn btn-danger flex-grow-1 d-flex align-items-center justify-content-center gap-2 py-2"
                onClick={handleCreate}
                disabled={loadingCreate || loadingUpdate || !label.trim()}
              >
                {loadingCreate ? <Loader2 size={20} className="animate-spin" /> : 'Criar no Wikidata'}
              </button>
            ) : (
              <button 
                className="btn btn-warning flex-grow-1 d-flex align-items-center justify-content-center gap-2 text-dark fw-bold py-2"
                onClick={handleUpdate}
                disabled={loadingCreate || loadingUpdate}
              >
                {loadingUpdate ? <Loader2 size={20} className="animate-spin" /> : <><RefreshCw size={18} /> Atualizar no Wikidata</>}
              </button>
            )}
          </div>
        </div>

        {message && (
          <div className={`mt-3 p-3 rounded text-center ${message.type === 'success' ? 'bg-success bg-opacity-20 text-success' : 'bg-danger bg-opacity-20 text-danger'}`}>
            {message.text}
          </div>
        )}
      </div>
    </div>
  );
};
