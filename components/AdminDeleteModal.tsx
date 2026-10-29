import React, { useState, useMemo } from 'react';
import { ShieldAlert, Trash2, Search, CheckSquare, Square, Loader2, X } from 'lucide-react';
import { Movie } from '../types';
import { deleteSupabaseMovies } from '../services/supabaseClient';

interface AdminDeleteModalProps {
  movies: Movie[];
  currentUserEmail: string;
  onClose: () => void;
  onRefresh: () => void;
}

export const AdminDeleteModal: React.FC<AdminDeleteModalProps> = ({ movies, currentUserEmail, onClose, onRefresh }) => {
  const [titleSearch, setTitleSearch] = useState('');
  const [genreSearch, setGenreSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);

  // 1. Extrair gêneros únicos para o Select
  const uniqueGenres = useMemo(() => {
    const genres = new Set<string>();
    movies.forEach(m => {
      if (Array.isArray(m.genres)) {
        m.genres.forEach(g => genres.add(g));
      } else if (m.genres) {
        genres.add(m.genres);
      }
    });
    return Array.from(genres).sort();
  }, [movies]);

  // 2. Lógica de Filtro: Só exibe se houver busca
  const filteredMovies = useMemo(() => {
    if (!titleSearch.trim() && !genreSearch) return [];

    return movies.filter(movie => {
      const matchTitle = titleSearch.trim() === '' || 
        (movie.title || movie.titlePt || '').toLowerCase().includes(titleSearch.toLowerCase());
      
      const movieGenresStr = Array.isArray(movie.genres) ? movie.genres.join(', ') : (movie.genres || '');
      const matchGenre = genreSearch === '' || 
        movieGenresStr.toLowerCase().includes(genreSearch.toLowerCase());

      return matchTitle && matchGenre;
    });
  }, [movies, titleSearch, genreSearch]);

  const toggleSelection = (qid: string) => {
    const newSelection = new Set(selectedIds);
    if (newSelection.has(qid)) newSelection.delete(qid);
    else newSelection.add(qid);
    setSelectedIds(newSelection);
  };

  const toggleAll = () => {
    if (selectedIds.size === filteredMovies.length && filteredMovies.length > 0) {
        setSelectedIds(new Set());
    } else {
        setSelectedIds(new Set(filteredMovies.map(m => m.wikidataId).filter(Boolean) as string[]));
    }
  };

  const handleDelete = async () => {
    if (selectedIds.size === 0) return;
    const confirmDelete = window.confirm(`ATENÇÃO: Deseja excluir ${selectedIds.size} filme(s)?`);
    if (!confirmDelete) return;

    setIsDeleting(true);
    try {
      // Use Supabase directly
      await deleteSupabaseMovies(Array.from(selectedIds));
      
      alert(`${selectedIds.size} filme(s) excluído(s) com sucesso.`);
      setSelectedIds(new Set());
      onRefresh();
    } catch (err: any) {
      alert("Erro ao excluir: " + err.message);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="modal d-block" style={{ backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 1100 }}>
      <div className="modal-dialog modal-xl modal-dialog-centered">
        <div className="modal-content bg-dark border-danger text-white shadow-lg">
          
          <div className="modal-header border-danger bg-danger bg-opacity-10">
            <h5 className="modal-title d-flex align-items-center gap-2 text-danger fw-bold">
              <ShieldAlert size={24} /> Painel do Administrador
            </h5>
            <button className="btn-close btn-close-white" onClick={onClose} disabled={isDeleting}></button>
          </div>

          <div className="modal-body">
            {/* Controles de Busca */}
            <div className="card bg-black border-secondary mb-4 p-3">
              <div className="row g-3">
                <div className="col-md-6">
                  <label className="small text-secondary mb-1">Filtrar por Título</label>
                  <div className="input-group">
                    <span className="input-group-text bg-dark border-secondary text-white"><Search size={18}/></span>
                    <input 
                      type="text" 
                      className="form-control bg-dark border-secondary text-white shadow-none" 
                      placeholder="Digite parte do título..." 
                      value={titleSearch} 
                      onChange={(e) => setTitleSearch(e.target.value)}
                    />
                  </div>
                </div>
                <div className="col-md-6">
                  <label className="small text-secondary mb-1">Filtrar por Gênero</label>
                  <select 
                    className="form-select bg-dark border-secondary text-white shadow-none"
                    value={genreSearch}
                    onChange={(e) => setGenreSearch(e.target.value)}
                  >
                    <option value="">-- Todos os Gêneros --</option>
                    {uniqueGenres.map(g => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Lista Condicional */}
            <div className="table-responsive custom-scrollbar" style={{ maxHeight: '50vh', minHeight: '200px' }}>
              {(!titleSearch.trim() && !genreSearch) ? (
                <div className="d-flex flex-column align-items-center justify-content-center h-100 py-5 text-secondary opacity-50">
                   <Search size={40} className="mb-2" />
                   <p>Digite um título ou escolha um gênero para listar os filmes.</p>
                </div>
              ) : (
                <table className="table table-dark table-hover align-middle border-secondary">
                  <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                    <tr>
                      <th style={{ width: '50px' }}>
                        <button className="btn btn-sm btn-outline-secondary border-0" onClick={toggleAll}>
                          {selectedIds.size === filteredMovies.length && filteredMovies.length > 0 ? <CheckSquare size={20} className="text-danger"/> : <Square size={20}/>}
                        </button>
                      </th>
                      <th>Poster</th>
                      <th>Título</th>
                      <th>Gêneros</th>
                      <th>QID</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMovies.map(movie => (
                      <tr key={movie.wikidataId} onClick={() => toggleSelection(movie.wikidataId || '')} style={{ cursor: 'pointer' }}>
                        <td>{selectedIds.has(movie.wikidataId || '') ? <CheckSquare size={20} className="text-danger"/> : <Square size={20} className="text-secondary"/>}</td>
                        <td>
                          {movie.posterUrl ? <img src={movie.posterUrl} alt="p" style={{ width: '40px', height: '60px', objectFit: 'cover' }}/> : <div className="bg-secondary" style={{ width: '40px', height: '60px' }}></div>}
                        </td>
                        <td className="fw-bold">{movie.title} <span className="text-secondary fw-normal">({movie.year})</span></td>
                        <td className="text-info small">{Array.isArray(movie.genres) ? movie.genres.join(', ') : movie.genres}</td>
                        <td className="text-secondary font-monospace small">{movie.wikidataId}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          <div className="modal-footer border-danger d-flex justify-content-between align-items-center bg-black">
            <span className="text-secondary">
              Selecionados: <strong className={selectedIds.size > 0 ? 'text-danger' : 'text-white'}>{selectedIds.size}</strong> de {filteredMovies.length}
            </span>
            <div className="d-flex gap-2">
              <button className="btn btn-outline-secondary" onClick={onClose} disabled={isDeleting}>Cancelar</button>
              <button className="btn btn-danger d-flex align-items-center gap-2" onClick={handleDelete} disabled={selectedIds.size === 0 || isDeleting}>
                {isDeleting ? <Loader2 size={18} className="animate-spin" /> : <Trash2 size={18} />}
                Excluir Selecionados
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
