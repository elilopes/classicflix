import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Loader2, Award, CheckCircle2, XCircle, RefreshCw, Sparkles, PlayCircle, Save } from 'lucide-react';
import { GoogleGenAI, Type } from "@google/genai";
import { Movie } from '../types';
import { updateUserScore } from '../services/scoreService';

interface Question {
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
}

interface QuizModalProps {
  isOpen: boolean;
  onClose: () => void;
  movie: Movie;
  currentUser: any;
}

export const QuizModal: React.FC<QuizModalProps> = ({ isOpen, onClose, movie, currentUser }) => {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState<'intro' | 'quiz' | 'result'>('intro');
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [answers, setAnswers] = useState<{ questionIndex: number; selected: number; isCorrect: boolean }[]>([]);
  const [saved, setSaved] = useState(false);

  const generateQuiz = async () => {
    setLoading(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Gere um quiz de 5 perguntas sobre o filme "${movie.titlePt || movie.title}" (${movie.year}), dirigido por ${movie.director}. 
        As perguntas devem ser variadas (enredo, curiosidades, produção). 
        Retorne APENAS um JSON no formato:
        [
          {
            "question": "pergunta",
            "options": ["opção 0", "opção 1", "opção 2", "opção 3"],
            "correctAnswer": 0,
            "explanation": "explicação curta"
          }
        ]`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                question: { type: Type.STRING },
                options: { type: Type.ARRAY, items: { type: Type.STRING } },
                correctAnswer: { type: Type.INTEGER },
                explanation: { type: Type.STRING }
              },
              required: ["question", "options", "correctAnswer", "explanation"]
            }
          }
        }
      });

      const data = JSON.parse(response.text);
      setQuestions(data);
      setCurrentStep('quiz');
      setCurrentQuestionIndex(0);
      setScore(0);
      setAnswers([]);
      setSelectedOption(null);
      setSaved(false);
    } catch (error) {
      console.error("Erro ao gerar quiz:", error);
      alert("Não foi possível gerar o quiz no momento.");
    } finally {
      setLoading(false);
    }
  };

  const handleOptionSelect = (index: number) => {
    if (selectedOption !== null) return;
    
    setSelectedOption(index);
    const isCorrect = index === questions[currentQuestionIndex].correctAnswer;
    
    if (isCorrect) setScore(prev => prev + 1);
    
    setAnswers(prev => [...prev, {
      questionIndex: currentQuestionIndex,
      selected: index,
      isCorrect
    }]);

    setTimeout(() => {
      if (currentQuestionIndex < questions.length - 1) {
        setCurrentQuestionIndex(prev => prev + 1);
        setSelectedOption(null);
      } else {
        setCurrentStep('result');
        const finalScore = score + (isCorrect ? 1 : 0);
        if (currentUser) {
          updateUserScore('quizscore', finalScore);
          setSaved(true);
        }
      }
    }, 2000);
  };

  const handleSaveScore = () => {
    if (!currentUser) {
      alert("Faça a autenticação para salvar a pontuação deste jogo.");
    } else {
      updateUserScore('quizscore', score);
      setSaved(true);
    }
  };

  const resetQuiz = () => {
    setCurrentStep('intro');
    setQuestions([]);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div 
          className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-center p-4" 
          style={{ zIndex: 1100, backgroundColor: 'rgba(0,0,0,0.9)', backdropFilter: 'blur(10px)' }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-dark border border-secondary w-100 shadow-lg d-flex flex-column overflow-hidden"
            style={{ maxWidth: '600px', maxHeight: '90vh', borderRadius: '2rem' }}
          >
            <div className="p-4 border-bottom border-secondary d-flex justify-content-between align-items-center bg-black bg-opacity-50">
              <div className="d-flex align-items-center gap-2">
                <Award className="text-warning" size={24} />
                <h3 className="m-0 text-white fw-bold text-uppercase small tracking-wider">CineQuiz: {movie.titlePt || movie.title}</h3>
              </div>
              <button onClick={onClose} className="btn btn-link text-secondary p-0">
                <X size={24} />
              </button>
            </div>

            <div className="flex-grow-1 overflow-auto p-4 p-lg-5 custom-scrollbar">
              {currentStep === 'intro' && (
                <div className="text-center py-4">
                  <div className="bg-warning bg-opacity-10 rounded-circle d-flex align-items-center justify-center mx-auto mb-4" style={{ width: '80px', height: '80px' }}>
                    <Sparkles className="text-warning" size={40} />
                  </div>
                  <h2 className="text-white fw-bold mb-3">Teste seus conhecimentos!</h2>
                  <p className="text-secondary mb-5">Geramos 5 perguntas personalizadas sobre este clássico usando IA.</p>
                  
                  <button
                    onClick={generateQuiz}
                    disabled={loading}
                    className="btn btn-warning w-100 py-3 fw-bold rounded-pill d-flex align-items-center justify-center gap-2 shadow"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="animate-spin" size={20} />
                        Gerando Quiz...
                      </>
                    ) : (
                      <>
                        <PlayCircle size={20} />
                        Começar Agora
                      </>
                    )}
                  </button>
                </div>
              )}

              {currentStep === 'quiz' && questions.length > 0 && (
                <div className="d-flex flex-column gap-4">
                  <div className="d-flex justify-content-between align-items-center small fw-bold text-secondary">
                    <span>Pergunta {currentQuestionIndex + 1} de {questions.length}</span>
                    <span className="text-warning">Score: {score}</span>
                  </div>
                  
                  <div className="bg-secondary bg-opacity-25 rounded-pill overflow-hidden" style={{ height: '8px' }}>
                    <motion.div 
                      className="h-100 bg-warning"
                      initial={{ width: 0 }}
                      animate={{ width: `${((currentQuestionIndex + 1) / questions.length) * 100}%` }}
                    />
                  </div>

                  <h2 className="text-white fw-bold lh-sm mb-4">
                    {questions[currentQuestionIndex].question}
                  </h2>

                  <div className="d-flex flex-column gap-2">
                    {questions[currentQuestionIndex].options.map((option, idx) => {
                      const isSelected = selectedOption === idx;
                      const isCorrect = idx === questions[currentQuestionIndex].correctAnswer;
                      const showResult = selectedOption !== null;

                      let btnClass = "btn btn-outline-secondary text-start p-3 border-2 rounded-3";
                      let style = { transition: 'all 0.2s' };
                      
                      if (showResult) {
                        if (isCorrect) {
                          btnClass = "btn btn-success text-start p-3 border-2 rounded-3 bg-opacity-25 text-success border-success";
                        } else if (isSelected) {
                          btnClass = "btn btn-danger text-start p-3 border-2 rounded-3 bg-opacity-25 text-danger border-danger";
                        }
                      }

                      return (
                        <button
                          key={idx}
                          onClick={() => handleOptionSelect(idx)}
                          disabled={showResult}
                          className={`${btnClass} d-flex align-items-center justify-content-between`}
                          style={style}
                        >
                          <span className="fw-bold">{option}</span>
                          {showResult && isCorrect && <CheckCircle2 className="text-success" size={20} />}
                          {showResult && isSelected && !isCorrect && <XCircle className="text-danger" size={20} />}
                        </button>
                      );
                    })}
                  </div>

                  {selectedOption !== null && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-3 bg-dark border border-secondary rounded-3 mt-3"
                    >
                      <p className="small text-secondary m-0">
                        <span className="fw-bold text-warning">Saiba mais:</span> {questions[currentQuestionIndex].explanation}
                      </p>
                    </motion.div>
                  )}
                </div>
              )}

              {currentStep === 'result' && (
                <div className="text-center py-4">
                  <div className="position-relative d-inline-block mb-4">
                    <div className="bg-warning bg-opacity-10 rounded-circle d-flex align-items-center justify-center mx-auto" style={{ width: '120px', height: '120px' }}>
                      <Award className="text-warning" size={60} />
                    </div>
                    <div className="position-absolute top-0 end-0 bg-success text-white xsmall fw-bold px-3 py-1 rounded-pill shadow">
                      FIM!
                    </div>
                  </div>

                  <div className="mb-5">
                    <h2 className="text-white fw-black mb-1">
                      {score === questions.length ? 'PERFEITO!' : score >= 3 ? 'MUITO BEM!' : 'BOM TENTATIVA!'}
                    </h2>
                    <p className="text-secondary fs-5">Você acertou {score} de {questions.length} perguntas.</p>
                  </div>

                  <div className="row g-3">
                    <div className="col-6">
                      <button
                        onClick={resetQuiz}
                        className="btn btn-outline-light w-100 py-3 fw-bold rounded-pill d-flex align-items-center justify-center gap-2"
                      >
                        <RefreshCw size={18} />
                        Refazer
                      </button>
                    </div>
                    <div className="col-6">
                      <button
                        onClick={onClose}
                        className="btn btn-warning w-100 py-3 fw-bold rounded-pill"
                      >
                        Fechar
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
