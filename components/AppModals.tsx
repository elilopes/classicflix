import React from 'react';
import { Movie, AppLanguage, UserMovieInteraction } from '../types';
import { AddMovieModal } from './AddMovieModal';
import { MovieDetailsModal } from './MovieDetailsModal';
import { LeaderboardModal } from './LeaderboardModal';
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
  
  // Leaderboard Modal Props
  showLeaderboardModal: boolean;
  setShowLeaderboardModal: (show: boolean) => void;
  
  isUserLoggedIn: boolean;
  currentUser: any;
  
  authMode: 'login' | 'signup';
  setAuthMode: (mode: 'login' | 'signup') => void;
  authUsername: string;
  setAuthUsername: (val: string) => void;
  authPassword: string;
  setAuthPassword: (val: string) => void;
  handleAuth: () => void;
  handleGoogleAuth?: () => void;
  authLoading: boolean;
  authError?: string;
  setAuthError?: (val: string) => void;
  
  // Shared
  onRefresh: () => void;
  t: any; // Translation object
  onFilterDirector?: (director: string) => void;
}

export function AppModals({
  showAddModal, setShowAddModal,
  selectedMovie, setSelectedMovie,
  appLanguage, getState, onToggleInteraction,
  showAuthModal, setShowAuthModal, authMode, setAuthMode,
  showLeaderboardModal, setShowLeaderboardModal,
  isUserLoggedIn, currentUser,
  authUsername, setAuthUsername, authPassword, setAuthPassword,
  handleAuth, handleGoogleAuth, authLoading, authError, setAuthError,
  onRefresh, t, onFilterDirector
}: AppModalsProps) {
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
                 {authError && (
                   <div className="alert alert-danger py-2 px-3 small mb-3">
                     {authError}
                     {authError.includes('Email not confirmed') && (
                       <div className="mt-2">
                         <button 
                           className="btn btn-sm btn-outline-danger w-100"
                           onClick={async () => {
                             try {
                               const { getSupabase } = await import('../services/bd');
                               const sb = await getSupabase();
                               if (!sb) throw new Error("Erro de conexão");
                               const { error } = await sb.auth.resend({ type: 'signup', email: authUsername });
                               if (error) {
                                 setAuthError?.(error.message);
                               } else {
                                 setAuthError?.("Email de confirmação reenviado! Verifique sua caixa de entrada.");
                               }
                             } catch (err: any) {
                               setAuthError?.(err.message);
                             }
                           }}
                         >
                           Reenviar email de confirmação
                         </button>
                       </div>
                     )}
                   </div>
                 )}

                 {/* Google OAuth 2 Login / Sign Up */}
                 <div className="d-grid gap-2 mb-3">
                   <button 
                     type="button"
                     className="btn btn-light text-dark fw-bold py-2 shadow-sm d-flex align-items-center justify-content-center gap-2 border-0"
                     onClick={handleGoogleAuth}
                     disabled={authLoading}
                   >
                     <svg width="18" height="18" viewBox="0 0 24 24">
                       <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"/>
                       <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.35 24 12 24z"/>
                       <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"/>
                       <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.35 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"/>
                     </svg>
                     <span>{authMode === 'login' ? (appLanguage === 'pt' ? 'Entrar com o Google' : 'Sign in with Google') : (appLanguage === 'pt' ? 'Cadastrar com o Google' : 'Sign up with Google')}</span>
                   </button>
                 </div>

                 <div className="d-flex align-items-center my-3 text-white-50">
                   <hr className="flex-grow-1 border-secondary m-0" />
                   <span className="px-2 small text-uppercase" style={{ fontSize: '0.75rem' }}>{appLanguage === 'pt' ? 'ou com email' : 'or with email'}</span>
                   <hr className="flex-grow-1 border-secondary m-0" />
                 </div>

                 <div className="mb-3">
                    <label className="form-label text-white-50">{t.username} (Email)</label>
                    <input 
                        type="email"
                        className="form-control bg-black text-white border-secondary" 
                        value={authUsername} 
                        onChange={e => { setAuthUsername(e.target.value); setAuthError?.(''); }}
                        placeholder="email@example.com"
                    />
                 </div>
                 <div className="mb-4">
                    <label className="form-label text-white-50">{t.password}</label>
                    <input 
                        type="password" 
                        className="form-control bg-black text-white border-secondary" 
                        value={authPassword} 
                        onChange={e => { setAuthPassword(e.target.value); setAuthError?.(''); }} 
                    />
                 </div>
                 <div className="d-grid gap-2">
                    <button className="btn btn-danger fw-bold py-2 shadow" onClick={handleAuth} disabled={authLoading}>
                        {authLoading ? <Loader2 className="animate-spin mx-auto" /> : (authMode === 'login' ? t.login : t.signup)}
                    </button>
                 </div>
                 <div className="text-center mt-3 pt-3 border-top border-secondary">
                    <button className="btn btn-link text-white-50 text-decoration-none btn-sm" onClick={() => { setAuthMode(authMode === 'login' ? 'signup' : 'login'); setAuthError?.(''); }}>
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
             t={t}
             language={appLanguage}
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
            isUserLoggedIn={isUserLoggedIn}
            currentUser={currentUser}
            onFilterDirector={onFilterDirector}
          />
      )}

      {/* Leaderboard Modal */}
      <LeaderboardModal 
        isOpen={showLeaderboardModal} 
        onClose={() => setShowLeaderboardModal(false)} 
      />
    </>
  );
}
