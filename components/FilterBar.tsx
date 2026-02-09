
import React from 'react';
import { 
  Filter, Star, CalendarDays, Languages, Palette, Layers, 
  Clock4, MonitorPlay, Megaphone, Trophy, LayoutGrid, Type, TrendingUp, Image as ImageIcon
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
  
  const sortedGenres = Object.keys(genreCounts).sort();
  const sortedThemes = Object.keys(themeCounts).sort();
  const sortedLanguages = Object.keys(languageCounts).sort();

  return (
    <div className="container-fluid p-3 bg-surface border-bottom border-secondary d-flex gap-2 flex-wrap sticky-top shadow-sm" style={{ top: '65px', zIndex: 100 }}>
        
        {/* NEW: Top 30 Most Watched */}
        <div className="d-flex align-items-center gap-1 bg-dark px-2 rounded border border-warning" style={{ borderStyle: 'dashed' }}>
            <TrendingUp size={14} className="text-warning" />
            <select className="form-select bg-transparent border-0 text-white shadow-none py-1 small" value={filters.selectedTop30 || ""} onChange={e => setFilters({...filters, selectedTop30: e.target.value || null})}>
                <option className="bg-dark text-white" value="">{t.top30Label}</option>
                {MOST_WATCHED_MOVIES.map(m => (
                    <option className="bg-dark text-white" key={m} value={m}>{m}</option>
                ))}
            </select>
        </div>

        {/* NEW: Only with Poster Toggle */}
        <button 
            className={`btn btn-sm d-flex align-items-center gap-2 border border-secondary ${filters.hasPosterOnly ? 'btn-danger border-danger' : 'btn-dark'}`}
            onClick={() => setFilters({...filters, hasPosterOnly: !filters.hasPosterOnly})}
        >
            <ImageIcon size={14} />
            <span className="small">{t.onlyWithPoster}</span>
        </button>

        {/* 1. Genres */}
        <div className="d-flex align-items-center gap-1 bg-dark px-2 rounded border border-secondary">
            <Filter size={14} className="text-secondary" />
            <select className="form-select bg-transparent border-0 text-white shadow-none py-1 small" value={filters.selectedGenre || ""} onChange={e => setFilters({...filters, selectedGenre: e.target.value || null})}>
                <option className="bg-dark text-white" value="">Gêneros</option>
                {sortedGenres.map(g => (
                    <option className="bg-dark text-white" key={g} value={g}>
                        {g} ({genreCounts[g]})
                    </option>
                ))}
            </select>
        </div>

        {/* 2. Rating */}
        <div className="d-flex align-items-center gap-1 bg-dark px-2 rounded border border-secondary">
            <Star size={14} className="text-warning" />
            <select className="form-select bg-transparent border-0 text-white shadow-none py-1 small" value={filters.selectedRating || ""} onChange={e => setFilters({...filters, selectedRating: e.target.value || null})}>
                <option className="bg-dark text-white" value="">{t.rating}</option>
                {RATING_CATEGORIES.map(c => (
                    <option className="bg-dark text-white" key={c.id} value={c.id}>
                        {c.label[appLanguage] || c.label.pt}
                    </option>
                ))}
            </select>
        </div>

        {/* 3. Decade */}
        <div className="d-flex align-items-center gap-1 bg-dark px-2 rounded border border-secondary">
            <CalendarDays size={14} className="text-info" />
            <select className="form-select bg-transparent border-0 text-white shadow-none py-1 small" value={filters.selectedDecade || ""} onChange={e => setFilters({...filters, selectedDecade: e.target.value ? parseInt(e.target.value) : null})}>
                <option className="bg-dark text-white" value="">{t.decade}</option>
                {DECADES.map(d => (
                    <option className="bg-dark text-white" key={d} value={d}>{d}s</option>
                ))}
            </select>
        </div>

        {/* 4. Language */}
        <div className="d-flex align-items-center gap-1 bg-dark px-2 rounded border border-secondary">
            <Languages size={14} className="text-secondary" />
            <select className="form-select bg-transparent border-0 text-white shadow-none py-1 small" value={filters.selectedLanguage || ""} onChange={e => setFilters({...filters, selectedLanguage: e.target.value || null})}>
                <option className="bg-dark text-white" value="">Idiomas</option>
                {sortedLanguages.map(l => (
                    <option className="bg-dark text-white" key={l} value={l}>
                        {l} ({languageCounts[l]})
                    </option>
                ))}
            </select>
        </div>

        {/* 5. Color */}
        <div className="d-flex align-items-center gap-1 bg-dark px-2 rounded border border-secondary">
            <Palette size={14} className="text-secondary" />
            <select className="form-select bg-transparent border-0 text-white shadow-none py-1 small" value={filters.selectedColor || ""} onChange={e => setFilters({...filters, selectedColor: e.target.value || null})}>
                <option className="bg-dark text-white" value="">Cor</option>
                {COLORS.map(c => (
                    <option className="bg-dark text-white" key={c} value={c}>{c}</option>
                ))}
            </select>
        </div>

        {/* 6. Themes */}
        <div className="d-flex align-items-center gap-1 bg-dark px-2 rounded border border-secondary">
            <Layers size={14} className="text-secondary" />
            <select className="form-select bg-transparent border-0 text-white shadow-none py-1 small" value={filters.selectedTheme || ""} onChange={e => setFilters({...filters, selectedTheme: e.target.value || null})}>
                <option className="bg-dark text-white" value="">Temas</option>
                {sortedThemes.map(th => (
                    <option className="bg-dark text-white" key={th} value={th}>
                        {th} ({themeCounts[th]})
                    </option>
                ))}
            </select>
        </div>

        {/* 7. Duration */}
        <div className="d-flex align-items-center gap-1 bg-dark px-2 rounded border border-secondary">
            <Clock4 size={14} className="text-secondary" />
            <select className="form-select bg-transparent border-0 text-white shadow-none py-1 small" value={filters.selectedDuration || ""} onChange={e => setFilters({...filters, selectedDuration: (e.target.value as any) || null})}>
                <option className="bg-dark text-white" value="">Duração</option>
                {DURATIONS.map(d => (
                    <option className="bg-dark text-white" key={d.id} value={d.id}>
                        {d.label[appLanguage] || d.label.en}
                    </option>
                ))}
            </select>
        </div>

        {/* 8. Subtitles */}
        <div className="d-flex align-items-center gap-1 bg-dark px-2 rounded border border-secondary">
            <MonitorPlay size={14} className="text-secondary" />
            <select className="form-select bg-transparent border-0 text-white shadow-none py-1 small" value={filters.hasSubtitles === null ? "" : filters.hasSubtitles.toString()} onChange={e => setFilters({...filters, hasSubtitles: e.target.value === "" ? null : e.target.value === "true"})}>
                <option className="bg-dark text-white" value="">Legendas</option>
                <option className="bg-dark text-white" value="true">Com Legenda</option>
                <option className="bg-dark text-white" value="false">Sem Legenda</option>
            </select>
        </div>

        {/* 9. Director */}
        <div className="d-flex align-items-center gap-1 bg-dark px-2 rounded border border-secondary">
            <Megaphone size={14} className="text-secondary" />
            <select className="form-select bg-transparent border-0 text-white shadow-none py-1 small" value={filters.selectedDirector || ""} onChange={e => setFilters({...filters, selectedDirector: e.target.value || null})}>
                <option className="bg-dark text-white" value="">{t.director}</option>
                {uniqueDirectors.map(d => (
                    <option className="bg-dark text-white" key={d} value={d}>{d}</option>
                ))}
            </select>
        </div>

        {/* 10. Awards */}
        <div className="d-flex align-items-center gap-1 bg-dark px-2 rounded border border-secondary">
            <Trophy size={14} className="text-warning" />
            <select className="form-select bg-transparent border-0 text-white shadow-none py-1 small" value={filters.selectedAward || ""} onChange={e => setFilters({...filters, selectedAward: e.target.value || null})}>
                <option className="bg-dark text-white" value="">{t.awards}</option>
                {uniqueAwards.map(a => (
                    <option className="bg-dark text-white" key={a} value={a}>{a}</option>
                ))}
            </select>
        </div>

        {/* View Mode Toggle */}
        <div className="ms-auto d-flex gap-1 bg-dark p-1 rounded border border-secondary">
            <button className={`btn btn-sm ${viewMode === 'image' ? 'btn-danger' : 'btn-dark'}`} onClick={() => setViewMode('image')} title={t.imageMode}><LayoutGrid size={16} /></button>
            <button className={`btn btn-sm ${viewMode === 'text' ? 'btn-danger' : 'btn-dark'}`} onClick={() => setViewMode('text')} title={t.textMode}><Type size={16} /></button>
        </div>
    </div>
  );
};
