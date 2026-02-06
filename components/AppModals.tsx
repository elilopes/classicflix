import React from 'react';
import { Movie, AppLanguage, UserMovieInteraction } from '../types';
import { AddMovieModal } from './AddMovieModal';
import { MovieDetailsModal } from './MovieDetailsModal';
import { Loader2 } from 'lucide-react';

interface AppModalsProps {
  // Add Movie Modal Props
  showAddModal: boolean;
  setShowAddModal: (show: boolean) => void;
  
  // Movie Details Modal Props
  selectedMovie: Movie | null;
  setSelectedMovie: (movie: Movie | null) => void;
  appLanguage: AppLanguage;
  getState: (movieId: string) => UserMovieInteraction;
  onToggleInteraction: (movieId: string, field: keyof UserMovieInteraction) => void;
  
  // Auth Modal Props
  showAuthModal: boolean;
  setShowAuthModal: (show: boolean) => void;
  authMode: 'login' | 'signup';
  setAuthMode: (mode: 'login' | 'signup') => void;
  authUsername: string;
  setAuthUsername: (val: string) => void;
  authPassword: string;
  setAuthPassword: (val: string) => void;
  handleAuth: () => void;
  authLoading: boolean;
  
  // Shared
  onRefresh: () => void;
  t: any; // Translation object
}

export const AppModals: React.FC<AppModalsProps> = ({
  showAddModal, setShowAddModal,
  selectedMovie, setSelectedMovie,
  appLanguage, getState, onToggleInteraction,
  showAuthModal, setShowAuthModal, authMode, setAuthMode,
  authUsername, setAuthUsername, authPassword, setAuthPassword,
  handleAuth, authLoading,
  onRefresh, t
}) => {
  return (
    <>
      {/* Auth Modal */}
      {showAuthModal && (
        <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 1060 }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content bg-dark border-secondary shadow-lg">
              <div className="modal-header border-secondary">
                <h5 className="modal-title text-white">{authMode === 'login' ? t.login : t.signup}</h5>
                <button className="btn-close btn-close-white" onClick={() => setShowAuthModal(false)}></button>
              </div>
              <div className="modal-body p-4">
                 <div className="mb-3">
                    <label className="form-label text-white-50">{t.username} (Email)</label>
                    <input 
                        type="email"
                        className="form-control bg-black text-white border-secondary" 
                        value={authUsername} 
                        onChange={e => setAuthUsername(e.target.value)}
                        placeholder="email@example.com"
                    />
                 </div>
                 <div className="mb-4">
                    <label className="form-label text-white-50">{t.password}</label>
                    <input 
                        type="password" 
                        className="form-control bg-black text-white border-secondary" 
                        value={authPassword} 
                        onChange={e => setAuthPassword(e.target.value)} 
                    />
                 </div>
                 <div className="d-grid gap-2">
                    <button className="btn btn-danger fw-bold py-2 shadow" onClick={handleAuth} disabled={authLoading}>
                        {authLoading ? <Loader2 className="animate-spin mx-auto" /> : (authMode === 'login' ? t.login : t.signup)}
                    </button>
                 </div>
                 <div className="text-center mt-3 pt-3 border-top border-secondary">
                    <button className="btn btn-link text-white-50 text-decoration-none btn-sm" onClick={() => setAuthMode(authMode === 'login' ? 'signup' : 'login')}>
                        {authMode === 'login' ? (appLanguage === 'pt' ? "Não tem conta? Cadastre-se" : "No account? Sign up") : (appLanguage === 'pt' ? "Já tem conta? Entre" : "Have an account? Login")}
                    </button>
                 </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Movie Modal */}
      {showAddModal && (
          <AddMovieModal 
             onClose={() => setShowAddModal(false)}
             onSuccess={onRefresh}
          />
      )}

      {/* Movie Details Modal */}
      {selectedMovie && (
          <MovieDetailsModal 
            movie={selectedMovie} 
            onClose={() => setSelectedMovie(null)}
            language={appLanguage}
            interactions={getState(selectedMovie.id)}
            onToggleInteraction={(field) => onToggleInteraction(selectedMovie.id, field)}
            onRefresh={onRefresh}
          />
      )}
    </>
  );
};