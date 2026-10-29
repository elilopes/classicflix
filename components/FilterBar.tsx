
import React, { useRef } from 'react';
import { motion } from 'motion/react';
import { 
  Filter, Star, CalendarDays, Languages, Palette, Layers, 
  Clock4, MonitorPlay, Megaphone, Trophy, LayoutGrid, Type, TrendingUp, Image as ImageIcon, Play,
  ChevronLeft, ChevronRight
} from 'lucide-react';
import { FilterState, AppLanguage } from '../types';
import { 
  COLORS, DURATIONS, DECADES, RATING_CATEGORIES, MOST_WATCHED_MOVIES 
} from '../constants';

interface FilterBarProps {
  filters: FilterState;
  setFilters: (filters: FilterState) => void;
  appLanguage: AppLanguage;
  t: any;
  uniqueDirectors: string[];
  uniqueAwards: string[];
  viewMode: 'image' | 'text';
  setViewMode: (mode: 'image' | 'text') => void;
  languageCounts: Record<string, number>;
  genreCounts: Record<string, number>; 
  themeCounts: Record<string, number>; 
}

export const FilterBar: React.FC<FilterBarProps> = ({
  filters,
  setFilters,
  appLanguage,
  t,
  uniqueDirectors,
  uniqueAwards,
  viewMode,
  setViewMode,
  languageCounts,
  genreCounts,
  themeCounts
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  
  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = 300;
      scrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  const sortedGenres = Object.keys(genreCounts).sort();
  const sortedThemes = Object.keys(themeCounts).sort();
  const sortedLanguages = Object.keys(languageCounts).sort();

  const chipVariants = {
    initial: { opacity: 0, y: -10 },
    animate: { opacity: 1, y: 0 },
    hover: { scale: 1.05, backgroundColor: 'var(--md-surface-variant)' }
  };

  const containerVariants = {
    animate: {
      transition: {
        staggerChildren: 0.05
      }
    }
  };

  const selectStyle = {
    borderRadius: '100px',
    backgroundColor: 'var(--md-surface-variant)',
    border: '1px solid var(--md-outline)',
    color: 'var(--md-on-surface)',
    fontSize: '0.85rem',
    padding: '4px 12px',
    cursor: 'pointer',
    transition: 'all 0.2s ease'
  };

  const filterItemClass = "d-flex align-items-center gap-2 px-3 py-1 rounded-pill border shadow-sm flex-shrink-0";
  const FILTER_WIDTH = '150px';
  const FILTER_HEIGHT = '40px';

  return (
    <div 
      className="sticky-top" 
      style={{ 
        top: '65px', 
        zIndex: 100, 
        backgroundColor: 'rgba(20, 18, 24, 0.95)', 
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--md-outline)'
      }}
    >
      {/* Left Arrow */}
      <button 
        onClick={() => scroll('left')}
        className="btn btn-link text-white p-1 position-absolute start-0 top-50 translate-middle-y d-none d-md-flex align-items-center justify-content-center"
        style={{ zIndex: 101, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: '0 50% 50% 0', height: '40px', border: '1px solid rgba(255,255,255,0.1)', borderLeft: 'none' }}
      >
        <ChevronLeft size={20} />
      </button>

      <motion.div 
        ref={scrollRef}
        variants={containerVariants}
        initial="initial"
        animate="animate"
        className="container-fluid p-3 d-flex gap-2 flex-nowrap overflow-x-auto no-scrollbar" 
        style={{ 
          WebkitOverflowScrolling: 'touch',
          scrollSnapType: 'x proximity'
        }}
      >
        
        {/* NEW: Top 30 Most Watched */}
        <motion.div 
          variants={chipVariants} 
          whileHover="hover" 
          className={`${filterItemClass} border-warning`} 
          style={{ backgroundColor: 'rgba(255, 193, 7, 0.1)', width: FILTER_WIDTH, height: FILTER_HEIGHT, scrollSnapAlign: 'start' }}
        >
            <TrendingUp size={14} className="text-warning flex-shrink-0" />
            <select 
              className="form-select bg-transparent border-0 text-white shadow-none py-0 small flex-grow-1 text-truncate" 
              style={{ width: '0', minWidth: '0' }}
              value={filters.selectedTop30 || ""} 
              onChange={e => setFilters({...filters, selectedTop30: e.target.value || null})}
            >
                <option className="bg-dark text-white" value="">{t.top30Label}</option>
                {MOST_WATCHED_MOVIES.map(m => (
                    <option className="bg-dark text-white" key={m} value={m}>{m}</option>
                ))}
            </select>
        </motion.div>

        {/* NEW: Only with Poster Toggle */}
        <motion.button 
            variants={chipVariants}
            whileHover="hover"
            whileTap={{ scale: 0.95 }}
            className={`${filterItemClass} ${filters.hasPosterOnly ? 'bg-danger border-danger text-white' : 'bg-transparent border-secondary text-secondary'}`}
            onClick={() => setFilters({...filters, hasPosterOnly: !filters.hasPosterOnly})}
            style={{ width: FILTER_WIDTH, height: FILTER_HEIGHT, scrollSnapAlign: 'start' }}
        >
            <ImageIcon size={14} className="flex-shrink-0" />
            <span className="small fw-medium text-truncate">{t.onlyWithPoster}</span>
        </motion.button>

        {/* NEW: Video Only Toggle */}
        <motion.button 
            variants={chipVariants}
            whileHover="hover"
            whileTap={{ scale: 0.95 }}
            className={`${filterItemClass} ${filters.hasVideoOnly ? 'bg-danger border-danger text-white' : 'bg-transparent border-secondary text-secondary'}`}
            onClick={() => setFilters({...filters, hasVideoOnly: !filters.hasVideoOnly})}
            style={{ width: FILTER_WIDTH, height: FILTER_HEIGHT, scrollSnapAlign: 'start' }}
        >
            <Play size={14} className="flex-shrink-0" />
            <span className="small fw-medium text-truncate">{t.videoOnly}</span>
        </motion.button>

        {/* 1. Genres */}
        <motion.div 
          variants={chipVariants} 
          whileHover="hover" 
          className={`${filterItemClass} border-secondary`}
          style={{ width: FILTER_WIDTH, height: FILTER_HEIGHT, scrollSnapAlign: 'start' }}
        >
            <Filter size={14} className="text-secondary flex-shrink-0" />
            <select className="form-select bg-transparent border-0 text-white shadow-none py-0 small flex-grow-1 text-truncate" style={{ width: '0', minWidth: '0' }} value={filters.selectedGenre || ""} onChange={e => setFilters({...filters, selectedGenre: e.target.value || null})}>
                <option className="bg-dark text-white" value="">Gêneros</option>
                {sortedGenres.map(g => (
                    <option className="bg-dark text-white" key={g} value={g}>
                        {g} ({genreCounts[g]})
                    </option>
                ))}
            </select>
        </motion.div>

        {/* 2. Rating */}
        <motion.div 
          variants={chipVariants} 
          whileHover="hover" 
          className={`${filterItemClass} border-secondary`}
          style={{ width: FILTER_WIDTH, height: FILTER_HEIGHT, scrollSnapAlign: 'start' }}
        >
            <Star size={14} className="text-warning flex-shrink-0" />
            <select className="form-select bg-transparent border-0 text-white shadow-none py-0 small flex-grow-1 text-truncate" style={{ width: '0', minWidth: '0' }} value={filters.selectedRating || ""} onChange={e => setFilters({...filters, selectedRating: e.target.value || null})}>
                <option className="bg-dark text-white" value="">{t.rating}</option>
                {RATING_CATEGORIES.map(c => (
                    <option className="bg-dark text-white" key={c.id} value={c.id}>
                        {c.label[appLanguage] || c.label.pt}
                    </option>
                ))}
            </select>
        </motion.div>

        {/* 3. Decade */}
        <motion.div 
          variants={chipVariants} 
          whileHover="hover" 
          className={`${filterItemClass} border-secondary`}
          style={{ width: FILTER_WIDTH, height: FILTER_HEIGHT, scrollSnapAlign: 'start' }}
        >
            <CalendarDays size={14} className="text-info flex-shrink-0" />
            <select className="form-select bg-transparent border-0 text-white shadow-none py-0 small flex-grow-1 text-truncate" style={{ width: '0', minWidth: '0' }} value={filters.selectedDecade || ""} onChange={e => setFilters({...filters, selectedDecade: e.target.value ? parseInt(e.target.value) : null})}>
                <option className="bg-dark text-white" value="">{t.decade}</option>
                {DECADES.map(d => (
                    <option className="bg-dark text-white" key={d} value={d}>{d}s</option>
                ))}
            </select>
        </motion.div>

        {/* 4. Language */}
        <motion.div 
          variants={chipVariants} 
          whileHover="hover" 
          className={`${filterItemClass} border-secondary`}
          style={{ width: FILTER_WIDTH, height: FILTER_HEIGHT, scrollSnapAlign: 'start' }}
        >
            <Languages size={14} className="text-secondary flex-shrink-0" />
            <select className="form-select bg-transparent border-0 text-white shadow-none py-0 small flex-grow-1 text-truncate" style={{ width: '0', minWidth: '0' }} value={filters.selectedLanguage || ""} onChange={e => setFilters({...filters, selectedLanguage: e.target.value || null})}>
                <option className="bg-dark text-white" value="">Idiomas</option>
                {sortedLanguages.map(l => (
                    <option className="bg-dark text-white" key={l} value={l}>
                        {l} ({languageCounts[l]})
                    </option>
                ))}
            </select>
        </motion.div>

        {/* 5. Color */}
        <motion.div 
          variants={chipVariants} 
          whileHover="hover" 
          className={`${filterItemClass} border-secondary`}
          style={{ width: FILTER_WIDTH, height: FILTER_HEIGHT, scrollSnapAlign: 'start' }}
        >
            <Palette size={14} className="text-secondary flex-shrink-0" />
            <select className="form-select bg-transparent border-0 text-white shadow-none py-0 small flex-grow-1 text-truncate" style={{ width: '0', minWidth: '0' }} value={filters.selectedColor || ""} onChange={e => setFilters({...filters, selectedColor: e.target.value || null})}>
                <option className="bg-dark text-white" value="">Cor</option>
                {COLORS.map(c => (
                    <option className="bg-dark text-white" key={c} value={c}>{c}</option>
                ))}
            </select>
        </motion.div>

        {/* 6. Themes */}
        <motion.div 
          variants={chipVariants} 
          whileHover="hover" 
          className={`${filterItemClass} border-secondary`}
          style={{ width: FILTER_WIDTH, height: FILTER_HEIGHT, scrollSnapAlign: 'start' }}
        >
            <Layers size={14} className="text-secondary flex-shrink-0" />
            <select className="form-select bg-transparent border-0 text-white shadow-none py-0 small flex-grow-1 text-truncate" style={{ width: '0', minWidth: '0' }} value={filters.selectedTheme || ""} onChange={e => setFilters({...filters, selectedTheme: e.target.value || null})}>
                <option className="bg-dark text-white" value="">Temas</option>
                {sortedThemes.map(th => (
                    <option className="bg-dark text-white" key={th} value={th}>
                        {th} ({themeCounts[th]})
                    </option>
                ))}
            </select>
        </motion.div>

        {/* 7. Duration */}
        <motion.div 
          variants={chipVariants} 
          whileHover="hover" 
          className={`${filterItemClass} border-secondary`}
          style={{ width: FILTER_WIDTH, height: FILTER_HEIGHT, scrollSnapAlign: 'start' }}
        >
            <Clock4 size={14} className="text-secondary flex-shrink-0" />
            <select className="form-select bg-transparent border-0 text-white shadow-none py-0 small flex-grow-1 text-truncate" style={{ width: '0', minWidth: '0' }} value={filters.selectedDuration || ""} onChange={e => setFilters({...filters, selectedDuration: (e.target.value as any) || null})}>
                <option className="bg-dark text-white" value="">Duração</option>
                {DURATIONS.map(d => (
                    <option className="bg-dark text-white" key={d.id} value={d.id}>
                        {d.label[appLanguage] || d.label.en}
                    </option>
                ))}
            </select>
        </motion.div>

        {/* 8. Subtitles */}
        <motion.div 
          variants={chipVariants} 
          whileHover="hover" 
          className={`${filterItemClass} border-secondary`}
          style={{ width: FILTER_WIDTH, height: FILTER_HEIGHT, scrollSnapAlign: 'start' }}
        >
            <MonitorPlay size={14} className="text-secondary flex-shrink-0" />
            <select className="form-select bg-transparent border-0 text-white shadow-none py-0 small flex-grow-1 text-truncate" style={{ width: '0', minWidth: '0' }} value={filters.hasSubtitles == null ? "" : String(filters.hasSubtitles)} onChange={e => setFilters({...filters, hasSubtitles: e.target.value === "" ? null : e.target.value === "true"})}>
                <option className="bg-dark text-white" value="">Legendas</option>
                <option className="bg-dark text-white" value="true">Com Legenda</option>
                <option className="bg-dark text-white" value="false">Sem Legenda</option>
            </select>
        </motion.div>

        {/* 9. Director */}
        <motion.div 
          variants={chipVariants} 
          whileHover="hover" 
          className={`${filterItemClass} border-secondary`}
          style={{ width: FILTER_WIDTH, height: FILTER_HEIGHT, scrollSnapAlign: 'start' }}
        >
            <Megaphone size={14} className="text-secondary flex-shrink-0" />
            <select className="form-select bg-transparent border-0 text-white shadow-none py-0 small flex-grow-1 text-truncate" style={{ width: '0', minWidth: '0' }} value={filters.selectedDirector || ""} onChange={e => setFilters({...filters, selectedDirector: e.target.value || null})}>
                <option className="bg-dark text-white" value="">{t.director}</option>
                {uniqueDirectors.map(d => (
                    <option className="bg-dark text-white" key={d} value={d}>{d}</option>
                ))}
            </select>
        </motion.div>

        {/* 10. Awards */}
        <motion.div 
          variants={chipVariants} 
          whileHover="hover" 
          className={`${filterItemClass} border-secondary`}
          style={{ width: FILTER_WIDTH, height: FILTER_HEIGHT, scrollSnapAlign: 'start' }}
        >
            <Megaphone size={14} className="text-secondary flex-shrink-0" />
            <select className="form-select bg-transparent border-0 text-white shadow-none py-0 small flex-grow-1 text-truncate" style={{ width: '0', minWidth: '0' }} value={filters.selectedAward || ""} onChange={e => setFilters({...filters, selectedAward: e.target.value || null})}>
                <option className="bg-dark text-white" value="">{t.awards}</option>
                {uniqueAwards.map(a => (
                    <option className="bg-dark text-white" key={a} value={a}>{a}</option>
                ))}
            </select>
        </motion.div>

        {/* View Mode Toggle */}
        <motion.div variants={chipVariants} className="d-flex gap-1 bg-dark p-1 rounded-pill border border-secondary shadow-sm flex-shrink-0" style={{ scrollSnapAlign: 'start' }}>
            <motion.button 
              whileTap={{ scale: 0.9 }}
              className={`btn btn-sm rounded-circle p-2 ${viewMode === 'image' ? 'btn-danger' : 'btn-dark'}`} 
              onClick={() => setViewMode('image')} 
              title={t.imageMode}
            >
              <LayoutGrid size={16} />
            </motion.button>
            <motion.button 
              whileTap={{ scale: 0.9 }}
              className={`btn btn-sm rounded-circle p-2 ${viewMode === 'text' ? 'btn-danger' : 'btn-dark'}`} 
              onClick={() => setViewMode('text')} 
              title={t.textMode}
            >
              <Type size={16} />
            </motion.button>
        </motion.div>
        
        {/* Spacer for better scroll ending */}
        <div className="flex-shrink-0" style={{ width: '40px' }}></div>
      </motion.div>

      {/* Right Arrow */}
      <button 
        onClick={() => scroll('right')}
        className="btn btn-link text-white p-1 position-absolute end-0 top-50 translate-middle-y d-none d-md-flex align-items-center justify-content-center"
        style={{ zIndex: 101, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: '50% 0 0 50%', height: '40px', border: '1px solid rgba(255,255,255,0.1)', borderRight: 'none' }}
      >
        <ChevronRight size={20} />
      </button>
    </div>
  );
};
