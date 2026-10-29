
import React from 'react';
import { Movie } from '../types';
import { X, Copy, Check, ExternalLink, Info, HelpCircle } from 'lucide-react';
import { WikidataGuideModal } from './WikidataGuideModal';

interface WikidataHelperModalProps {
  movie: Movie;
  onClose: () => void;
}

export const WikidataHelperModal: React.FC<WikidataHelperModalProps> = ({ movie, onClose }) => {
  const [copiedField, setCopiedField] = React.useState<string | null>(null);
  const [showGuide, setShowGuide] = React.useState(false);

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const wikidataFields = [
    { label: 'Label (Português)', value: movie.titlePt || movie.title, desc: 'O nome da obra em português.' },
    { label: 'Label (English)', value: movie.title, desc: 'The name of the work in English.' },
    { label: 'Description (Português)', value: `filme de ${movie.year} dirigido por ${movie.director}`, desc: 'Uma breve descrição da obra.' },
    { label: 'Description (English)', value: `${movie.year} film directed by ${movie.director}`, desc: 'A brief description of the work.' },
  ];

  const statements = [
    { prop: 'P31 (instance of)', value: 'Q11424 (film)', desc: 'Define que este item é um filme.' },
    { prop: 'P57 (director)', value: movie.director, desc: 'O diretor da obra (procure pelo QID do diretor no Wikidata).' },
    { prop: 'P577 (publication date)', value: movie.year?.toString() || '', desc: 'O ano de lançamento.' },
    { prop: 'P136 (genre)', value: movie.genres.join(', '), desc: 'Os gêneros cinematográficos.' },
    { prop: 'P2047 (duration)', value: movie.duration, desc: 'A duração da obra.' },
    { prop: 'P18 (image)', value: movie.posterUrl, desc: 'URL da imagem (deve ser carregada no Wikimedia Commons primeiro).' },
  ];

  return (
    <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 1150 }}>
      <div className="modal-dialog modal-lg modal-dialog-centered">
        <div className="modal-content bg-dark border-secondary shadow-lg">
          <div className="modal-header border-secondary">
            <h5 className="modal-title text-white d-flex align-items-center gap-2">
              <Info className="text-info" /> Preparar para Wikidata
            </h5>
            <div className="ms-auto d-flex align-items-center gap-2">
              <button 
                className="btn btn-sm btn-outline-info d-flex align-items-center gap-2 px-3"
                onClick={() => setShowGuide(true)}
              >
                <HelpCircle size={16} /> Ver Guia
              </button>
              <button className="btn-close btn-close-white" onClick={onClose}></button>
            </div>
          </div>
          <div className="modal-body p-4 custom-scrollbar" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
            <div className="alert alert-info bg-info bg-opacity-10 border-info text-info small mb-4">
              <p className="mb-0">
                O Wikidata não permite criação automática via este site. Use os dados abaixo para preencher o formulário de 
                <strong> "Novo Item" </strong> no Wikidata manualmente.
              </p>
            </div>

            <section className="mb-4">
              <h6 className="text-danger fw-bold mb-3 uppercase xsmall tracking-wider">Informações Básicas (Labels)</h6>
              <div className="d-flex flex-column gap-2">
                {wikidataFields.map((f, i) => (
                  <div key={i} className="bg-black p-3 rounded border border-secondary">
                    <div className="d-flex justify-content-between align-items-start mb-1">
                      <span className="text-white-50 xsmall fw-bold">{f.label}</span>
                      <button 
                        className="btn btn-link p-0 text-info" 
                        onClick={() => copyToClipboard(f.value, f.label)}
                      >
                        {copiedField === f.label ? <Check size={14} /> : <Copy size={14} />}
                      </button>
                    </div>
                    <div className="text-white small font-monospace">{f.value}</div>
                    <div className="text-white-50 xsmall mt-1 fst-italic">{f.desc}</div>
                  </div>
                ))}
              </div>
            </section>

            <section>
              <h6 className="text-danger fw-bold mb-3 uppercase xsmall tracking-wider">Declarações Sugeridas (Statements)</h6>
              <div className="table-responsive">
                <table className="table table-dark table-sm table-bordered small">
                  <thead>
                    <tr className="text-white-50 xsmall">
                      <th>Propriedade</th>
                      <th>Valor Sugerido</th>
                      <th>Ação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {statements.map((s, i) => (
                      <tr key={i}>
                        <td className="font-monospace text-info">{s.prop}</td>
                        <td>{s.value}</td>
                        <td className="text-center">
                          <button 
                            className="btn btn-link p-0 text-white-50" 
                            onClick={() => copyToClipboard(s.value, s.prop)}
                          >
                            {copiedField === s.prop ? <Check size={14} /> : <Copy size={14} />}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <div className="mt-4 d-grid">
              <a 
                href="https://www.wikidata.org/wiki/Special:NewItem" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="btn btn-primary d-flex align-items-center justify-content-center gap-2 py-2 fw-bold"
              >
                Ir para Wikidata: Criar Novo Item <ExternalLink size={18} />
              </a>
            </div>
          </div>
        </div>
      </div>
      
      {showGuide && (
        <WikidataGuideModal onClose={() => setShowGuide(false)} />
      )}
    </div>
  );
};
