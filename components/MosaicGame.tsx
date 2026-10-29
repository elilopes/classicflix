import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { X, CheckCircle, AlertCircle, Edit3, Save, RefreshCw, Puzzle, Info } from 'lucide-react';
import { updateUserScore } from '../services/scoreService';

const MOVIE_LIST = [
  { id: 1, title: "O Nascimento de Uma Nação (1915)", object: "Capuz da Ku Klux Klan" },
  { id: 2, title: "Intolerância (1916)", object: "Portão de Babilônia" },
  { id: 3, title: "O Gabinete do Dr. Caligari (1920)", object: "Uma faca serrilhada" },
  { id: 4, title: "O Garoto (1921)", object: "O chapéu de coco e a bengala" },
  { id: 5, title: "Nosferatu (1922)", object: "O caixão de Drácula" },
  { id: 6, title: "Dr. Mabuse, o Jogador (1922)", object: "Cartas de baralho" },
  { id: 7, title: "O Encouraçado Potemkin (1925)", object: "O carrinho de bebê" },
  { id: 8, title: "A General (1926)", object: "O chapéu do maquinista" },
  { id: 9, title: "A Paixão de Joana d'Arc (1928)", object: "Uma cruz de madeira" },
  { id: 10, title: "Metrópolis (1927)", object: "O robô Maria" },
  { id: 11, title: "Aurora (1927)", object: "Uma lanterna de navio" },
  { id: 12, title: "Asas (1927)", object: "Uma hélice de avião" },
  { id: 13, title: "O vento (1928)", object: "Uma girândola" },
  { id: 14, title: "A Caixa de Pandora (1929)", object: "Uma caixa de joias" },
  { id: 15, title: "Tempos Modernos (1936)", object: "Uma engrenagem de máquina" },
];

// Default grid positions if not set
const DEFAULT_HOTSPOTS = MOVIE_LIST.map((m, i) => ({
  movieId: m.id,
  x: 10 + (i % 5) * 20,
  y: 10 + Math.floor(i / 5) * 30,
}));

interface MosaicGameProps {
  onClose: () => void;
  currentUser?: any;
  onMoreInfo?: (title: string) => void;
  onOpenLogin: () => void;
}

export default function MosaicGame({ onClose, currentUser, onMoreInfo, onOpenLogin }: MosaicGameProps) {
  const [selectedMovieId, setSelectedMovieId] = useState<number | null>(null);
  const [matches, setMatches] = useState<Record<number, number>>({}); // movieId -> hotspotId (which is also movieId)
  const [errors, setErrors] = useState<Record<number, boolean>>({}); // hotspotId -> true if error
  const [hotspots, setHotspots] = useState(DEFAULT_HOTSPOTS);
  const [editMode, setEditMode] = useState(false);
  const [editingMovieId, setEditingMovieId] = useState<number | null>(null);
  const [score, setScore] = useState(1000);
  const [revealedHints, setRevealedHints] = useState<Record<number, boolean>>({});
  const [saved, setSaved] = useState(false);

  const isAdmin = currentUser?.email === 'liclopes@gmail.com';

  useEffect(() => {
    const saved = localStorage.getItem('mosaic_hotspots');
    if (saved) {
      try {
        setHotspots(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to load hotspots", e);
      }
    }
  }, []);

  const saveHotspots = () => {
    localStorage.setItem('mosaic_hotspots', JSON.stringify(hotspots));
    setEditMode(false);
    setEditingMovieId(null);
  };

  const resetGame = () => {
    setMatches({});
    setErrors({});
    setSelectedMovieId(null);
    setScore(1000);
    setRevealedHints({});
    setSaved(false);
  };

  const handleImageClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!editMode || !editingMovieId) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    setHotspots(prev => prev.map(h => 
      h.movieId === editingMovieId ? { ...h, x, y } : h
    ));
  };

  const handleHotspotClick = (e: React.MouseEvent, hotspotMovieId: number) => {
    e.stopPropagation();
    
    if (editMode) {
      setEditingMovieId(hotspotMovieId);
      return;
    }

    if (!selectedMovieId) return;

    if (selectedMovieId === hotspotMovieId) {
      // Correct match
      setMatches(prev => ({ ...prev, [selectedMovieId]: hotspotMovieId }));
      setScore(prev => prev + 100);
      setSelectedMovieId(null);
    } else {
      // Wrong match
      setErrors(prev => ({ ...prev, [hotspotMovieId]: true }));
      setScore(prev => prev - 20);
      setTimeout(() => {
        setErrors(prev => ({ ...prev, [hotspotMovieId]: false }));
      }, 1000);
    }
  };

  const handleRevealHint = (movieId: number) => {
    setRevealedHints(prev => ({ ...prev, [movieId]: true }));
    setScore(prev => prev - 50);
  };

  const isGameComplete = Object.keys(matches).length === MOVIE_LIST.length;

  useEffect(() => {
    if (isGameComplete && currentUser && !saved) {
      updateUserScore('mosaicscore', score).then(() => setSaved(true)).catch(console.error);
    }
  }, [isGameComplete, currentUser, score, saved]);

  const handleSaveScore = () => {
    if (!currentUser) {
      onOpenLogin();
    } else {
      updateUserScore('mosaicscore', score).then(() => setSaved(true)).catch(console.error);
    }
  };

  return (
    <div className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center p-3" style={{ backgroundColor: 'rgba(0,0,0,0.9)', zIndex: 10000, backdropFilter: 'blur(5px)' }}>
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-dark border border-secondary w-100 rounded-4 overflow-hidden shadow-lg position-relative d-flex flex-column"
        style={{ maxWidth: '1140px', maxHeight: '90vh' }}
      >
        {/* Header */}
        <div className="p-3 border-bottom border-secondary d-flex justify-content-between align-items-center" style={{ backgroundColor: 'rgba(33,37,41,0.5)' }}>
          <h5 className="m-0 text-white d-flex align-items-center gap-2">
            <Puzzle className="text-info" size={24} /> Mosaico do Cinema Mudo
            <span className="badge bg-primary ms-3 fs-6">Pontos: {score}</span>
          </h5>
          <div className="d-flex align-items-center gap-2">
            {isAdmin && (
              <button 
                onClick={() => setEditMode(!editMode)}
                className={`btn btn-sm rounded-circle ${editMode ? 'btn-warning' : 'btn-outline-secondary text-white-50'}`}
                title="Modo de Edição (Ajustar posições)"
              >
                <Edit3 size={18} />
              </button>
            )}
            <button onClick={resetGame} className="btn btn-sm btn-outline-secondary rounded-circle text-white-50" title="Reiniciar Jogo">
              <RefreshCw size={18} />
            </button>
            <button onClick={onClose} className="btn btn-sm btn-outline-secondary rounded-circle text-white-50">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="d-flex flex-column flex-md-row flex-grow-1 overflow-hidden" style={{ minHeight: 0 }}>
          
          {/* Left: Image Area */}
          <div className="flex-grow-1 position-relative bg-black d-flex flex-column align-items-center justify-content-center p-3 overflow-auto" style={{ minHeight: 0 }}>
            <div className="w-100 d-flex justify-content-end mb-2">
              <a 
                href="https://drive.google.com/file/d/1O6dkYwH97u-YwkYFwi9caS77uPRyocc9/view?usp=drive_link" 
                target="_blank" 
                rel="noopener noreferrer"
                className="btn btn-sm btn-outline-secondary rounded-pill d-flex align-items-center gap-1 text-white-50"
                title="Abrir imagem original no Google Drive (caso não carregue)"
              >
                Ver Imagem Original
              </a>
            </div>
            <div 
              className="position-relative d-inline-block mw-100"
              onClick={handleImageClick}
              style={{ cursor: editMode && editingMovieId ? 'crosshair' : 'default' }}
            >
              <img 
                src="/mosaico.webp" 
                alt="Mosaico de Objetos" 
                className="mw-100 rounded shadow-lg"
                style={{ maxHeight: '70vh', objectFit: 'contain' }}
                referrerPolicy="no-referrer"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  if (!target.dataset.fallbackTried) {
                    target.dataset.fallbackTried = "true";
                    target.src = "https://drive.google.com/thumbnail?id=1O6dkYwH97u-YwkYFwi9caS77uPRyocc9&sz=w2000";
                  } else if (!target.dataset.secondFallbackTried) {
                    target.dataset.secondFallbackTried = "true";
                    target.src = "https://lh3.googleusercontent.com/d/1O6dkYwH97u-YwkYFwi9caS77uPRyocc9";
                  }
                }}
              />
              
              {/* Hotspots */}
              {hotspots.map(hotspot => {
                const isMatched = Object.values(matches).includes(hotspot.movieId);
                const isError = errors[hotspot.movieId];
                const isEditingThis = editMode && editingMovieId === hotspot.movieId;
                
                let hotspotClass = "position-absolute translate-middle d-flex align-items-center justify-content-center rounded-circle fw-bold small shadow-lg ";
                let hotspotStyle: React.CSSProperties = { left: `${hotspot.x}%`, top: `${hotspot.y}%`, transition: 'all 0.3s' };

                if (editMode) {
                  hotspotClass += "border border-2 ";
                  hotspotStyle.width = '32px';
                  hotspotStyle.height = '32px';
                  hotspotStyle.cursor = 'pointer';
                  if (isEditingThis) {
                    hotspotClass += "bg-warning text-dark border-white z-3 ";
                  } else {
                    hotspotClass += "bg-dark text-white-50 border-secondary ";
                  }
                } else if (isMatched) {
                  hotspotClass += "bg-success text-white border border-2 border-white ";
                  hotspotStyle.width = '40px';
                  hotspotStyle.height = '40px';
                  hotspotStyle.transform = 'translate(-50%, -50%) scale(1.1)';
                } else if (isError) {
                  hotspotClass += "bg-danger text-white border border-2 border-light animate-shake ";
                  hotspotStyle.width = '48px';
                  hotspotStyle.height = '48px';
                } else {
                  hotspotClass += "border border-2 border-white text-transparent hover-text-white ";
                  hotspotStyle.width = '48px';
                  hotspotStyle.height = '48px';
                  hotspotStyle.cursor = 'pointer';
                  hotspotStyle.backgroundColor = 'rgba(255,255,255,0.2)';
                  hotspotStyle.borderStyle = 'dashed';
                }
                
                return (
                  <div
                    key={hotspot.movieId}
                    onClick={(e) => handleHotspotClick(e, hotspot.movieId)}
                    className={hotspotClass}
                    style={hotspotStyle}
                    title={editMode ? `Editar posição: ${MOVIE_LIST.find(m => m.id === hotspot.movieId)?.title}` : ''}
                  >
                    {isMatched || editMode ? hotspot.movieId : '?'}
                  </div>
                );
              })}
            </div>

            {editMode && isAdmin && (
              <div className="position-absolute bottom-0 start-0 end-0 m-3 p-3 rounded border border-warning shadow-lg" style={{ backdropFilter: 'blur(10px)', backgroundColor: 'rgba(33,37,41,0.9)' }}>
                <div className="d-flex justify-content-between align-items-center">
                  <div>
                    <h6 className="text-warning fw-bold d-flex align-items-center gap-2 m-0">
                      <Edit3 size={18} /> Modo de Edição Ativo
                    </h6>
                    <p className="small text-white-50 m-0 mt-1">
                      1. Selecione um filme na lista à direita.<br/>
                      2. Clique na imagem para definir a posição do objeto correspondente.
                    </p>
                  </div>
                  <button 
                    onClick={saveHotspots}
                    className="btn btn-warning fw-bold d-flex align-items-center gap-2"
                  >
                    <Save size={18} /> Salvar Posições
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Right: Movie List */}
          <div className="w-100 bg-dark border-start border-secondary d-flex flex-column flex-grow-1" style={{ maxWidth: '400px', minHeight: 0 }}>
            <div className="p-3 border-bottom border-secondary" style={{ backgroundColor: 'rgba(33,37,41,0.5)' }}>
              <h6 className="fw-bold text-white mb-1">Lista de Filmes</h6>
              <p className="small text-white-50 m-0">
                {editMode 
                  ? "Selecione um filme para ajustar sua posição na imagem." 
                  : "Selecione um filme e clique no objeto correspondente na imagem."}
              </p>
            </div>
            
            <div className="flex-grow-1 overflow-auto p-2 d-flex flex-column gap-2 custom-scrollbar" style={{ minHeight: 0 }}>
              {MOVIE_LIST.map(movie => {
                const isMatched = matches[movie.id] !== undefined;
                const isSelected = selectedMovieId === movie.id;
                const isEditingThis = editMode && editingMovieId === movie.id;

                let btnClass = "w-100 text-start p-3 rounded border d-flex align-items-start gap-3 ";
                if (isMatched) {
                  btnClass += "border-success opacity-75 ";
                  btnClass += "bg-success bg-opacity-25";
                } else if (isSelected) {
                  btnClass += "border-primary shadow ";
                  btnClass += "bg-primary bg-opacity-25";
                } else if (isEditingThis) {
                  btnClass += "border-warning ";
                  btnClass += "bg-warning bg-opacity-25";
                } else {
                  btnClass += "border-secondary bg-dark text-white ";
                }

                return (
                  <div
                    key={movie.id}
                    onClick={() => {
                      if (!editMode && isMatched) return;
                      editMode ? setEditingMovieId(movie.id) : (!isMatched && setSelectedMovieId(movie.id));
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        if (!editMode && isMatched) return;
                        editMode ? setEditingMovieId(movie.id) : (!isMatched && setSelectedMovieId(movie.id));
                      }
                    }}
                    role="button"
                    tabIndex={(!editMode && isMatched) ? -1 : 0}
                    aria-disabled={!editMode && isMatched}
                    className={btnClass}
                    style={{ 
                      transition: 'all 0.2s', 
                      cursor: (!editMode && isMatched) ? 'default' : 'pointer',
                      opacity: (!editMode && isMatched) ? 0.75 : 1
                    }}
                  >
                    <div className={`flex-shrink-0 rounded-circle d-flex align-items-center justify-content-center fw-bold small ${isMatched ? 'bg-success text-white' : 'bg-secondary text-white'}`} style={{ width: '24px', height: '24px' }}>
                      {isMatched ? <CheckCircle size={14} /> : movie.id}
                    </div>
                    <div className="flex-grow-1">
                      <div className={`fw-bold small ${isMatched ? 'text-success text-decoration-line-through' : 'text-white'}`}>
                        {movie.title}
                      </div>
                      <div className="small mt-1">
                        {isAdmin || revealedHints[movie.id] || isMatched ? (
                          <span className="text-white-50">Dica: {movie.object}</span>
                        ) : (
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleRevealHint(movie.id); }}
                            className="btn btn-sm btn-outline-warning py-0 px-2 mt-1"
                            style={{ fontSize: '0.7rem' }}
                          >
                            Exibir Dica (-50 pts)
                          </button>
                        )}
                      </div>
                    </div>
                    {onMoreInfo && (
                      <button
                        onClick={(e) => { e.stopPropagation(); onMoreInfo(movie.title); }}
                        className="btn btn-sm btn-outline-info rounded-circle p-1 ms-auto flex-shrink-0"
                        title="Mais info"
                      >
                        <Info size={16} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {isGameComplete && !editMode && (
              <div className="p-3 text-center border-top border-success" style={{ backgroundColor: 'rgba(25,135,84,0.2)' }}>
                <h5 className="text-success fw-bold mb-2">🎉 Parabéns!</h5>
                <p className="small text-white-50 mb-3">Você encontrou todos os objetos clássicos.</p>
                <div className="d-flex flex-column gap-2">
                  <button 
                    onClick={resetGame}
                    className="btn btn-success w-100 fw-bold"
                  >
                    Jogar Novamente
                  </button>
                  {!saved && (
                    <button 
                      onClick={handleSaveScore}
                      className="btn btn-outline-warning w-100 fw-bold"
                    >
                      <Save size={18} /> Salvar Pontuação
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </motion.div>

      <style dangerouslySetInnerHTML={{__html: `
        @keyframes shake {
          0%, 100% { transform: translate(-50%, -50%) rotate(0deg); }
          25% { transform: translate(-55%, -50%) rotate(-5deg); }
          50% { transform: translate(-45%, -50%) rotate(5deg); }
          75% { transform: translate(-55%, -50%) rotate(-5deg); }
        }
        .animate-shake {
          animation: shake 0.4s ease-in-out;
        }
        .hover-text-white:hover {
          color: white !important;
          background-color: rgba(255,255,255,0.4) !important;
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(0,0,0,0.2);
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255,255,255,0.2);
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255,255,255,0.4);
        }
      `}} />
    </div>
  );
}
