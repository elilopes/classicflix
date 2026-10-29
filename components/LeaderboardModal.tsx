import * as React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Trophy, Medal, User, Film, Calendar } from 'lucide-react';
import { getLeaderboard } from '../services/supabaseClient';

interface LeaderboardEntry {
  id: string;
  userid: string;
  email: string;
  score: number;
  title: string;
  created_at: string;
}

interface LeaderboardModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function LeaderboardModal({ isOpen, onClose }: LeaderboardModalProps) {
  const [leaderboard, setLeaderboard] = React.useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (isOpen) {
      const fetchData = async () => {
        setLoading(true);
        try {
          const data = await getLeaderboard();
          setLeaderboard(data || []);
        } catch (error) {
          console.error("Error fetching leaderboard:", error);
          setLeaderboard([]);
        } finally {
          setLoading(false);
        }
      };
      fetchData();
    }
  }, [isOpen]);

  const getMedalColor = (index: number) => {
    switch (index) {
      case 0: return 'text-warning'; // Gold
      case 1: return 'text-secondary'; // Silver
      case 2: return 'text-orange-400'; // Bronze (using a custom color or orange)
      default: return 'text-muted';
    }
  };

  const getMedalIcon = (index: number) => {
    if (index < 3) return <Medal size={20} className={getMedalColor(index)} />;
    return <span className="text-secondary fw-bold" style={{ width: '20px', textAlign: 'center' }}>{index + 1}</span>;
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div 
          className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-center p-4" 
          style={{ zIndex: 1200, backgroundColor: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)' }}
        >
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="bg-dark border border-secondary w-100 shadow-2xl d-flex flex-column overflow-hidden"
            style={{ maxWidth: '700px', maxHeight: '85vh', borderRadius: '1.5rem' }}
          >
            <div className="p-4 border-bottom border-secondary d-flex justify-content-between align-items-center bg-black bg-opacity-40">
              <div className="d-flex align-items-center gap-3">
                <div className="bg-warning bg-opacity-20 p-2 rounded-lg">
                  <Trophy className="text-warning" size={28} />
                </div>
                <div>
                  <h3 className="m-0 text-white fw-bold text-uppercase tracking-wider">Ranking Global</h3>
                  <p className="m-0 text-secondary small">Os mestres do cinema clássico</p>
                </div>
              </div>
              <button onClick={onClose} className="btn btn-link text-secondary p-2 hover:text-white transition-colors">
                <X size={28} />
              </button>
            </div>

            <div className="flex-grow-1 overflow-auto p-0 custom-scrollbar">
              {loading ? (
                <div className="d-flex flex-column align-items-center justify-center py-10 gap-3">
                  <div className="spinner-border text-warning" role="status"></div>
                  <span className="text-secondary">Carregando ranking...</span>
                </div>
              ) : leaderboard.length === 0 ? (
                <div className="text-center py-10">
                  <Trophy size={48} className="text-secondary opacity-20 mb-3 mx-auto" />
                  <p className="text-secondary">Nenhum score registrado ainda. Seja o primeiro!</p>
                </div>
              ) : (
                <div className="table-responsive">
                  <table className="table table-dark table-hover m-0">
                    <thead className="bg-black bg-opacity-20">
                      <tr>
                        <th className="ps-4 py-3 border-secondary text-secondary small text-uppercase">Pos</th>
                        <th className="py-3 border-secondary text-secondary small text-uppercase">Usuário</th>
                        <th className="py-3 border-secondary text-secondary small text-uppercase">Filme</th>
                        <th className="py-3 border-secondary text-secondary small text-uppercase text-center">Score</th>
                        <th className="pe-4 py-3 border-secondary text-secondary small text-uppercase text-end">Data</th>
                      </tr>
                    </thead>
                    <tbody>
                      {leaderboard.map((entry, index) => (
                        <motion.tr 
                          key={entry.id || `${entry.userid}-${index}`}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.05 }}
                          className="align-middle"
                        >
                          <td className="ps-4 py-3 border-secondary">
                            <div className="d-flex align-items-center justify-center" style={{ width: '32px', height: '32px' }}>
                              {getMedalIcon(index)}
                            </div>
                          </td>
                          <td className="py-3 border-secondary">
                            <div className="d-flex align-items-center gap-2">
                              <User size={14} className="text-secondary" />
                              <span className={`fw-bold ${index < 3 ? 'text-white' : 'text-secondary'}`}>
                                {entry.email ? entry.email.split('@')[0] : 'Anônimo'}
                              </span>
                            </div>
                          </td>
                          <td className="py-3 border-secondary">
                            <div className="d-flex align-items-center gap-2 text-secondary small">
                              <Film size={14} />
                              <span className="text-truncate" style={{ maxWidth: '150px' }}>{entry.title}</span>
                            </div>
                          </td>
                          <td className="py-3 border-secondary text-center">
                            <span className={`badge rounded-pill ${index === 0 ? 'bg-warning text-dark' : 'bg-secondary bg-opacity-50'} px-3`}>
                              {entry.score}/5
                            </span>
                          </td>
                          <td className="pe-4 py-3 border-secondary text-end text-secondary small">
                            <div className="d-flex align-items-center justify-content-end gap-1">
                              <Calendar size={12} />
                              {new Date(entry.created_at).toLocaleDateString()}
                            </div>
                          </td>
                        </motion.tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            
            <div className="p-4 bg-black bg-opacity-20 border-top border-secondary text-center">
              <p className="text-secondary small m-0">
                Participe dos quizzes nos detalhes de cada filme para subir no ranking!
              </p>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

