
import React, { useState, useEffect } from 'react';
import { 
  collection, 
  addDoc, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  serverTimestamp, 
  db, 
  auth,
  doc,
  deleteDoc
} from '../firebase';
import { MessageSquare, Send, CornerDownRight, Trash2, Star, User as UserIcon, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { AppLanguage } from '../types';

interface UserReviewsProps {
  movieId: string;
  language: AppLanguage;
  t: any;
}

interface Review {
  id: string;
  userId: string;
  userName: string;
  userPhoto: string;
  content: string;
  rating: number;
  createdAt: any;
  likes_count: number;
}

interface Reply {
  id: string;
  userId: string;
  userName: string;
  userPhoto: string;
  content: string;
  createdAt: any;
  likes_count: number;
}

import { LikeButton } from './LikeButton';

export const UserReviews: React.FC<UserReviewsProps> = ({ movieId, language, t }) => {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [newReview, setNewReview] = useState('');
  const [rating, setRating] = useState(10);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [newReply, setNewReply] = useState('');
  const [replies, setReplies] = useState<Record<string, Reply[]>>({});
  const [isLoading, setIsLoading] = useState(true);

  const user = auth.currentUser;

  useEffect(() => {
    const q = query(
      collection(db, 'reviews'),
      where('movieId', '==', movieId),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedReviews = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Review[];
      setReviews(fetchedReviews);
      setIsLoading(false);
    }, (error) => {
      console.error("Error fetching reviews:", error);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [movieId]);

  useEffect(() => {
    const unsubscribes: (() => void)[] = [];

    reviews.forEach(review => {
      const q = query(
        collection(db, `reviews/${review.id}/replies`),
        orderBy('createdAt', 'asc')
      );

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const fetchedReplies = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Reply[];
        setReplies(prev => ({ ...prev, [review.id]: fetchedReplies }));
      });
      unsubscribes.push(unsubscribe);
    });

    return () => unsubscribes.forEach(unsub => unsub());
  }, [reviews]);

  const handlePostReview = async () => {
    if (!user || !newReview.trim()) return;

    try {
      await addDoc(collection(db, 'reviews'), {
        movieId,
        userId: user.uid,
        userName: user.displayName || user.email?.split('@')[0] || 'Anonymous',
        userPhoto: user.photoURL || '',
        content: newReview,
        rating: rating,
        createdAt: serverTimestamp()
      });
      setNewReview('');
      setRating(10);
    } catch (error) {
      console.error("Error posting review:", error);
    }
  };

  const handlePostReply = async (reviewId: string) => {
    if (!user || !newReply.trim()) return;

    try {
      await addDoc(collection(db, `reviews/${reviewId}/replies`), {
        userId: user.uid,
        userName: user.displayName || user.email?.split('@')[0] || 'Anonymous',
        userPhoto: user.photoURL || '',
        content: newReply,
        createdAt: serverTimestamp()
      });
      setNewReply('');
      setReplyingTo(null);
    } catch (error) {
      console.error("Error posting reply:", error);
    }
  };

  const handleDeleteReview = async (reviewId: string) => {
    if (!window.confirm(language === 'pt' ? 'Excluir esta resenha?' : 'Delete this review?')) return;
    try {
      await deleteDoc(doc(db, 'reviews', reviewId));
    } catch (error) {
      console.error("Error deleting review:", error);
    }
  };

  const handleDeleteReply = async (reviewId: string, replyId: string) => {
    if (!window.confirm(language === 'pt' ? 'Excluir esta resposta?' : 'Delete this reply?')) return;
    try {
      await deleteDoc(doc(db, `reviews/${reviewId}/replies`, replyId));
    } catch (error) {
      console.error("Error deleting reply:", error);
    }
  };

  return (
    <div className="user-reviews-section">
      <h5 className="text-danger mb-4 d-flex align-items-center gap-2">
        <MessageSquare size={20} /> 
        {language === 'pt' ? 'Resenhas da Comunidade' : 'Community Reviews'}
      </h5>

      {/* Write Review Form */}
      {user ? (
        <div className="bg-black bg-opacity-50 p-3 rounded border border-secondary mb-5 shadow-sm">
          <div className="d-flex align-items-center gap-2 mb-3">
            <div className="bg-danger rounded-circle d-flex align-items-center justify-content-center" style={{ width: 32, height: 32 }}>
              {user.photoURL ? (
                <img src={user.photoURL} alt={user.displayName || ''} className="rounded-circle w-100 h-100" referrerPolicy="no-referrer" />
              ) : (
                <UserIcon size={16} className="text-white" />
              )}
            </div>
            <span className="fw-bold small">{user.displayName || user.email?.split('@')[0]}</span>
          </div>
          
          <div className="mb-3">
            <label className="form-label xsmall text-white-50 uppercase tracking-wider">{language === 'pt' ? 'Sua Nota' : 'Your Rating'}: {rating}/10</label>
            <input 
              type="range" 
              className="form-range custom-range" 
              min="1" 
              max="10" 
              step="1" 
              value={rating} 
              onChange={(e) => setRating(parseInt(e.target.value))} 
            />
          </div>

          <textarea 
            className="form-control bg-black text-white border-secondary mb-3 shadow-none" 
            rows={3} 
            placeholder={language === 'pt' ? 'O que você achou deste clássico?' : 'What did you think of this classic?'}
            value={newReview}
            onChange={(e) => setNewReview(e.target.value)}
          ></textarea>
          
          <div className="d-flex justify-content-end">
            <button 
              className="btn btn-danger btn-sm px-4 d-flex align-items-center gap-2 shadow"
              onClick={handlePostReview}
              disabled={!newReview.trim()}
            >
              <Send size={14} /> {language === 'pt' ? 'Publicar Resenha' : 'Post Review'}
            </button>
          </div>
        </div>
      ) : (
        <div className="alert alert-dark border-secondary bg-black bg-opacity-50 text-center py-4 mb-5">
          <p className="text-white-50 mb-0">{language === 'pt' ? 'Faça login para participar do debate.' : 'Login to join the debate.'}</p>
        </div>
      )}

      {/* Reviews List */}
      <div className="reviews-list d-flex flex-column gap-4">
        {isLoading ? (
          <div className="text-center py-4"><Loader2 className="animate-spin text-danger mx-auto" /></div>
        ) : reviews.length === 0 ? (
          <div className="text-center py-5 opacity-50">
            <MessageSquare size={40} className="mb-3 mx-auto" />
            <p>{language === 'pt' ? 'Ainda não há resenhas. Seja o primeiro!' : 'No reviews yet. Be the first to review!'}</p>
          </div>
        ) : (
          reviews.map(review => (
            <motion.div 
              key={review.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="review-item"
            >
              <div className="bg-surface p-3 rounded border border-secondary shadow-sm position-relative">
                <div className="d-flex justify-content-between align-items-start mb-2">
                  <div className="d-flex align-items-center gap-2">
                    <div className="bg-secondary rounded-circle d-flex align-items-center justify-content-center overflow-hidden" style={{ width: 32, height: 32 }}>
                      {review.userPhoto ? (
                        <img src={review.userPhoto} alt={review.userName} className="w-100 h-100" referrerPolicy="no-referrer" />
                      ) : (
                        <UserIcon size={16} className="text-white" />
                      )}
                    </div>
                    <div>
                      <div className="fw-bold small">{review.userName}</div>
                      <div className="xsmall text-white-50">
                        {review.createdAt?.toDate ? review.createdAt.toDate().toLocaleDateString() : '...'}
                      </div>
                    </div>
                  </div>
                  <div className="d-flex align-items-center gap-3">
                    <div className="badge bg-danger d-flex align-items-center gap-1">
                      <Star size={10} fill="white" /> {review.rating}
                    </div>
                    {user?.uid === review.userId && (
                      <button 
                        className="btn btn-link p-0 text-danger opacity-50 hover-opacity-100"
                        onClick={() => handleDeleteReview(review.id)}
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
                
                <p className="small text-white-50 mb-3 lh-base">{review.content}</p>
                
                <div className="d-flex justify-content-between align-items-center">
                  <button 
                    className="btn btn-link btn-sm p-0 text-info text-decoration-none xsmall fw-bold uppercase tracking-wider d-flex align-items-center gap-1"
                    onClick={() => setReplyingTo(replyingTo === review.id ? null : review.id)}
                  >
                    <CornerDownRight size={12} /> {language === 'pt' ? 'Responder' : 'Reply'}
                  </button>
                  <LikeButton targetId={review.id} targetType="review" initialLikes={review.likes_count || 0} />
                </div>

                {/* Reply Form */}
                <AnimatePresence>
                  {replyingTo === review.id && (
                    <motion.div 
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="mt-3 pt-3 border-top border-secondary overflow-hidden"
                    >
                      {user ? (
                        <div className="d-flex gap-2">
                          <textarea 
                            className="form-control form-control-sm bg-black text-white border-secondary shadow-none" 
                            rows={2}
                            placeholder={language === 'pt' ? 'Sua resposta...' : 'Your reply...'}
                            value={newReply}
                            onChange={(e) => setNewReply(e.target.value)}
                          ></textarea>
                          <button 
                            className="btn btn-info btn-sm align-self-end shadow"
                            onClick={() => handlePostReply(review.id)}
                            disabled={!newReply.trim()}
                          >
                            <Send size={14} />
                          </button>
                        </div>
                      ) : (
                        <p className="xsmall text-white-50 text-center">{language === 'pt' ? 'Faça login para responder.' : 'Login to reply.'}</p>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Replies List */}
              {replies[review.id] && replies[review.id].length > 0 && (
                <div className="replies-container ms-4 mt-2 d-flex flex-column gap-2">
                  {replies[review.id].map(reply => (
                    <div key={reply.id} className="reply-item bg-black bg-opacity-25 p-2 rounded border border-secondary border-start-0 border-top-0 border-bottom-0 border-end-0 border-start-info shadow-sm" style={{ borderLeft: '2px solid' }}>
                      <div className="d-flex justify-content-between align-items-start mb-1">
                        <div className="d-flex align-items-center gap-2">
                          <div className="bg-secondary rounded-circle d-flex align-items-center justify-content-center overflow-hidden" style={{ width: 24, height: 24 }}>
                            {reply.userPhoto ? (
                              <img src={reply.userPhoto} alt={reply.userName} className="w-100 h-100" referrerPolicy="no-referrer" />
                            ) : (
                              <UserIcon size={12} className="text-white" />
                            )}
                          </div>
                          <span className="fw-bold xsmall">{reply.userName}</span>
                          <span className="xsmall text-white-50 opacity-50">
                            {reply.createdAt?.toDate ? reply.createdAt.toDate().toLocaleDateString() : '...'}
                          </span>
                        </div>
                        {user?.uid === reply.userId && (
                          <button 
                            className="btn btn-link p-0 text-danger opacity-25 hover-opacity-100"
                            onClick={() => handleDeleteReply(review.id, reply.id)}
                          >
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>
                      <p className="xsmall text-white-50 mb-0">{reply.content}</p>
                      <div className="d-flex justify-content-end">
                        <LikeButton targetId={reply.id} targetType="comment" initialLikes={reply.likes_count || 0} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
};
