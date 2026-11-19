/// <reference types="vite/client" />
import React, { useEffect, useMemo, useState } from 'react';
import { Check, ExternalLink, Loader2, RefreshCw, X } from 'lucide-react';
import { Movie } from '../types';
import { WikidataPublicDomainProduction } from '../services/wikidataService';
import {
  ImportMediaCandidate,
  loadWikidataEnrichment,
  TmdbMetadataCandidate,
  WikidataEnrichmentResult,
} from '../services/wikidataEnrichmentService';
import { persistWikidataProduction } from '../services/supabaseClient';

type ImportField =
  | 'title' | 'titlePt' | 'originalTitle' | 'year' | 'language' | 'posterUrl'
  | 'videoUrl' | 'trailerUrl' | 'descriptionEn' | 'descriptionPt'
  | 'director' | 'duration' | 'genres' | 'themes' | 'license' | 'identifiers';

interface Props {
  item: WikidataPublicDomainProduction;
  existingMovie?: Movie;
  onClose: () => void;
  onSaved: () => void;
}

const fields: Array<{ key: ImportField; label: string }> = [
  { key: 'title', label: 'Título principal' },
  { key: 'titlePt', label: 'Título em português' },
  { key: 'originalTitle', label: 'Título original' },
  { key: 'year', label: 'Ano de lançamento' },
  { key: 'language', label: 'Idioma original' },
  { key: 'descriptionEn', label: 'Descrição original' },
  { key: 'descriptionPt', label: 'Descrição em português' },
  { key: 'director', label: 'Direção' },
  { key: 'duration', label: 'Duração' },
  { key: 'genres', label: 'Gêneros' },
  { key: 'themes', label: 'Temas' },
  { key: 'posterUrl', label: 'Pôster principal' },
  { key: 'videoUrl', label: 'Vídeo principal' },
  { key: 'trailerUrl', label: 'Trailer' },
  { key: 'license', label: 'Licença / direitos' },
  { key: 'identifiers', label: 'Identificadores externos' },
];

const textValue = (value: unknown): string => {
  if (Array.isArray(value)) return value.filter(Boolean).join(', ');
  if (value === null || value === undefined || value === '') return '—';
  return String(value);
};

const initialDraft = (item: WikidataPublicDomainProduction) => ({
  title: item.originalTitle || item.wikidataLabel || '',
  titlePt: item.titlePt || '',
  originalTitle: item.originalTitle || '',
  year: item.year || null,
  language: item.language === 'Não informado' ? '' : item.language,
  descriptionEn: item.descriptionEn || item.description || '',
  descriptionPt: item.descriptionPt || '',
  director: item.director || '',
  duration: item.duration || '',
  genres: item.genres || [],
  themes: item.themes || [],
  posterUrl: '',
  videoUrl: '',
  trailerUrl: '',
  license: item.licenseLabel || '',
  identifiers: {
    archiveId: item.archiveId || '',
    imdbId: item.imdbId || '',
    googleKnowId: item.googleKnowId || '',
    ofdbId: item.ofdbId || '',
    youtubeId: item.youtubeId || '',
    wikimediaCommons: item.commons || '',
    tmdbId: item.tmdbId || '',
  },
});

const existingValue = (movie: Movie | undefined, key: ImportField): unknown => {
  if (!movie) return undefined;
  const value = movie as any;
  switch (key) {
    case 'descriptionEn': return movie.description;
    case 'descriptionPt': return movie.descriptionPt;
    case 'genres': return movie.genres;
    case 'themes': return movie.themes;
    case 'identifiers': return movie.identifiers;
    case 'license': return movie.license || movie.sourceLabel;
    default: return value[key];
  }
};

export const WikidataImportReview: React.FC<Props> = ({ item, existingMovie, onClose, onSaved }) => {
  const isUpdate = Boolean(existingMovie);
  const [draft, setDraft] = useState<any>(() => initialDraft(item));
  const [selectedFields, setSelectedFields] = useState<Set<ImportField>>(
    () => new Set(isUpdate ? [] : fields.map((field) => field.key))
  );
  const [enrichment, setEnrichment] = useState<WikidataEnrichmentResult | null>(null);
  const [loadingSources, setLoadingSources] = useState(true);
  const [selectedMedia, setSelectedMedia] = useState<Set<string>>(new Set());
  const [selectedTmdbId, setSelectedTmdbId] = useState('');
  const [sourceByField, setSourceByField] = useState<Record<string, { source: string; url: string }>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLoadingSources(true);
    loadWikidataEnrichment(item)
      .then((result) => { if (active) setEnrichment(result); })
      .catch((err: any) => { if (active) setError(err?.message || 'Falha ao consultar fontes complementares.'); })
      .finally(() => { if (active) setLoadingSources(false); });
    return () => { active = false; };
  }, [item.wikidataId]);

  const toggleField = (key: ImportField) => {
    setSelectedFields((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const applyTmdbCandidate = (candidate: TmdbMetadataCandidate) => {
    setSelectedTmdbId(candidate.tmdbId);
    setDraft((current: any) => ({
      ...current,
      title: candidate.title || current.title,
      originalTitle: candidate.originalTitle || current.originalTitle,
      year: candidate.year || current.year,
      descriptionEn: candidate.overview || current.descriptionEn,
      director: candidate.director || current.director,
      genres: candidate.genres?.length ? candidate.genres : current.genres,
      duration: candidate.duration || current.duration,
      posterUrl: candidate.posterUrl || current.posterUrl,
      identifiers: { ...current.identifiers, tmdbId: candidate.tmdbId, imdbId: candidate.imdbId || current.identifiers.imdbId },
    }));
    const url = candidate.pageUrl;
    setSourceByField((current) => ({
      ...current,
      ...Object.fromEntries(['title','originalTitle','year','descriptionEn','director','genres','duration','posterUrl','identifiers'].map((key) => [key, { source: 'tmdb', url }])),
    }));
  };

  const toggleMedia = (candidate: ImportMediaCandidate) => {
    setSelectedMedia((current) => {
      const next = new Set(current);
      if (next.has(candidate.id)) next.delete(candidate.id);
      else next.add(candidate.id);
      return next;
    });
  };

  const useMediaAsVideo = (candidate: ImportMediaCandidate) => {
    const field: ImportField = candidate.media_type === 'trailer' ? 'trailerUrl' : 'videoUrl';
    setDraft((current: any) => ({ ...current, [field]: candidate.url }));
    setSelectedFields((current) => new Set(current).add(field));
    setSourceByField((current) => ({ ...current, [field]: { source: candidate.source, url: candidate.page_url || candidate.url } }));
    setSelectedMedia((current) => new Set(current).add(candidate.id));
  };

  const useMediaAsPoster = (candidate: ImportMediaCandidate) => {
    setDraft((current: any) => ({ ...current, posterUrl: candidate.url }));
    setSelectedFields((current) => new Set(current).add('posterUrl'));
    setSourceByField((current) => ({ ...current, posterUrl: { source: candidate.source, url: candidate.page_url || candidate.url } }));
    setSelectedMedia((current) => new Set(current).add(candidate.id));
  };

  const oldAndNew = useMemo(() => fields.map((field) => ({
    ...field,
    oldValue: existingValue(existingMovie, field.key),
    newValue: field.key === 'title' ? draft.title
      : field.key === 'titlePt' ? draft.titlePt
      : field.key === 'originalTitle' ? draft.originalTitle
      : field.key === 'descriptionEn' ? draft.descriptionEn
      : field.key === 'descriptionPt' ? draft.descriptionPt
      : field.key === 'identifiers' ? draft.identifiers
      : field.key === 'license' ? draft.license
      : draft[field.key],
  })), [existingMovie, draft]);

  const handleSave = async () => {
    if (isUpdate && selectedFields.size === 0 && selectedMedia.size === 0) {
      setError('Selecione pelo menos um campo ou material para registrar.');
      return;
    }
    if (!isUpdate && !draft.title && !draft.originalTitle) {
      setError('A produção precisa ter um título.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const selectedMediaItems = (enrichment?.media || []).filter((candidate) => selectedMedia.has(candidate.id));
      const sources = {
        ...sourceByField,
        ...Object.fromEntries(Array.from(selectedFields).filter((key) => !sourceByField[key]).map((key) => [
          key, { source: 'wikidata', url: `https://www.wikidata.org/wiki/${item.wikidataId}` },
        ])),
      };
      const jobId = await persistWikidataProduction({
        action: isUpdate ? 'update' : 'insert',
        item,
        draft,
        selectedFields: Array.from(selectedFields),
        sources,
        media: selectedMediaItems,
      });
      setError('');
      onSaved();
      onClose();
      console.info('ClassicFlix import job:', jobId);
    } catch (err: any) {
      setError(err?.message || 'Não foi possível salvar a produção.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center p-2" style={{ zIndex: 1300, background: 'rgba(0,0,0,.88)' }}>
      <div className="bg-dark text-white border border-secondary rounded-3 shadow-lg w-100" style={{ maxWidth: 1050, maxHeight: '94vh', overflowY: 'auto' }}>
        <div className="d-flex justify-content-between align-items-center p-3 border-bottom border-secondary sticky-top bg-dark">
          <div>
            <h5 className="mb-1">{isUpdate ? 'Revisar atualização seletiva' : 'Revisar nova produção'}</h5>
            <div className="small text-secondary">{item.wikidataId} · {item.originalTitle}</div>
          </div>
          <button className="btn btn-sm btn-outline-light" onClick={onClose} disabled={saving}><X size={16}/></button>
        </div>
        <div className="p-3">
          <div className="alert alert-info py-2 small">
            {isUpdate
              ? 'Marque somente os campos que deseja substituir. Campos não selecionados permanecem intactos no Supabase.'
              : 'Confira os metadados antes de cadastrar. A gravação e o histórico serão confirmados na mesma transação.'}
          </div>

          <h6 className="text-info">Comparação de metadados</h6>
          <div className="table-responsive">
            <table className="table table-dark table-sm align-middle">
              <thead><tr><th style={{width:34}}>Usar</th><th>Campo</th><th>Valor atual</th><th>Valor proposto</th></tr></thead>
              <tbody>
                {oldAndNew.map((field) => (
                  <tr key={field.key}>
                    <td><input type="checkbox" checked={selectedFields.has(field.key)} onChange={() => toggleField(field.key)} /></td>
                    <td className="text-nowrap">{field.label}</td>
                    <td className="small text-secondary" style={{maxWidth:220, overflowWrap:'anywhere'}}>{textValue(field.oldValue)}</td>
                    <td className="small" style={{maxWidth:300, overflowWrap:'anywhere'}}>{textValue(field.newValue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="d-flex flex-wrap gap-2 align-items-center mb-2">
            <h6 className="text-info mb-0">Fontes complementares</h6>
            {loadingSources && <span className="small text-secondary"><Loader2 size={13} className="animate-spin"/> Consultando Commons, Internet Archive, TMDb e YouTube…</span>}
            {!loadingSources && <button className="btn btn-sm btn-outline-secondary" onClick={() => { setEnrichment(null); setLoadingSources(true); loadWikidataEnrichment(item).then(setEnrichment).catch((e:any)=>setError(e.message)).finally(()=>setLoadingSources(false)); }}><RefreshCw size={13}/> Reconsultar</button>}
          </div>

          {enrichment?.warnings.map((warning) => <div key={warning} className="small text-warning">{warning}</div>)}

          {enrichment?.tmdb.length ? (
            <div className="mb-3">
              <div className="small text-secondary mb-2">Correspondências TMDb — selecione uma correspondência para preencher a prévia; cada campo ainda precisa ser aprovado individualmente.</div>
              <div className="row g-2">
                {enrichment.tmdb.map((candidate) => (
                  <div className="col-md-6" key={candidate.tmdbId}>
                    <div className={`border rounded p-2 h-100 ${selectedTmdbId === candidate.tmdbId ? 'border-info' : 'border-secondary'}`}>
                      <div className="d-flex gap-2">
                        {candidate.posterUrl && <img src={candidate.posterUrl} alt="" style={{width:58, height:86, objectFit:'cover'}}/>}
                        <div className="flex-grow-1 small">
                          <strong>{candidate.title}</strong>
                          <div className="text-secondary">{candidate.originalTitle} · {candidate.year || 'Ano ausente'}</div>
                          <div className="text-secondary">TMDb ID: {candidate.tmdbId} · Nota: {candidate.rating || '—'}</div>
                          <a href={candidate.pageUrl} target="_blank" rel="noreferrer" className="text-info">Abrir TMDb <ExternalLink size={11}/></a>
                          <div><button className="btn btn-sm btn-outline-info mt-1" onClick={() => applyTmdbCandidate(candidate)}>{selectedTmdbId === candidate.tmdbId ? 'Correspondência aplicada' : 'Usar na prévia'}</button></div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : !loadingSources ? <div className="small text-secondary mb-3">Nenhuma correspondência TMDb confiável foi encontrada automaticamente.</div> : null}

          <div className="row g-2">
            {(enrichment?.media || []).map((candidate) => (
              <div className="col-md-6" key={candidate.id}>
                <div className="border border-secondary rounded p-2 h-100">
                  <div className="d-flex justify-content-between gap-2">
                    <label className="small d-flex gap-2">
                      <input type="checkbox" checked={selectedMedia.has(candidate.id)} onChange={() => toggleMedia(candidate)}/>
                      <span><strong>{candidate.source.toUpperCase()}</strong> · {candidate.media_type}</span>
                    </label>
                    <a href={candidate.page_url || candidate.url} target="_blank" rel="noreferrer" className="text-info small">Abrir <ExternalLink size={11}/></a>
                  </div>
                  {candidate.media_type === 'poster' || candidate.media_type === 'still' ? <img src={candidate.url} alt="" className="mt-2 rounded" style={{maxHeight:150,maxWidth:'100%',objectFit:'contain'}}/> : <div className="small text-secondary mt-2 text-break">{candidate.url}</div>}
                  <div className="small text-secondary mt-1">Licença: {candidate.license || 'Não informada — verificar antes de publicar'}</div>
                  {candidate.attribution && <div className="small text-secondary">Crédito: {candidate.attribution}</div>}
                  {(candidate.media_type === 'poster' || candidate.media_type === 'still') ? <button className="btn btn-sm btn-outline-light mt-2" onClick={() => useMediaAsPoster(candidate)}>Usar como pôster principal</button> : null}
                  {candidate.media_type === 'video' ? <button className="btn btn-sm btn-outline-light mt-2" onClick={() => useMediaAsVideo(candidate)}>Usar como vídeo principal</button> : null}
                  {candidate.media_type === 'trailer' ? <button className="btn btn-sm btn-outline-light mt-2" onClick={() => useMediaAsVideo(candidate)}>Usar como trailer</button> : null}
                </div>
              </div>
            ))}
          </div>

          {error && <div className="alert alert-danger mt-3 mb-0">{error}</div>}
        </div>
        <div className="d-flex justify-content-between gap-2 p-3 border-top border-secondary">
          <button className="btn btn-outline-secondary" onClick={onClose} disabled={saving}>Cancelar</button>
          <button className="btn btn-success" onClick={handleSave} disabled={saving || loadingSources}>
            {saving ? <><Loader2 size={15} className="animate-spin"/> Salvando…</> : <><Check size={15}/> {isUpdate ? 'Confirmar atualização selecionada' : 'Importar produção'}</>}
          </button>
        </div>
      </div>
    </div>
  );
};
