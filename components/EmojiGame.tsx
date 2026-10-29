import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, RotateCcw, HelpCircle, Send, XCircle, CheckCircle2, Medal, Save } from 'lucide-react';
import confetti from 'canvas-confetti';
import { Movie } from '../types';
import { generateMovieEmojis, generateMovieHint } from '../services/geminiService';
import { updateUserScore } from '../services/scoreService';

interface EmojiGameProps {
    movies: Movie[];
    onClose: () => void;
    currentUser: any;
    onOpenLogin: () => void;
}

const EmojiGame: React.FC<EmojiGameProps> = ({ movies, onClose, currentUser, onOpenLogin }) => {
    const [currentMovie, setCurrentMovie] = useState<Movie | null>(null);
    const [emojis, setEmojis] = useState<string>("");
    const [guess, setGuess] = useState("");
    const [attempts, setAttempts] = useState(3);
    const [score, setScore] = useState(0);
    const [hint, setHint] = useState<string | null>(null);
    const [gameState, setGameState] = useState<'playing' | 'won' | 'lost' | 'loading'>('loading');
    const [feedback, setFeedback] = useState<{ type: 'success' | 'error', message: string } | null>(null);
    const [saved, setSaved] = useState(false);

    const startNewRound = async () => {
        setGameState('loading');
        setGuess("");
        setAttempts(3);
        setHint(null);
        setFeedback(null);

        // Pick a random movie with a title
        const validMovies = movies.filter(m => m.title && m.title.length > 2);
        const randomMovie = validMovies[Math.floor(Math.random() * validMovies.length)];
        setCurrentMovie(randomMovie);

        try {
            const emojiResult = await generateMovieEmojis(randomMovie.title);
            setEmojis(emojiResult);
            setGameState('playing');
        } catch (error) {
            console.error("Failed to start round:", error);
            setGameState('playing'); // Fallback
            setEmojis("🎬❓");
        }
    };

    useEffect(() => {
        if (movies.length > 0) {
            startNewRound();
        }
    }, [movies]);

    useEffect(() => {
        if ((gameState === 'won' || gameState === 'lost') && currentUser && !saved) {
            updateUserScore('emojiscore', score).then(() => setSaved(true)).catch(console.error);
        }
    }, [gameState, currentUser, score, saved]);

    const handleGuess = async () => {
        if (!currentMovie || gameState !== 'playing' || !guess.trim()) return;

        const isCorrect = guess.toLowerCase().trim() === currentMovie.title.toLowerCase().trim();

        if (isCorrect) {
            setScore(prev => prev + (attempts * 10));
            setGameState('won');
            setFeedback({ type: 'success', message: `Correct! It was "${currentMovie.title}"` });
            confetti({
                particleCount: 150,
                spread: 70,
                origin: { y: 0.6 },
                colors: ['#FFD700', '#FFA500', '#FF4500']
            });
        } else {
            const newAttempts = attempts - 1;
            setAttempts(newAttempts);

            if (newAttempts === 2) {
                // First mistake: get hint
                const hintText = await generateMovieHint(currentMovie.title, currentMovie.year);
                setHint(hintText);
                setFeedback({ type: 'error', message: "Wrong! Here's a hint." });
            } else if (newAttempts === 0) {
                setGameState('lost');
                setFeedback({ type: 'error', message: `Game Over! It was "${currentMovie.title}"` });
            } else {
                setFeedback({ type: 'error', message: "Try again!" });
            }
        }
        setGuess("");
    };

    const handleSaveScore = () => {
        if (!currentUser) {
            onOpenLogin();
        } else {
            updateUserScore('emojiscore', score).then(() => setSaved(true)).catch(console.error);
        }
    };

    return (
        <div className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center p-3" style={{ backgroundColor: 'rgba(0,0,0,0.9)', zIndex: 10000, backdropFilter: 'blur(5px)' }}>
            <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="bg-dark border border-secondary w-100 rounded-4 overflow-hidden shadow-lg position-relative"
                style={{ maxWidth: '28rem' }}
            >
                {/* Header */}
                <div className="p-3 border-bottom border-secondary d-flex justify-content-between align-items-center" style={{ backgroundColor: 'rgba(33,37,41,0.5)' }}>
                    <div className="d-flex align-items-center gap-3">
                        <div className="d-flex align-items-center justify-content-center" style={{ width: '40px', height: '40px' }}>
                            <Trophy className="text-warning" size={24} />
                        </div>
                        <div>
                            <h2 className="text-white fw-bold h5 mb-0">Emoji Movie Game</h2>
                            <p className="text-secondary small font-monospace text-uppercase mb-0" style={{ fontSize: '0.75rem', letterSpacing: '1px' }}>Score: {score}</p>
                        </div>
                    </div>
                    <button 
                        onClick={onClose}
                        className="btn btn-link text-secondary p-2"
                    >
                        <XCircle size={24} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-4 d-flex flex-column align-items-center text-center gap-4">
                    {gameState === 'loading' ? (
                        <div className="py-5 d-flex flex-column align-items-center gap-3">
                            <div className="spinner-border text-warning" role="status" style={{ width: '3rem', height: '3rem' }}>
                                <span className="visually-hidden">Loading...</span>
                            </div>
                            <p className="text-secondary fw-medium m-0">Generating clues...</p>
                        </div>
                    ) : (
                        <>
                            {/* Emoji Display */}
                            <motion.div 
                                key={emojis}
                                initial={{ y: 20, opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                                className="display-1 py-4"
                                style={{ letterSpacing: '0.2em', textShadow: '0 4px 6px rgba(0,0,0,0.5)' }}
                            >
                                {emojis}
                            </motion.div>

                            {/* Game Info */}
                            <div className="w-100 d-flex flex-column gap-3">
                                <div className="d-flex justify-content-center gap-2">
                                    {[...Array(3)].map((_, i) => (
                                        <motion.div 
                                            key={i}
                                            animate={{ 
                                                scale: i < attempts ? 1 : 0.8,
                                                opacity: i < attempts ? 1 : 0.3
                                            }}
                                            className={`rounded-circle ${i < attempts ? 'bg-warning' : 'bg-secondary'}`}
                                            style={{ 
                                                width: '12px', 
                                                height: '12px',
                                                boxShadow: i < attempts ? '0 0 10px rgba(255, 193, 7, 0.5)' : 'none'
                                            }}
                                        />
                                    ))}
                                </div>

                                {hint && (
                                    <motion.div 
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: 'auto' }}
                                        className="bg-secondary bg-opacity-25 border border-secondary p-3 rounded-3 small text-light fst-italic d-flex align-items-start gap-3 text-start"
                                    >
                                        <HelpCircle size={20} className="text-warning flex-shrink-0 mt-1" />
                                        <p className="m-0">{hint}</p>
                                    </motion.div>
                                )}

                                {feedback && (
                                    <motion.div 
                                        initial={{ opacity: 0, scale: 0.9 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        className={`d-flex align-items-center justify-content-center gap-2 small fw-medium ${
                                            feedback.type === 'success' ? 'text-success' : 'text-danger'
                                        }`}
                                    >
                                        {feedback.type === 'success' ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
                                        {feedback.message}
                                    </motion.div>
                                )}

                                {gameState === 'playing' ? (
                                    <div className="d-flex gap-2">
                                        <input 
                                            type="text"
                                            value={guess}
                                            onChange={(e) => setGuess(e.target.value)}
                                            onKeyDown={(e) => e.key === 'Enter' && handleGuess()}
                                            placeholder="What's the movie?"
                                            className="form-control bg-dark text-white border-secondary rounded-3 py-2 px-3 flex-grow-1 shadow-none"
                                            autoFocus
                                        />
                                        <button 
                                            onClick={handleGuess}
                                            disabled={!guess.trim()}
                                            className="btn btn-warning fw-bold px-4 rounded-3 d-flex align-items-center justify-content-center"
                                        >
                                            <Send size={20} />
                                        </button>
                                    </div>
                                ) : (
                                    <div className="d-flex flex-column gap-3">
                                        <AnimatePresence>
                                            {gameState === 'won' && (
                                                <motion.div 
                                                    initial={{ scale: 0, rotate: -20 }}
                                                    animate={{ scale: 1, rotate: 0 }}
                                                    className="d-flex justify-content-center py-2"
                                                >
                                                    <Medal size={64} className="text-warning" style={{ filter: 'drop-shadow(0 0 15px rgba(255, 193, 7, 0.4))' }} />
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                        <button 
                                            onClick={startNewRound}
                                            className="btn btn-light w-100 fw-bold py-3 rounded-3 d-flex align-items-center justify-content-center gap-2"
                                        >
                                            <RotateCcw size={20} />
                                            Play Again
                                        </button>
                                        {!saved && (
                                            <button 
                                                onClick={handleSaveScore}
                                                className="btn btn-outline-warning w-100 fw-bold py-2 rounded-3 d-flex align-items-center justify-content-center gap-2"
                                            >
                                                <Save size={18} />
                                                Salvar Pontuação
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>

                {/* Footer */}
                <div className="p-3 text-center" style={{ backgroundColor: 'rgba(0,0,0,0.2)' }}>
                    <p className="m-0 text-secondary font-monospace text-uppercase" style={{ fontSize: '10px', letterSpacing: '0.2em' }}>Powered by Gemini AI</p>
                </div>
            </motion.div>
        </div>
    );
};

export default EmojiGame;
