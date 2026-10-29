
import React, { useState, useRef, useEffect } from 'react';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
import { 
  X, Upload, FileVideo, CheckCircle, AlertCircle, 
  Loader2, Download, RefreshCw, Layers, ArrowRight, 
  Monitor, Server, Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { AppLanguage } from '../types';
import { APP_TRANSLATIONS } from '../constants';

interface VideoConverterProps {
  isOpen: boolean;
  onClose: () => void;
  language: AppLanguage;
}

const VIDEO_FORMATS = ["mp4", "webm", "mkv", "avi", "mov", "flv"];
const CLIENT_SIDE_LIMIT = 50 * 1024 * 1024; // 50MB

export const VideoConverter: React.FC<VideoConverterProps> = ({ isOpen, onClose, language }) => {
  const t = APP_TRANSLATIONS[language] || APP_TRANSLATIONS['en'];
  
  const [file, setFile] = useState<File | null>(null);
  const [inputFormat, setInputFormat] = useState<string>("");
  const [outputFormat, setOutputFormat] = useState<string>("mp4");
  const [status, setStatus] = useState<'idle' | 'loading' | 'converting' | 'success' | 'error'>('idle');
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState("");
  const [downloadUrl, setDownloadUrl] = useState("");
  const [mode, setMode] = useState<'client' | 'server' | null>(null);
  const [isSABAvailable] = useState(typeof window.SharedArrayBuffer !== 'undefined');
  
  const ffmpegRef = useRef(new FFmpeg());
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (file) {
      const ext = file.name.split('.').pop()?.toLowerCase() || "";
      setInputFormat(ext);
      
      // Se SharedArrayBuffer não estiver disponível, forçamos o modo servidor
      if (!isSABAvailable || file.size > CLIENT_SIDE_LIMIT) {
        setMode('server');
      } else {
        setMode('client');
      }
    } else {
      setMode(null);
    }
  }, [file, isSABAvailable]);

  const loadFFmpeg = async () => {
    const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';
    const ffmpeg = ffmpegRef.current;
    
    if (ffmpeg.loaded) return;

    ffmpeg.on('log', ({ message }) => {
      console.log("[FFmpeg Log]", message);
    });
    
    ffmpeg.on('progress', ({ progress }) => {
      setProgress(Math.round(progress * 100));
    });

    try {
      await ffmpeg.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
      });
    } catch (err) {
      console.error("Failed to load FFmpeg:", err);
      throw new Error("Não foi possível carregar o motor de conversão no navegador. Isso pode acontecer se o seu navegador não suportar SharedArrayBuffer ou se as configurações de segurança bloquearem o carregamento.");
    }
  };

  const convertClientSide = async () => {
    if (!file) return;
    setStatus('loading');
    setMessage("Carregando motor de conversão...");
    
    try {
      await loadFFmpeg();
      const ffmpeg = ffmpegRef.current;
      
      setStatus('converting');
      setMessage("Convertendo vídeo no seu navegador...");
      
      const inputName = 'input.' + inputFormat;
      const outputName = 'output.' + outputFormat;
      
      await ffmpeg.writeFile(inputName, await fetchFile(file));
      await ffmpeg.exec(['-i', inputName, outputName]);
      
      const data = await ffmpeg.readFile(outputName);
      const url = URL.createObjectURL(new Blob([(data as any).buffer], { type: `video/${outputFormat}` }));
      
      setDownloadUrl(url);
      setStatus('success');
      setMessage("Conversão concluída com sucesso!");
    } catch (err) {
      console.error("Client-side conversion error:", err);
      setStatus('error');
      setMessage(err instanceof Error ? err.message : "Erro na conversão client-side. Tente usar o modo servidor.");
    }
  };

  const convertServerSide = async () => {
    if (!file) return;
    setStatus('converting');
    setMessage("Enviando arquivo para o servidor...");
    
    const formData = new FormData();
    formData.append('video', file);
    formData.append('format', outputFormat);
    
    try {
      const response = await fetch('/api/convert', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) throw new Error("Server conversion failed");
      
      const result = await response.json();
      setDownloadUrl(result.downloadUrl);
      setStatus('success');
      setMessage("Conversão concluída no servidor!");
    } catch (err) {
      console.error(err);
      setStatus('error');
      setMessage("Erro na conversão server-side. Verifique se o backend está configurado corretamente.");
    }
  };

  const handleConvert = () => {
    if (mode === 'client') {
      convertClientSide();
    } else {
      convertServerSide();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setStatus('idle');
      setProgress(0);
      setDownloadUrl("");
    }
  };

  const reset = () => {
    setFile(null);
    setStatus('idle');
    setProgress(0);
    setDownloadUrl("");
    setMessage("");
  };

  if (!isOpen) return null;

  return (
    <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 1060, backdropFilter: 'blur(10px)' }}>
      <div className="modal-dialog modal-lg modal-dialog-centered">
        <motion.div 
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          className="modal-content bg-dark border-secondary shadow-2xl overflow-hidden"
        >
          <div className="modal-header border-secondary bg-black bg-opacity-50 py-3">
            <h5 className="modal-title text-white d-flex align-items-center gap-2">
              <Layers className="text-danger" size={20} />
              Conversor de Vídeo Online
            </h5>
            <button type="button" className="btn-close btn-close-white" onClick={onClose}></button>
          </div>

          <div className="modal-body p-4 p-lg-5">
            {!file ? (
              <div 
                className="border-2 border-dashed border-secondary rounded-xl p-5 text-center hover-border-danger transition-all cursor-pointer bg-black bg-opacity-20"
                onClick={() => fileInputRef.current?.click()}
              >
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  className="d-none" 
                  accept="video/*" 
                  onChange={handleFileChange} 
                />
                <div className="bg-danger bg-opacity-10 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Upload className="text-danger" size={32} />
                </div>
                <h4 className="text-white mb-2">Selecione um vídeo para converter</h4>
                <p className="text-white-50 small">Arraste e solte ou clique para navegar</p>
                <div className="mt-4 d-flex justify-content-center gap-2 flex-wrap">
                  {VIDEO_FORMATS.map(f => (
                    <span key={f} className="badge bg-secondary opacity-50 text-uppercase">{f}</span>
                  ))}
                </div>
              </div>
            ) : (
              <div className="animate-in">
                <div className="bg-black bg-opacity-40 p-4 rounded-xl border border-secondary mb-4">
                  <div className="d-flex align-items-center gap-3">
                    <div className="bg-danger bg-opacity-20 p-3 rounded-lg">
                      <FileVideo className="text-danger" size={24} />
                    </div>
                    <div className="flex-grow-1 overflow-hidden">
                      <h6 className="text-white mb-1 text-truncate">{file.name}</h6>
                      <p className="text-white-50 xsmall mb-0">
                        {(file.size / (1024 * 1024)).toFixed(2)} MB • Formato: <span className="text-uppercase">{inputFormat}</span>
                      </p>
                    </div>
                    <button className="btn btn-sm btn-outline-secondary rounded-circle" onClick={reset}>
                      <X size={16} />
                    </button>
                  </div>
                </div>

                <div className="row g-4 mb-4">
                  <div className="col-md-6">
                    <label className="form-label text-white-50 small uppercase fw-bold tracking-wider">Formato de Saída</label>
                    <select 
                      className="form-select bg-black text-white border-secondary shadow-none"
                      value={outputFormat}
                      onChange={(e) => setOutputFormat(e.target.value)}
                      disabled={status !== 'idle'}
                    >
                      {VIDEO_FORMATS.map(f => (
                        <option key={f} value={f}>{f.toUpperCase()}</option>
                      ))}
                    </select>
                  </div>
                  <div className="col-md-6">
                    <label className="form-label text-white-50 small uppercase fw-bold tracking-wider">Modo de Conversão</label>
                    <div className={`d-flex align-items-center gap-2 p-2 rounded border ${mode === 'client' ? 'border-success bg-success bg-opacity-10' : 'border-warning bg-warning bg-opacity-10'}`}>
                      {mode === 'client' ? (
                        <>
                          <Monitor size={18} className="text-success" />
                          <span className="text-success small fw-bold">Navegador (Rápido/Privado)</span>
                        </>
                      ) : (
                        <>
                          <Server size={18} className="text-warning" />
                          <span className="text-warning small fw-bold">
                            {file.size > CLIENT_SIDE_LIMIT ? "Servidor (Arquivos Grandes)" : "Servidor (Compatibilidade)"}
                          </span>
                        </>
                      )}
                    </div>
                    {!isSABAvailable && file.size <= CLIENT_SIDE_LIMIT && (
                      <p className="text-warning xsmall mt-1 mb-0">
                        <Info size={12} className="me-1" />
                        Seu navegador atual não suporta conversão local. Usando o servidor para garantir o funcionamento.
                      </p>
                    )}
                  </div>
                </div>

                {status === 'idle' && (
                  <button 
                    className="btn btn-danger w-100 py-3 fw-bold d-flex align-items-center justify-content-center gap-2 shadow-lg"
                    onClick={handleConvert}
                  >
                    <RefreshCw size={20} />
                    Converter para {outputFormat.toUpperCase()}
                  </button>
                )}

                {(status === 'loading' || status === 'converting') && (
                  <div className="text-center py-4">
                    <Loader2 className="animate-spin text-danger mx-auto mb-3" size={40} />
                    <h6 className="text-white mb-2">{message}</h6>
                    {mode === 'client' && (
                      <div className="w-100 bg-secondary bg-opacity-20 rounded-full h-2 mt-4 overflow-hidden">
                        <motion.div 
                          className="bg-danger h-100"
                          initial={{ width: 0 }}
                          animate={{ width: `${progress}%` }}
                        />
                      </div>
                    )}
                    {mode === 'client' && <p className="text-white-50 xsmall mt-2">{progress}% concluído</p>}
                  </div>
                )}

                {status === 'success' && (
                  <div className="text-center py-4 animate-in">
                    <div className="bg-success bg-opacity-10 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                      <CheckCircle className="text-success" size={32} />
                    </div>
                    <h5 className="text-white mb-3">{message}</h5>
                    <div className="d-flex gap-2">
                      <button className="btn btn-outline-secondary flex-grow-1" onClick={reset}>Nova Conversão</button>
                      <a 
                        href={downloadUrl} 
                        download={`classicflix_converted.${outputFormat}`}
                        className="btn btn-success flex-grow-1 d-flex align-items-center justify-content-center gap-2"
                      >
                        <Download size={18} /> Baixar Vídeo
                      </a>
                    </div>
                  </div>
                )}

                {status === 'error' && (
                  <div className="text-center py-4 animate-in">
                    <div className="bg-danger bg-opacity-10 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                      <AlertCircle className="text-danger" size={32} />
                    </div>
                    <h5 className="text-white mb-2">Ops! Algo deu errado</h5>
                    <p className="text-white-50 small mb-4">{message}</p>
                    <div className="d-flex flex-column gap-2">
                      <button className="btn btn-danger w-100" onClick={() => setStatus('idle')}>Tentar Novamente</button>
                      {mode === 'client' && (
                        <button 
                          className="btn btn-outline-warning w-100" 
                          onClick={() => {
                            setMode('server');
                            setStatus('idle');
                          }}
                        >
                          Tentar via Servidor (Mais Lento, mas mais compatível)
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="modal-footer border-secondary bg-black bg-opacity-30 justify-content-start p-3">
            <div className="d-flex align-items-center gap-2 text-white-50 xsmall">
              <Info size={14} />
              <span>Arquivos menores que 50MB são processados localmente no seu navegador.</span>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};
