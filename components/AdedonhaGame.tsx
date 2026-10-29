import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Play, Users, Trophy, Clock, RefreshCw } from 'lucide-react';
import { io, Socket } from 'socket.io-client';
import { Wheel } from 'react-custom-roulette';
import { updateUserScore } from '../services/scoreService';
import { validateAdedonhaAnswer } from '../services/geminiService';

interface AdedonhaGameProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: any;
}

interface Player {
  id: string;
  name: string;
  score: number;
  currentAnswer: string;
  isReady: boolean;
}

interface Challenge {
  category: string;
  letter: string;
  label: string;
}

interface Room {
  id: string;
  players: Record<string, Player>;
  state: 'waiting' | 'spinning' | 'playing' | 'round_results' | 'game_over';
  currentChallenge: Challenge | null;
  timer: number;
  round: number;
  maxRounds: number;
  answers: Record<string, { answer: string, isCorrect: boolean, points: number }>;
}

export const AdedonhaGame: React.FC<AdedonhaGameProps> = ({ isOpen, onClose, currentUser }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [roomId, setRoomId] = useState<string>('');
  const [room, setRoom] = useState<Room | null>(null);
  const [answer, setAnswer] = useState('');
  const [isJoined, setIsJoined] = useState(false);
  const [timer, setTimer] = useState(0);
  const [wheelOptions, setWheelOptions] = useState<any[]>([]);
  const [wheelState, setWheelState] = useState({ prizeNumber: 0, mustSpin: false });

  // We need a fixed set of options for the wheel to work consistently
  // The server will tell us which index to stop at

  useEffect(() => {
    if (isOpen) {
      const newSocket = io(window.location.origin, { transports: ['websocket'] });
      setSocket(newSocket);

      newSocket.on('room_state', (updatedRoom: Room) => {
        setRoom(updatedRoom);
        setTimer(updatedRoom.timer);
        
        if (updatedRoom.state === 'spinning' && updatedRoom.currentChallenge) {
          // Generate wheel data if not present or if challenge changed
          // For simplicity, we'll just use the current challenge as the winner
          // and some random ones around it
          const options = [
            { option: 'Títulos - A' },
            { option: 'Diretores - B' },
            { option: 'Desenhos - C' },
            { option: 'Temas - D' },
            { option: 'Títulos - E' },
            { option: 'Diretores - F' },
            { option: 'Desenhos - G' },
            { option: 'Temas - H' },
          ];
          
          // Find or inject the actual challenge
          const winnerLabel = updatedRoom.currentChallenge.label;
          const winnerIdx = 2; // Fixed position for the winner in our local wheel
          options[winnerIdx] = { option: winnerLabel };
          
          setWheelOptions(options); // Add this
          const optionsCount = options.length;
          if (optionsCount > 0) {
            const safeWinnerIdx = isNaN(winnerIdx) ? 0 : Math.max(0, Math.min(winnerIdx, optionsCount - 1));
            setWheelState({ prizeNumber: safeWinnerIdx, mustSpin: false });
            setTimeout(() => {
              setWheelState(prev => ({ ...prev, mustSpin: true }));
            }, 50);
          }
        }

        if (updatedRoom.state === 'playing') {
          setWheelState(prev => ({ ...prev, mustSpin: false }));
        }
      });

      newSocket.on('timer_update', (time: number) => {
        setTimer(time);
      });

      newSocket.on('request_validation', async ({ roomId, challenge, answers }) => {
        console.log("Received validation request for", answers.length, "answers");
        const results: Record<string, boolean> = {};
        
        for (const item of answers) {
          try {
            results[item.playerId] = await validateAdedonhaAnswer(challenge.category, challenge.letter, item.answer);
          } catch (e) {
            console.error("Validation error for", item.answer, e);
            results[item.playerId] = false;
          }
        }
        
        newSocket.emit('validation_results', { roomId, results });
      });

      return () => {
        newSocket.disconnect();
      };
    }
  }, [isOpen]);

  const joinRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomId.trim() || !socket) return;
    
    socket.emit('join_room', { 
      roomId: roomId.trim().toUpperCase(), 
      playerName: currentUser?.email?.split('@')[0] || 'Jogador'
    });
    setIsJoined(true);
  };

  const startGame = () => {
    if (socket && room) {
      socket.emit('start_game', { roomId: room.id });
    }
  };

  const submitAnswer = (e: React.FormEvent) => {
    e.preventDefault();
    if (socket && room && room.state === 'playing') {
      socket.emit('submit_answer', { roomId: room.id, answer });
    }
  };

  // Auto-submit answer when timer runs out
  useEffect(() => {
    if (room?.state === 'playing' && timer === 1 && socket) {
      socket.emit('submit_answer', { roomId: room.id, answer });
    }
  }, [timer, room?.state, socket, answer, room?.id]);

  // Reset local answer when new round starts
  useEffect(() => {
    if (room?.state === 'spinning') {
      setAnswer('');
    }
  }, [room?.state]);

  // Save score when game is over
  useEffect(() => {
    if (room?.state === 'game_over' && socket?.id) {
      const myPlayer = room.players[socket.id];
      if (myPlayer) {
        updateUserScore('stopscore', myPlayer.score);
      }
    }
  }, [room?.state, room?.players, socket?.id]);

  const wheelData = React.useMemo(() => (wheelOptions || []).map((opt, i) => ({
    option: opt?.option || '?',
    style: { backgroundColor: i % 2 === 0 ? '#e50914' : '#222', textColor: 'white' }
  })), [wheelOptions]);

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" style={{ zIndex: 1060 }}>
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="modal-content glass-panel"
        style={{ maxWidth: '1200px', width: '95%', maxHeight: '95vh', overflowY: 'auto' }}
      >
        <div className="modal-header border-bottom border-secondary">
          <h5 className="modal-title d-flex align-items-center gap-2">
            <Trophy className="text-warning" />
            Adedonha Cinéfila (Socket.IO + AI)
          </h5>
          <button type="button" className="btn-close btn-close-white" onClick={onClose}></button>
        </div>

        <div className="modal-body p-4">
          {!isJoined ? (
            <div className="text-center py-5">
              <h3 className="mb-4">Junte-se a uma sala</h3>
              <form onSubmit={joinRoom} className="d-flex justify-content-center gap-2 max-w-md mx-auto">
                <input 
                  type="text" 
                  className="form-control bg-dark text-white border-secondary" 
                  placeholder="Código da Sala (ex: SALA1)"
                  value={roomId}
                  onChange={(e) => setRoomId(e.target.value)}
                  maxLength={10}
                  required
                  style={{ maxWidth: '250px' }}
                />
                <button type="submit" className="btn btn-primary">
                  Entrar
                </button>
              </form>
            </div>
          ) : !room ? (
            <div className="text-center py-5">
              <RefreshCw className="animate-spin mb-3 text-danger" size={48} />
              <p>Conectando à sala...</p>
            </div>
          ) : (
            <div className="game-container">
              {/* Header Info */}
              <div className="d-flex justify-content-between align-items-center mb-4 p-3 bg-dark rounded border border-secondary">
                <div>
                  <span className="text-muted small">Sala:</span>
                  <strong className="ms-2 fs-5">{room.id}</strong>
                </div>
                <div>
                  <span className="text-muted small">Rodada:</span>
                  <strong className="ms-2 fs-5">{room.round} / {room.maxRounds}</strong>
                </div>
                <div className="d-flex align-items-center gap-2">
                  <Users size={18} className="text-info" />
                  <span>{Object.keys(room.players).length} Jogadores</span>
                </div>
              </div>

              {/* Game State Area */}
              <div className="text-center py-4 min-vh-50 d-flex flex-column justify-content-center align-items-center">
                
                {room.state === 'waiting' && (
                  <div>
                    <h3 className="mb-4">Aguardando jogadores...</h3>
                    <div className="d-flex flex-wrap justify-content-center gap-3 mb-5">
                      {Object.values(room.players).map((p: Player) => (
                        <div key={p.id} className="badge bg-secondary p-3 fs-6 rounded-pill">
                          {p.name} {p.id === socket?.id ? '(Você)' : ''}
                        </div>
                      ))}
                    </div>
                    {Object.keys(room.players)[0] === socket?.id ? (
                      <button onClick={startGame} className="btn btn-success btn-lg px-5 rounded-pill">
                        <Play className="me-2" /> Iniciar Jogo
                      </button>
                    ) : (
                      <p className="text-muted">Aguardando o anfitrião iniciar o jogo...</p>
                    )}
                  </div>
                )}

                {room.state === 'spinning' && wheelData.length > 0 && (
                  <motion.div 
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="d-flex flex-column align-items-center"
                  >
                    <h3 className="mb-4">Sorteando categoria e letra...</h3>
                    <div style={{ maxWidth: '400px', margin: '0 auto' }}>
                      {wheelData.length > 0 && (
                        <Wheel
                          mustStartSpinning={wheelState.mustSpin}
                          prizeNumber={wheelState.prizeNumber}
                          data={wheelData}
                          backgroundColors={['#e50914', '#222']}
                          textColors={['#ffffff']}
                          outerBorderColor="#333"
                          outerBorderWidth={5}
                          innerBorderColor="#333"
                          innerBorderWidth={2}
                          radiusLineColor="#333"
                          radiusLineWidth={1}
                          fontSize={14}
                        />
                      )}
                    </div>
                  </motion.div>
                )}

                {room.state === 'playing' && room.currentChallenge && (
                  <motion.div 
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="playing-area w-100"
                  >
                    <div className="challenge-card bg-primary bg-gradient p-4 rounded-4 mb-4 shadow-lg">
                      <h2 className="text-white mb-0 fw-bold">{room.currentChallenge.label}</h2>
                    </div>
                    
                    <div className="timer-display display-1 fw-bold mb-4 d-flex align-items-center justify-content-center gap-3" style={{ color: timer <= 5 ? '#dc3545' : '#fff' }}>
                      <Clock size={48} />
                      {timer}s
                    </div>

                    <form onSubmit={submitAnswer} className="max-w-md mx-auto">
                      <div className="input-group input-group-lg">
                        <input 
                          type="text" 
                          className="form-control bg-dark text-white border-primary" 
                          placeholder="Digite sua resposta..."
                          value={answer}
                          onChange={(e) => setAnswer(e.target.value)}
                          autoFocus
                        />
                        <button type="submit" className="btn btn-primary">Enviar</button>
                      </div>
                      <div className="mt-2 text-muted small">
                        A resposta será enviada automaticamente quando o tempo acabar.
                      </div>
                    </form>
                  </motion.div>
                )}

                {room.state === 'round_results' && (
                  <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="w-100"
                  >
                    <h3 className="mb-4">Resultados da Rodada</h3>
                    <div className="challenge-card bg-dark p-3 rounded mb-4 border border-secondary">
                      <h5 className="text-info mb-0">{room.currentChallenge?.label}</h5>
                    </div>
                    
                    <div className="table-responsive">
                      <table className="table table-dark table-hover align-middle">
                        <thead>
                          <tr>
                            <th>Jogador</th>
                            <th>Resposta</th>
                            <th>Pontos</th>
                          </tr>
                        </thead>
                        <tbody>
                          {Object.values(room.players).map((p: Player) => {
                            const result = room.answers[p.id];
                            return (
                              <tr key={p.id}>
                                <td>{p.name} {p.id === socket?.id ? '(Você)' : ''}</td>
                                <td>
                                  {result?.answer ? (
                                    <span className={result.isCorrect ? 'text-success' : 'text-danger'}>
                                      {result.answer}
                                    </span>
                                  ) : (
                                    <span className="text-muted">-</span>
                                  )}
                                </td>
                                <td>
                                  {result?.isCorrect ? (
                                    <span className="badge bg-success">+10</span>
                                  ) : (
                                    <span className="badge bg-danger">0</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </motion.div>
                )}

                {room.state === 'game_over' && (
                  <motion.div 
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="w-100"
                  >
                    <Trophy size={64} className="text-warning mb-3" />
                    <h2 className="mb-4">Fim de Jogo!</h2>
                    
                    <div className="leaderboard max-w-md mx-auto">
                      {Object.values(room.players)
                        .sort((a: Player, b: Player) => b.score - a.score)
                        .map((p: Player, index) => (
                          <div key={p.id} className={`d-flex justify-content-between align-items-center p-3 mb-2 rounded ${index === 0 ? 'bg-warning text-dark fw-bold' : 'bg-dark border border-secondary'}`}>
                            <div className="d-flex align-items-center gap-3">
                              <span className="fs-4">#{index + 1}</span>
                              <span className="fs-5">{p.name}</span>
                            </div>
                            <span className="fs-4">{p.score} pts</span>
                          </div>
                        ))}
                    </div>
                    
                    <button onClick={() => setIsJoined(false)} className="btn btn-outline-light mt-4">
                      Sair da Sala
                    </button>
                  </motion.div>
                )}

              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};
