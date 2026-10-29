import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Trophy, Star, MessageSquare, ThumbsUp, Loader2, Film, User } from 'lucide-react';
import { Review, Movie, AppLanguage } from '../types';
import { getSupabase } from '../services/bd';
import { fetchSupabaseMovies } from '../services/supabaseClient';

interface BestReviewsModalProps {
  isOpen: boolean;
  onClose: () => void;
  movies?: Movie[];
  language: AppLanguage;
  onSelectMovie?: (movie: Movie) => void;
}

export const BestReviewsModal: React.FC<BestReviewsModalProps> = ({
  isOpen,
  onClose,
  movies = [],
  language,
  onSelectMovie
}) => {
  const [topReviews, setTopReviews] = useState<(Review & { movieTitle?: string; posterUrl?: string })[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const isPt = language === 'pt';

  useEffect(() => {
    if (!isOpen) return;
    const fetchTopReviews = async () => {
      setIsLoading(true);
      try {
        const supabase = await getSupabase();
        if (!supabase) {
          setIsLoading(false);
          return;
        }

        let currentMovies = movies;
        if (!currentMovies || currentMovies.length === 0) {
          currentMovies = await fetchSupabaseMovies();
        }

        const { data: reviews, error } = await supabase
          .from('moviereviews')
          .select('*')
          .order('votes', { ascending: false, nullsFirst: false })
          .limit(20);

        if (error) {
          console.error("Error fetching top reviews:", error);
          const { data: fallbackReviews } = await supabase
            .from('moviereviews')
            .select('*')
            .limit(20);
          
          processReviews(fallbackReviews || [], currentMovies);
        } else {
          processReviews(reviews || [], currentMovies);
        }
      } catch (err) {
        console.error("Error in BestReviewsModal:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTopReviews();
  }, [isOpen, movies]);

  const processReviews = (rawReviews: any[], movieList: Movie[]) => {
    const movieMap = new Map(movieList.map(m => [m.wikidataId || m.id, m]));
    const enriched = rawReviews.map(r => {
      const movie = movieMap.get(r.wikidataid);
      return {
        ...r,
        votes: r.votes || 0,
        movieTitle: movie ? (isPt ? (movie.titlePt || movie.title) : movie.title) : (r.wikidataid || 'Filme'),
        posterUrl: movie?.posterUrl || ''
      };
    });
    enriched.sort((a, b) => (b.votes || 0) - (a.votes || 0));
    setTopReviews(enriched);
  };

  if (!isOpen) return null;

  return (
    <div className="modal show d-block" tabIndex={-1} style={{ backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 1070 }}>
      <div className="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          className="modal-content bg-dark border-secondary text-white shadow-lg overflow-hidden"
        >
          <div className="modal-header border-bottom border-secondary d-flex justify-content-between align-items-center p-3">
            <div className="d-flex align-items-center gap-2">
              <Trophy className="text-warning" size={24} />
              <h5 className="modal-title fw-bold m-0">
                {isPt ? 'Melhores Críticas da Comunidade' : 'Top Community Reviews'}
              </h5>
            </div>
            <button type="button" className="btn-close btn-close-white shadow-none" onClick={onClose}></button>
          </div>

          <div className="modal-body p-4">
            {isLoading ? (
              <div className="d-flex flex-column align-items-center justify-content-center py-5">
                <Loader2 className="animate-spin text-warning mb-3" size={48} />
                <p className="text-white-50">{isPt ? 'Carregando as melhores críticas...' : 'Loading top reviews...'}</p>
              </div>
            ) : topReviews.length === 0 ? (
              <div className="text-center py-5 opacity-50">
                <MessageSquare size={48} className="mb-3 mx-auto text-secondary" />
                <h5>{isPt ? 'Nenhuma crítica encontrada ainda.' : 'No reviews found yet.'}</h5>
                <p className="small text-white-50">
                  {isPt ? 'Seja o primeiro a avaliar um filme e receber votos!' : 'Be the first to review a movie and get votes!'}
                </p>
              </div>
            ) : (
              <div className="d-flex flex-column gap-3">
                {topReviews.map((review, idx) => (
                  <motion.div 
                    key={review.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className="card bg-black bg-opacity-40 border border-secondary p-3 rounded shadow-sm"
                  >
                    <div className="d-flex align-items-start justify-content-between gap-3 mb-2">
                      <div className="d-flex align-items-center gap-3">
                        <div className="position-relative bg-secondary rounded overflow-hidden" style={{ width: '48px', height: '64px', flexShrink: 0 }}>
                          {review.posterUrl ? (
                            <img src={review.posterUrl} alt="" className="w-100 h-100 object-fit-cover" />
                          ) : (
                            <Film className="w-100 h-100 p-2 text-white-50" />
                          )}
                          <div className="position-absolute top-0 start-0 bg-warning text-dark fw-bold px-1 xsmall rounded-bottom">
                            #{idx + 1}
                          </div>
                        </div>
                        <div>
                          <h6 className="fw-bold mb-1 text-info">
                            {review.movieTitle}
                          </h6>
                          <div className="d-flex align-items-center gap-2 text-white-50 small">
                            <span className="d-flex align-items-center gap-1">
                              <User size={12} /> {review.email ? review.email.split('@')[0] : 'Usuário'}
                            </span>
                            <span>•</span>
                            <span className="badge bg-danger text-white">Nota {review.rating}/10</span>
                          </div>
                        </div>
                      </div>

                      <div className="d-flex align-items-center gap-1 bg-warning bg-opacity-10 border border-warning text-warning px-2 py-1 rounded">
                        <Star size={14} className="fill-warning" />
                        <span className="fw-bold">{review.votes || 0}</span>
                      </div>
                    </div>

                    <p className="text-white mb-2 fs-6 fst-italic ps-2 border-start border-3 border-danger">
                      "{review.content}"
                    </p>

                    <div className="d-flex justify-content-between align-items-center mt-2 pt-2 border-top border-secondary border-opacity-50 text-white-50 xsmall">
                      <span>{new Date(review.created_at).toLocaleDateString()}</span>
                      {onSelectMovie && (
                        <button 
                          className="btn btn-sm btn-outline-info py-0 px-2"
                          onClick={() => {
                            if (onSelectMovie) {
                              onClose();
                            }
                          }}
                        >
                          {isPt ? 'Ver Filme' : 'View Movie'}
                        </button>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>

          <div className="modal-footer border-top border-secondary p-3">
            <button type="button" className="btn btn-secondary px-4" onClick={onClose}>
              {isPt ? 'Fechar' : 'Close'}
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  );
};
