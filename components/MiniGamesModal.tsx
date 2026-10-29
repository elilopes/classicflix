import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Puzzle, Gamepad2, Smile, Trophy } from 'lucide-react';

interface MiniGamesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenEmoji: () => void;
  onOpenMosaic: () => void;
  onOpenAdedonha: () => void;
  onOpenRanking: () => void;
  onOpenNosferatu: () => void;
}

export const MiniGamesModal: React.FC<MiniGamesModalProps> = ({
  isOpen,
  onClose,
  onOpenEmoji,
  onOpenMosaic,
  onOpenAdedonha,
  onOpenRanking,
  onOpenNosferatu
}) => {
  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" style={{ zIndex: 1060 }}>
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="modal-content glass-panel"
        style={{ maxWidth: '500px', width: '90%' }}
      >
        <div className="modal-header border-bottom border-secondary">
          <h5 className="modal-title d-flex align-items-center gap-2">
            <Gamepad2 className="text-info" />
            Mini Jogos Cinéfilos
          </h5>
          <button type="button" className="btn-close btn-close-white" onClick={onClose}></button>
        </div>

        <div className="modal-body p-4">
          <div className="row g-3">
            <div className="col-12">
              <button 
                onClick={() => { onOpenRanking(); onClose(); }}
                className="btn btn-outline-success w-100 p-4 d-flex flex-column align-items-center gap-3 rounded-4 transition-all hover-scale"
              >
                <Trophy size={48} />
                <div className="text-center">
                  <h4 className="mb-1">Ranking do Quiz</h4>
                </div>
              </button>
            </div>

            <div className="col-12">
              <button 
                onClick={() => { onOpenAdedonha(); onClose(); }}
                className="btn btn-outline-info w-100 p-4 d-flex flex-column align-items-center gap-3 rounded-4 transition-all hover-scale"
              >
                <Puzzle size={48} />
                <div className="text-center">
                  <h4 className="mb-1">Adedonha Cinéfila</h4>
                  <p className="small text-muted mb-0">Multiplayer em tempo real</p>
                </div>
              </button>
            </div>
            
            <div className="col-6">
              <button 
                onClick={() => { onOpenEmoji(); onClose(); }}
                className="btn btn-outline-warning w-100 p-4 d-flex flex-column align-items-center gap-3 rounded-4 transition-all hover-scale"
              >
                <Smile size={32} />
                <div className="text-center">
                  <h5 className="mb-0">Emoji Game</h5>
                </div>
              </button>
            </div>

            <div className="col-6">
              <button 
                onClick={() => { onOpenMosaic(); onClose(); }}
                className="btn btn-outline-primary w-100 p-4 d-flex flex-column align-items-center gap-3 rounded-4 transition-all hover-scale"
              >
                <Puzzle size={32} />
                <div className="text-center">
                  <h5 className="mb-0">Mosaico</h5>
                </div>
              </button>
            </div>

            <div className="col-12">
              <button 
                onClick={() => { onOpenNosferatu(); onClose(); }}
                className="btn btn-outline-danger w-100 p-4 d-flex flex-column align-items-center gap-3 rounded-4 transition-all hover-scale"
              >
                <Gamepad2 size={48} />
                <div className="text-center">
                  <h4 className="mb-1">Nosferatu: The Night Hunt</h4>
                  <p className="small text-muted mb-0">Ação Isométrica 2.5D</p>
                </div>
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
