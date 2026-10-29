import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Trophy, Medal, Star, Loader2, User as UserIcon } from 'lucide-react';
import { db, collection, query, orderBy, onSnapshot, limit } from '../firebase';

interface QuizScore {
  id: string;
  userId: string;
  userName: string;
  userPhoto: string;
  score: number;
  totalQuestions: number;
  movieTitle: string;
  createdAt: any;
}

interface RankingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const RankingModal: React.FC<RankingModalProps> = ({ isOpen, onClose }) => {
  const [scores, setScores] = useState<QuizScore[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isOpen) return;

    const q = query(
      collection(db, 'quiz_scores'),
      orderBy('score', 'desc'),
      orderBy('createdAt', 'desc'),
      limit(50)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const newScores = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as QuizScore[];
      setScores(newScores);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching ranking:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [isOpen]);

  const getRankIcon = (index: number) => {
    switch (index) {
      case 0: return <Star className="text-warning" size={24} fill="currentColor" />; // Gold
      case 1: return <Star className="text-secondary" size={24} fill="currentColor" />; // Silver
      case 2: return <Star className="text-orange-400" size={24} fill="currentColor" style={{ color: '#cd7f32' }} />; // Bronze
      default: return <span className="fw-bold text-secondary">{index + 1}</span>;
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div 
          className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-center p-4" 
          style={{ zIndex: 1200, backgroundColor: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)' }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="bg-dark border border-secondary w-100 shadow-lg d-flex flex-column overflow-hidden"
            style={{ maxWidth: '500px', maxHeight: '80vh', borderRadius: '1.5rem' }}
          >
            <div className="p-4 border-bottom border-secondary d-flex justify-content-between align-items-center bg-black bg-opacity-30">
              <div className="d-flex align-items-center gap-3">
                <div className="bg-warning bg-opacity-10 p-2 rounded-circle">
                  <Trophy className="text-warning" size={24} />
                </div>
                <div>
                  <h3 className="m-0 text-white fw-bold">Ranking Global</h3>
                  <p className="m-0 text-secondary xsmall text-uppercase tracking-wider">Mestres do Cinema</p>
                </div>
              </div>
              <button onClick={onClose} className="btn btn-link text-secondary p-2 hover-white transition-all">
                <X size={24} />
              </button>
            </div>

            <div className="flex-grow-1 overflow-auto p-0 custom-scrollbar">
              {loading ? (
                <div className="d-flex flex-column align-items-center justify-center py-5 gap-3">
                  <Loader2 className="animate-spin text-warning" size={40} />
                  <span className="text-secondary small">Carregando mentes brilhantes...</span>
                </div>
              ) : scores.length === 0 ? (
                <div className="text-center py-5 px-4">
                  <Medal className="text-secondary mb-3 opacity-20" size={60} />
                  <h4 className="text-white fw-bold">Nenhum recorde ainda</h4>
                  <p className="text-secondary small">Seja o primeiro a entrar para a história do ClassicFlix!</p>
                </div>
              ) : (
                <div className="list-group list-group-flush">
                  {scores.map((score, index) => (
                    <motion.div
                      key={score.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="list-group-item bg-transparent border-secondary border-opacity-25 d-flex align-items-center gap-3 py-3 px-4"
                    >
                      <div className="d-flex align-items-center justify-center" style={{ width: '32px' }}>
                        {getRankIcon(index)}
                      </div>
                      
                      <div className="position-relative">
                        {score.userPhoto ? (
                          <img 
                            src={score.userPhoto} 
                            alt={score.userName} 
                            className="rounded-circle border border-secondary"
                            style={{ width: '40px', height: '40px', objectFit: 'cover' }}
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="bg-secondary rounded-circle d-flex align-items-center justify-center" style={{ width: '40px', height: '40px' }}>
                            <UserIcon size={20} className="text-dark" />
                          </div>
                        )}
                      </div>

                      <div className="flex-grow-1 min-width-0">
                        <h6 className="m-0 text-white fw-bold text-truncate">{score.userName}</h6>
                        <p className="m-0 text-secondary xsmall text-truncate opacity-75">{score.movieTitle}</p>
                      </div>

                      <div className="text-end">
                        <div className="text-warning fw-black fs-5 lh-1">{score.score}</div>
                        <div className="text-secondary xsmall opacity-50">pts</div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-4 bg-black bg-opacity-30 border-top border-secondary text-center">
              <p className="m-0 text-secondary small">Mostrando os top 50 resultados</p>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
