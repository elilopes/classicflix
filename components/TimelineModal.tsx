
import React, { useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Calendar, Film, Globe, Info, TrendingUp, History, MapPin, ChevronDown } from 'lucide-react';
import { Movie, AppLanguage } from '../types';
import { HISTORICAL_EVENTS, HistoricalEvent } from '../constants/historicalEvents';

interface TimelineModalProps {
  isOpen: boolean;
  onClose: () => void;
  movies: Movie[];
  language: AppLanguage;
}

export const TimelineModal: React.FC<TimelineModalProps> = ({ isOpen, onClose, movies, language }) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [selectedYear, setSelectedYear] = useState<number | string>('');

  const timelineData = useMemo(() => {
    // Group movies by year
    const moviesByYear: Record<number, Movie[]> = {};
    movies.forEach(movie => {
      const year = parseInt(movie.year?.toString() || '0');
      if (year > 0) {
        if (!moviesByYear[year]) moviesByYear[year] = [];
        moviesByYear[year].push(movie);
      }
    });

    // Get all unique years from movies and historical events
    const allYears = new Set<number>([
      ...Object.keys(moviesByYear).map(Number),
      ...HISTORICAL_EVENTS.map(e => e.year)
    ]);

    // Sort years
    const sortedYears = Array.from(allYears).sort((a, b) => a - b);

    return sortedYears.map(year => ({
      year,
      movies: moviesByYear[year] || [],
      events: HISTORICAL_EVENTS.filter(e => e.year === year)
    }));
  }, [movies]);

  const handleEventSelect = (year: number) => {
    setSelectedYear(year);
    const element = document.getElementById(`year-${year}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.9)', zIndex: 1070 }}>
      <div className="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable">
        <motion.div 
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          className="modal-content bg-dark border-secondary shadow-lg overflow-hidden"
          style={{ height: '85vh' }}
        >
          <div className="modal-header border-secondary bg-black py-3 d-flex justify-content-between align-items-center">
            <div className="d-flex align-items-center gap-4 flex-grow-1">
              <h5 className="modal-title text-white d-flex align-items-center gap-2 m-0">
                <History className="text-danger" /> 
                {language === 'pt' ? 'Linha do Tempo Interativa' : 'Interactive Timeline'}
              </h5>
              
              <div className="position-relative" style={{ minWidth: '250px' }}>
                <select 
                  className="form-select form-select-sm bg-dark text-white border-secondary shadow-none pe-5"
                  value={selectedYear}
                  onChange={(e) => handleEventSelect(Number(e.target.value))}
                  style={{ cursor: 'pointer' }}
                >
                  <option value="">{language === 'pt' ? 'Ir para um evento...' : 'Jump to event...'}</option>
                  {HISTORICAL_EVENTS.sort((a, b) => a.year - b.year).map((event, idx) => (
                    <option key={idx} value={event.year}>
                      {event.year} - {language === 'pt' ? event.titlePt : event.titleEn}
                    </option>
                  ))}
                </select>
                <div className="position-absolute end-0 top-50 translate-middle-y pe-2 pointer-events-none opacity-50">
                  <ChevronDown size={14} className="text-white" />
                </div>
              </div>
            </div>
            <button className="btn-close btn-close-white ms-3" onClick={onClose}></button>
          </div>
          
          <div 
            ref={scrollContainerRef}
            className="modal-body p-0 custom-scrollbar overflow-auto bg-black"
          >
            <div className="container py-5">
              <div className="position-relative">
                {/* Vertical Line */}
                <div className="position-absolute start-50 translate-middle-x h-100 bg-secondary opacity-25" style={{ width: '2px', top: 0 }}></div>
                
                {timelineData.map((item, index) => (
                  <div key={item.year} id={`year-${item.year}`} className="row mb-5 position-relative">
                    {/* Year Marker */}
                    <div className="position-absolute start-50 translate-middle-x z-3">
                      <div className="bg-danger text-white fw-bold rounded-pill px-3 py-1 shadow-lg border border-dark" style={{ fontSize: '0.85rem' }}>
                        {item.year}
                      </div>
                    </div>

                    {/* Left Side: Historical Events */}
                    <div className="col-6 pe-5 text-end">
                      <AnimatePresence>
                        {item.events.map((event, eIdx) => (
                          <motion.div 
                            key={eIdx}
                            initial={{ opacity: 0, x: -20 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true }}
                            className="mb-3"
                          >
                            <div className="d-inline-flex align-items-center gap-2 text-danger xsmall fw-bold mb-1 uppercase tracking-wider">
                              <Globe size={12} /> {language === 'pt' ? 'História Mundial' : 'World History'}
                            </div>
                            <h6 className="text-white fw-bold mb-1">{language === 'pt' ? event.titlePt : event.titleEn}</h6>
                            <p className="text-white-50 small m-0">{language === 'pt' ? event.descriptionPt : event.descriptionEn}</p>
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    </div>

                    {/* Right Side: Movies/Catalog */}
                    <div className="col-6 ps-5">
                      <AnimatePresence>
                        {item.movies.length > 0 ? (
                          <div className="d-flex flex-column gap-3">
                            <div className="d-inline-flex align-items-center gap-2 text-info xsmall fw-bold mb-1 uppercase tracking-wider">
                              <Film size={12} /> {language === 'pt' ? 'História do Cinema' : 'Cinema History'}
                            </div>
                            {item.movies.map(movie => (
                              <motion.div 
                                key={movie.id}
                                initial={{ opacity: 0, x: 20 }}
                                whileInView={{ opacity: 1, x: 0 }}
                                viewport={{ once: true }}
                                className="bg-surface p-2 rounded border border-secondary d-flex gap-3 align-items-center shadow-sm hover-border-danger transition-all"
                              >
                                <div 
                                  style={{ width: '40px', height: '60px', background: '#333', backgroundImage: `url(${movie.posterUrl})`, backgroundSize: 'cover' }} 
                                  className="rounded flex-shrink-0"
                                ></div>
                                <div className="overflow-hidden">
                                  <div className="text-white fw-bold text-truncate small">{language === 'pt' ? (movie.titlePt || movie.title) : movie.title}</div>
                                  <div className="text-white-50 xsmall text-truncate">{movie.director}</div>
                                </div>
                              </motion.div>
                            ))}
                          </div>
                        ) : (
                          index === 0 && <div className="text-white-50 xsmall opacity-25 italic">Sem registros no catálogo para este período</div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          
          <div className="modal-footer border-secondary bg-black py-2">
            <p className="text-white-50 xsmall m-0">
              <Info size={12} className="me-1" /> 
              {language === 'pt' ? 'Navegue pelos eventos históricos em paralelo com nosso acervo.' : 'Browse historical events in parallel with our collection.'}
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
};
