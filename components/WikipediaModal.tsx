import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, ExternalLink, Loader2, BookOpen } from 'lucide-react';

interface WikipediaModalProps {
  isOpen: boolean;
  onClose: () => void;
  searchTerm: string;
  onFilterDirector?: (director: string) => void;
}

export const WikipediaModal: React.FC<WikipediaModalProps> = ({ isOpen, onClose, searchTerm, onFilterDirector }) => {
  const [content, setContent] = useState<{ title: string; extract: string; thumbnail?: string; url: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && searchTerm) {
      fetchWikiData();
    }
  }, [isOpen, searchTerm]);

  const fetchWikiData = async () => {
    setLoading(true);
    setError(null);
    try {
      // First try Portuguese Wikipedia
      let response = await fetch(`https://pt.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(searchTerm)}`);
      
      if (!response.ok) {
        // Fallback to English Wikipedia if not found in Portuguese
        response = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(searchTerm)}`);
      }

      if (!response.ok) {
        throw new Error('Não foi possível encontrar informações sobre esta pessoa.');
      }

      const data = await response.json();
      setContent({
        title: data.title,
        extract: data.extract,
        thumbnail: data.thumbnail?.source,
        url: data.content_urls.desktop.page
      });
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar dados da Wikipedia.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div 
          className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center p-3 p-md-4" 
          style={{ zIndex: 1200, backgroundColor: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(10px)' }}
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.5, y: 50, rotateX: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0, rotateX: 0 }}
            exit={{ opacity: 0, scale: 0.5, y: 50, rotateX: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 350 }}
            className="bg-dark border border-secondary w-100 shadow-lg overflow-hidden"
            style={{ maxWidth: '800px', borderRadius: '1.5rem', position: 'relative' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-3 border-bottom border-secondary d-flex justify-content-between align-items-center bg-black bg-opacity-50">
              <div className="d-flex align-items-center gap-2">
                <div className="bg-success bg-opacity-20 p-2 rounded-circle">
                  <BookOpen className="text-success" size={20} />
                </div>
                <div>
                  <h3 className="m-0 text-white fs-5 fw-bold">Biografia</h3>
                  <p className="m-0 text-secondary xsmall uppercase tracking-wider">{searchTerm}</p>
                </div>
              </div>
              <button 
                onClick={onClose} 
                className="btn btn-link text-secondary p-2 hover-white transition-all rounded-circle bg-white bg-opacity-5"
              >
                <X size={24} />
              </button>
            </div>

            <div className="p-4 overflow-auto custom-scrollbar" style={{ maxHeight: '70vh' }}>
              {loading ? (
                <div className="d-flex flex-column align-items-center justify-content-center py-5 gap-3">
                  <Loader2 className="text-success animate-spin" size={40} />
                  <p className="text-secondary m-0">Consultando Wikipedia...</p>
                </div>
              ) : error ? (
                <div className="text-center py-5">
                  <p className="text-danger mb-4">{error}</p>
                  <button 
                    onClick={fetchWikiData}
                    className="btn btn-outline-light px-4"
                  >
                    Tentar novamente
                  </button>
                </div>
              ) : content ? (
                <div className="d-flex flex-column gap-4">
                  <div className="row g-4">
                    {content.thumbnail && (
                      <div className="col-md-4">
                        <img 
                          src={content.thumbnail} 
                          alt={content.title}
                          className="img-fluid rounded border border-secondary shadow"
                          style={{ objectFit: 'cover', width: '100%' }}
                          referrerPolicy="no-referrer"
                        />
                      </div>
                    )}
                    <div className={content.thumbnail ? "col-md-8" : "col-12"}>
                      <h2 className="text-white fw-bold mb-3 fs-3">{content.title}</h2>
                      <div className="text-light lh-lg" style={{ fontSize: '1.05rem', opacity: 0.9 }}>
                        {content.extract}
                      </div>
                    </div>
                  </div>
                  
                  <div className="pt-4 border-top border-secondary d-flex justify-content-end gap-3">
                    {onFilterDirector && (
                      <button
                        onClick={() => {
                          onFilterDirector(searchTerm);
                          onClose();
                        }}
                        className="btn btn-outline-light rounded-pill px-4 py-2 d-flex align-items-center gap-2 fw-bold shadow-sm hover-scale transition-all"
                      >
                        <span>Ver produção visual completa</span>
                      </button>
                    )}
                    <a 
                      href={content.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="btn btn-success rounded-pill px-4 py-2 d-flex align-items-center gap-2 text-decoration-none fw-bold shadow-sm hover-scale transition-all"
                    >
                      <span>Ver artigo completo</span>
                      <ExternalLink size={18} />
                    </a>
                  </div>
                </div>
              ) : null}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
