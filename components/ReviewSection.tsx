
import React, { useState, useEffect } from 'react';
import { 
  MessageSquare, Star, Trash2, CornerDownRight, Send, 
  Loader2, User, ChevronDown, ChevronUp, Reply 
} from 'lucide-react';
import { Review, Comment, AppLanguage } from '../types';
import { 
  fetchMovieReviews, addReview, deleteReview, 
  addComment, deleteComment, voteReview 
} from '../services/reviewService';
import { getCurrentUser } from '../services/bd';
import { motion, AnimatePresence } from 'motion/react';

interface ReviewSectionProps {
  movieId: string;
  language: AppLanguage;
  isUserLoggedIn: boolean;
}

export const ReviewSection: React.FC<ReviewSectionProps> = ({ movieId, language, isUserLoggedIn }) => {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);
  
  // Review form
  const [newRating, setNewRating] = useState(10);
  const [newReviewContent, setNewReviewContent] = useState('');
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  
  // Comment form
  const [replyingTo, setReplyingTo] = useState<string | null>(null); // reviewId
  const [newCommentContent, setNewCommentContent] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);

  const loadReviews = async () => {
    setIsLoading(true);
    try {
      const data = await fetchMovieReviews(movieId);
      setReviews(data);
    } catch (err) {
      console.error("Error loading reviews:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadReviews();
  }, [movieId]);

  useEffect(() => {
    if (isUserLoggedIn) {
      getCurrentUser().then(setCurrentUser);
    } else {
      setCurrentUser(null);
    }
  }, [isUserLoggedIn]);

  const handleAddReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newReviewContent.trim()) return;
    if (!currentUser) {
      alert("Você precisa estar logado para comentar.");
      return;
    }

    setIsSubmittingReview(true);
    try {
      await addReview(movieId, newRating, newReviewContent);
      setNewReviewContent('');
      setNewRating(10);
      await loadReviews();
    } catch (err) {
      console.error("Error adding review:", err);
      alert("Erro ao enviar comentário. Verifique se as tabelas existem no Supabase.");
    } finally {
      setIsSubmittingReview(false);
    }
  };

  const handleDeleteReview = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir sua resenha?")) return;
    try {
      await deleteReview(id);
      await loadReviews();
    } catch (err) {
      console.error("Error deleting review:", err);
    }
  };

  const handleVoteReview = async (reviewId: string) => {
    try {
      await voteReview(reviewId);
      await loadReviews();
    } catch (err) {
      console.error("Error voting review:", err);
      alert("Erro ao votar na crítica.");
    }
  };

  const handleAddComment = async (reviewId: string, parentId?: string) => {
    if (!newCommentContent.trim()) return;
    if (!currentUser) {
      alert("Você precisa estar logado para responder.");
      return;
    }

    setIsSubmittingComment(true);
    try {
      await addComment(reviewId, newCommentContent, movieId, parentId);
      setNewCommentContent('');
      setReplyingTo(null);
      await loadReviews();
    } catch (err) {
      console.error("Error adding comment:", err);
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const handleDeleteComment = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir sua resposta?")) return;
    try {
      await deleteComment(id);
      await loadReviews();
    } catch (err) {
      console.error("Error deleting comment:", err);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString(language === 'pt' ? 'pt-BR' : 'en-US', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="review-section mt-4">
      <h5 className="text-danger mb-4 d-flex align-items-center gap-2 border-bottom border-secondary pb-2">
        <MessageSquare size={20} /> Comentários da Comunidade
      </h5>

      {/* New Review Form */}
      {currentUser ? (
        <form onSubmit={handleAddReview} className="bg-black bg-opacity-50 p-4 rounded border border-secondary mb-5 shadow-sm">
          <div className="mb-3">
            <label className="form-label text-white-50 small d-flex align-items-center gap-2">
              <Star size={14} className="text-warning" /> Sua Nota (1-10)
            </label>
            <div className="d-flex gap-2 flex-wrap">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(num => (
                <button
                  key={num}
                  type="button"
                  onClick={() => setNewRating(num)}
                  className={`btn btn-sm rounded-circle ${newRating === num ? 'btn-danger' : 'btn-outline-secondary'}`}
                  style={{ width: '36px', height: '36px', padding: 0 }}
                >
                  {num}
                </button>
              ))}
            </div>
          </div>
          <div className="mb-3">
            <label className="form-label text-white-50 small">Sua Crítica</label>
            <textarea
              className="form-control bg-black text-white border-secondary shadow-none"
              rows={3}
              placeholder="O que você achou desta obra?"
              value={newReviewContent}
              onChange={e => setNewReviewContent(e.target.value)}
              required
            />
          </div>
          <div className="text-end">
            <button 
              type="submit" 
              className="btn btn-danger px-4 d-flex align-items-center gap-2 ms-auto"
              disabled={isSubmittingReview}
            >
              {isSubmittingReview ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              Publicar Resenha
            </button>
          </div>
        </form>
      ) : (
        <div className="alert alert-dark border-secondary text-center py-4 mb-5">
          <p className="m-0 text-white-50">Faça login para deixar sua nota e comentário.</p>
        </div>
      )}

      {/* Reviews List */}
      {isLoading ? (
        <div className="text-center py-5"><Loader2 className="animate-spin text-danger mx-auto" size={40} /></div>
      ) : reviews.length === 0 ? (
        <div className="text-center py-5 opacity-50">
          <MessageSquare size={48} className="mx-auto mb-3" />
          <p>Nenhuma resenha ainda. Seja o primeiro a comentar!</p>
        </div>
      ) : (
        <div className="d-flex flex-column gap-4">
          {reviews.map(review => (
            <motion.div 
              key={review.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-dark bg-opacity-25 p-4 rounded border border-secondary shadow-sm"
            >
              <div className="d-flex justify-content-between align-items-start mb-3">
                <div className="d-flex align-items-center gap-3">
                  <div className="bg-danger rounded-circle d-flex align-items-center justify-content-center text-white fw-bold" style={{ width: '40px', height: '40px' }}>
                    {review.email?.charAt(0).toUpperCase() || <User size={20} />}
                  </div>
                  <div>
                    <h6 className="m-0 text-white small fw-bold">{review.email}</h6>
                    <span className="text-white-50 xsmall">{formatDate(review.created_at)}</span>
                  </div>
                </div>
                <div className="d-flex align-items-center gap-2">
                  <div className="bg-black px-2 py-1 rounded border border-warning d-flex align-items-center gap-1">
                    <Star size={14} className="text-warning fill-warning" />
                    <span className="text-warning fw-bold small">{review.rating}/10</span>
                  </div>
                  {currentUser?.id === review.userid && (
                    <button 
                      onClick={() => handleDeleteReview(review.id)}
                      className="btn btn-sm btn-outline-danger border-0 p-1"
                      title="Excluir resenha"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>
              
              <p className="text-light mb-3 lh-base">{review.content}</p>
              
              <div className="d-flex align-items-center justify-content-between border-top border-secondary pt-3">
                <div className="d-flex align-items-center gap-3">
                  <button 
                    onClick={() => setReplyingTo(replyingTo === review.id ? null : review.id)}
                    className="btn btn-sm btn-link text-info text-decoration-none p-0 d-flex align-items-center gap-1 xsmall fw-bold"
                  >
                    <Reply size={14} /> Responder
                  </button>
                  <span className="text-white-50 xsmall">{review.replies?.length || 0} respostas</span>
                </div>

                <button 
                  onClick={() => handleVoteReview(review.id)}
                  className="btn btn-sm btn-outline-warning border border-warning px-2 py-1 d-flex align-items-center gap-1 bg-warning bg-opacity-10 text-warning"
                  title="Votar nesta crítica com estrela"
                >
                  <Star size={14} className="fill-warning" />
                  <span className="fw-bold">{review.votes || 0}</span>
                </button>
              </div>

              {/* Reply Form */}
              <AnimatePresence>
                {replyingTo === review.id && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="mt-3 ps-4 border-start border-secondary">
                      <div className="d-flex gap-2">
                        <textarea
                          className="form-control form-control-sm bg-black text-white border-secondary shadow-none"
                          rows={2}
                          placeholder="Escreva sua resposta..."
                          value={newCommentContent}
                          onChange={e => setNewCommentContent(e.target.value)}
                        />
                        <button 
                          onClick={() => handleAddComment(review.id)}
                          className="btn btn-sm btn-info text-white px-3"
                          disabled={isSubmittingComment}
                        >
                          {isSubmittingComment ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Replies List */}
              {review.replies && review.replies.length > 0 && (
                <div className="mt-4 ps-4 d-flex flex-column gap-3 border-start border-secondary">
                  {review.replies.map(reply => (
                    <div key={reply.id} className="bg-black bg-opacity-25 p-3 rounded border border-secondary border-opacity-50">
                      <div className="d-flex justify-content-between align-items-start mb-2">
                        <div className="d-flex align-items-center gap-2">
                          <div className="bg-secondary rounded-circle d-flex align-items-center justify-content-center text-white xsmall" style={{ width: '24px', height: '24px' }}>
                            {reply.email?.charAt(0).toUpperCase() || <User size={14} />}
                          </div>
                          <div>
                            <span className="text-white-50 xsmall fw-bold">{reply.email}</span>
                            <span className="text-white-50 xsmall ms-2 opacity-50">{formatDate(reply.created_at)}</span>
                          </div>
                        </div>
                        {currentUser?.id === reply.userid && (
                          <button 
                            onClick={() => handleDeleteComment(reply.id)}
                            className="btn btn-sm btn-outline-danger border-0 p-0 opacity-50 hover-opacity-100"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                      <p className="text-light small m-0 opacity-75">{reply.content}</p>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
};
