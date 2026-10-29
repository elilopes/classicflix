
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, HardDrive, Search, Loader2, Image as ImageIcon, 
  ExternalLink, LogIn, ChevronRight, RefreshCw, AlertTriangle,
  Users, User
} from 'lucide-react';
import { connectDrive, listDriveImages, listSharedImages, DriveFile } from '../services/googleDriveService';

interface GoogleDriveModalProps {
  isOpen: boolean;
  onClose: () => void;
  appLanguage: string;
}

export const GoogleDriveModal: React.FC<GoogleDriveModalProps> = ({ 
  isOpen, 
  onClose, 
  appLanguage 
}) => {
  const [viewMode, setViewMode] = useState<'personal' | 'shared'>('personal');
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const isPt = appLanguage === 'pt';

  const handleConnect = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const token = await connectDrive();
      if (token) {
        setAccessToken(token);
        await loadFiles('personal', token);
      }
    } catch (err: any) {
      if (err.code === 'auth/popup-closed-by-user') {
        setError(isPt 
          ? 'O login foi cancelado porque a janela foi fechada. Por favor, tente novamente e mantenha a janela aberta.' 
          : 'Login was cancelled because the window was closed. Please try again and keep the window open.');
      } else if (err.code === 'auth/popup-blocked') {
        setError(isPt 
          ? 'O navegador bloqueou a janela de login. Por favor, permita popups para este site.' 
          : 'The browser blocked the login window. Please allow popups for this site.');
      } else {
        setError(err.message || (isPt ? 'Erro ao conectar ao Google Drive.' : 'Error connecting to Google Drive.'));
      }
    } finally {
      setIsLoading(false);
    }
  };

  const loadFiles = async (mode: 'personal' | 'shared', token?: string) => {
    setIsLoading(true);
    setError(null);
    try {
      let driveFiles: DriveFile[] = [];
      if (mode === 'personal') {
        if (!token) return;
        driveFiles = await listDriveImages(token);
      } else {
        driveFiles = await listSharedImages();
      }
      setFiles(driveFiles);
    } catch (err: any) {
      setError(err.message || (isPt ? 'Erro ao listar arquivos.' : 'Error listing files.'));
    } finally {
      setIsLoading(false);
    }
  };

  const switchMode = async (mode: 'personal' | 'shared') => {
    setViewMode(mode);
    setFiles([]);
    if (mode === 'personal') {
      if (accessToken) await loadFiles('personal', accessToken);
    } else {
      await loadFiles('shared');
    }
  };

  const filteredFiles = files.filter(f => 
    f.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!isOpen) return null;

  return (
    <div className="modal show d-block" tabIndex={-1} style={{ backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 1060 }}>
      <div className="modal-dialog modal-lg modal-dialog-centered">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          className="modal-content bg-dark border-secondary text-white shadow-lg overflow-hidden"
          style={{ maxHeight: '85vh' }}
        >
          <div className="modal-header border-bottom border-secondary d-flex flex-column p-0">
            <div className="w-100 d-flex justify-content-between align-items-center p-3">
              <div className="d-flex align-items-center gap-2">
                <HardDrive className="text-info" size={24} />
                <h5 className="modal-title fw-bold m-0">
                  {isPt ? 'Integração Google Drive' : 'Google Drive Integration'}
                </h5>
              </div>
              <button type="button" className="btn-close btn-close-white shadow-none" onClick={onClose}></button>
            </div>
            
            <div className="w-100 d-flex px-3 pb-2 gap-2">
              <button 
                className={`btn btn-sm d-flex align-items-center gap-2 px-3 ${viewMode === 'personal' ? 'btn-info' : 'btn-outline-secondary'}`}
                onClick={() => switchMode('personal')}
              >
                <User size={14} />
                {isPt ? 'Meus Arquivos' : 'My Files'}
              </button>
              <button 
                className={`btn btn-sm d-flex align-items-center gap-2 px-3 ${viewMode === 'shared' ? 'btn-info' : 'btn-outline-secondary'}`}
                onClick={() => switchMode('shared')}
              >
                <Users size={14} />
                {isPt ? 'Sistema / Assets' : 'System / Assets'}
              </button>
            </div>
          </div>

          <div className="modal-body p-0 d-flex flex-column" style={{ minHeight: '400px' }}>
            {viewMode === 'personal' && !accessToken ? (
              <div className="flex-grow-1 d-flex flex-column align-items-center justify-content-center p-5 text-center">
                <div className="bg-secondary bg-opacity-25 p-4 rounded-circle mb-4">
                  <User size={64} className="text-info" />
                </div>
                <h3 className="fw-bold mb-3">
                  {isPt ? 'Acesse suas imagens pessoais' : 'Access your personal images'}
                </h3>
                <p className="text-white-50 mb-4 max-w-sm mx-auto">
                  {isPt 
                    ? 'Conecte sua conta do Google para visualizar seus arquivos do Drive.' 
                    : 'Connect your Google account to view your Drive files.'}
                </p>
                <button 
                  className="btn btn-info btn-lg px-4 d-flex align-items-center gap-2"
                  onClick={handleConnect}
                  disabled={isLoading}
                >
                  {isLoading ? <Loader2 className="animate-spin" /> : <LogIn size={20} />}
                  {isPt ? 'Conectar Google Account' : 'Connect Google Account'}
                </button>
              </div>
            ) : (
              <>
                <div className="p-3 border-bottom border-secondary bg-surface bg-opacity-50">
                  <div className="position-relative">
                    <Search className="position-absolute top-50 start-0 translate-middle-y ms-3 text-secondary" size={18} />
                    <input 
                      type="text" 
                      className="form-control bg-dark border-secondary text-white ps-5"
                      placeholder={isPt ? 'Pesquisar nas suas imagens...' : 'Search your images...'}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                </div>

                <div className="flex-grow-1 overflow-auto p-3" style={{ maxHeight: '50vh' }}>
                  {isLoading ? (
                    <div className="d-flex flex-column align-items-center justify-content-center py-5">
                      <Loader2 className="animate-spin text-info mb-3" size={48} />
                      <p className="text-white-50">{isPt ? 'Carregando arquivos...' : 'Loading files...'}</p>
                    </div>
                  ) : error ? (
                    <div className="alert alert-danger d-flex align-items-center gap-2">
                      <AlertTriangle size={20} />
                      {error}
                      <button className="btn btn-sm btn-outline-danger ms-auto" onClick={() => loadFiles(viewMode, accessToken || undefined)}>
                        <RefreshCw size={14} />
                      </button>
                    </div>
                  ) : filteredFiles.length === 0 ? (
                    <div className="text-center py-5 opacity-50">
                      <ImageIcon size={48} className="mb-3 mx-auto" />
                      <h5>{isPt ? 'Nenhuma imagem encontrada.' : 'No images found.'}</h5>
                    </div>
                  ) : (
                    <div className="row row-cols-2 row-cols-md-3 row-cols-lg-4 g-3">
                      {filteredFiles.map((file) => (
                        <motion.div 
                          key={file.id}
                          layout
                          whileHover={{ scale: 1.02 }}
                          className="col"
                        >
                          <div className="card bg-dark border-secondary h-100 overflow-hidden">
                            <div className="position-relative aspect-ratio-square overflow-hidden bg-black d-flex align-items-center justify-content-center" style={{ height: '140px' }}>
                              {file.thumbnailLink ? (
                                <img 
                                  src={file.thumbnailLink.replace('=s220', '=s400')} 
                                  alt={file.name}
                                  className="w-100 h-100 object-fit-cover"
                                  referrerPolicy="no-referrer"
                                />
                              ) : (
                                <ImageIcon size={40} className="text-secondary opacity-30" />
                              )}
                              <div className="position-absolute top-0 end-0 p-2">
                                <a 
                                  href={file.webViewLink} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="btn btn-sm btn-dark bg-opacity-70 p-1 rounded-circle"
                                >
                                  <ExternalLink size={14} />
                                </a>
                              </div>
                            </div>
                            <div className="card-body p-2 bg-surface">
                              <p className="card-text small text-truncate m-0" title={file.name}>
                                {file.name}
                              </p>
                              <div className="d-flex align-items-center gap-1 mt-1">
                                <img src={file.iconLink} alt="" width="12" height="12" />
                                <span className="xsmall text-white-50">
                                  {viewMode === 'shared' ? 'Shared Drive' : 'Google Drive'}
                                </span>
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          <div className="modal-footer border-top border-secondary p-3">
            <div className="me-auto text-white-50 small">
              {viewMode === 'personal' && accessToken && (
                <div className="d-flex align-items-center gap-2">
                  <div className="bg-success rounded-circle" style={{ width: 8, height: 8 }}></div>
                  {isPt ? 'Conectado (Pessoal)' : 'Connected (Personal)'}
                </div>
              )}
              {viewMode === 'shared' && (
                <div className="d-flex align-items-center gap-2">
                  <div className="bg-info rounded-circle" style={{ width: 8, height: 8 }}></div>
                  {isPt ? 'Conectado via Service Account' : 'Connected via Service Account'}
                </div>
              )}
            </div>
            <button type="button" className="btn btn-secondary px-4" onClick={onClose}>
              {isPt ? 'Fechar' : 'Close'}
            </button>
            {(viewMode === 'shared' || accessToken) && (
              <button className="btn btn-outline-info" onClick={() => loadFiles(viewMode, accessToken || undefined)}>
                <RefreshCw size={16} />
              </button>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
};
