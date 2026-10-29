
import React, { useRef, useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { 
  Play, Pause, Volume2, VolumeX, Maximize, Minimize, 
  X, AlertCircle, Loader2, RotateCcw, RotateCw, Captions, Radio
} from 'lucide-react';
import { resolveArchiveVideoUrl } from '../services/archiveService';
import { savePlaybackProgress } from '../services/supabaseClient';
import { WatchPartyChat } from './WatchPartyChat';
import { P2PManager } from '../services/p2pService';
import { getCurrentUser } from '../services/bd';

interface VideoPlayerProps {
  src: string;
  poster: string;
  title: string;
  id: string; // Keep ID for compatibility/logging
  wikidataId?: string; // New prop for user interaction tracking
  initialTime?: number;
  subtitleUrl?: string; // New Prop
  onClose?: () => void;
  isUserLoggedIn?: boolean;
  p2pStream?: MediaStream; // New prop for P2P streaming
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({ 
  src, poster, title, id, wikidataId, initialTime = 0, subtitleUrl, onClose, isUserLoggedIn, p2pStream
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const p2pManagerRef = useRef<P2PManager | null>(null);

  const [resolvedSrc, setResolvedSrc] = useState<string | null>(null);
  const [isResolving, setIsResolving] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isNative, setIsNative] = useState(true);

  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(initialTime);
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [internalP2PStream, setInternalP2PStream] = useState<MediaStream | null>(null);

  // Handle P2P Stream (Peer mode)
  useEffect(() => {
    const initP2P = async () => {
      if (src.startsWith('p2p:') && isUserLoggedIn && !p2pStream) {
        const roomId = src.split(':')[1];
        const user = await getCurrentUser();
        const userId = user?.id || `peer-${Math.random().toString(36).substr(2, 9)}`;
        
        const manager = new P2PManager(roomId, userId);
        p2pManagerRef.current = manager;
        
        setIsResolving(true);
        manager.joinRoom((stream) => {
          setInternalP2PStream(stream);
          setIsResolving(false);
          setIsNative(true);
          setResolvedSrc('p2p-stream');
        });
      }
    };

    initP2P();

    return () => {
      p2pManagerRef.current?.destroy();
    };
  }, [src, isUserLoggedIn, p2pStream]);

  // Apply Stream to Video Element
  useEffect(() => {
    const stream = p2pStream || internalP2PStream;
    if (stream && videoRef.current) {
      videoRef.current.srcObject = stream;
      setIsResolving(false);
      setIsNative(true);
      setResolvedSrc('p2p-stream');
    }
  }, [p2pStream, internalP2PStream]);

  const getEmbedUrl = (url: string): { url: string; isNative: boolean } => {
    if (!url) return { url: '', isNative: true };
    
    // YouTube Robust ID Extraction
    const ytRegex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i;
    const ytMatch = url.match(ytRegex);
    if (ytMatch && ytMatch[1]) {
        const videoId = ytMatch[1];
        // Solving Error 153 using recommended embed params
        const origin = window.location.origin;
        return { 
          url: `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&enablejsapi=1&origin=${encodeURIComponent(origin)}&modestbranding=1&widget_referrer=${encodeURIComponent(origin)}`, 
          isNative: false 
        };
    }

    // Vimeo
    const vimeoMatch = url.match(/vimeo\.com\/(\d+)/i);
    if (vimeoMatch && vimeoMatch[1]) {
        return { url: `https://player.vimeo.com/video/${vimeoMatch[1]}?autoplay=1`, isNative: false };
    }

    // Archive.org Embed
    if (url.includes('archive.org') && !url.match(/\.(mp4|webm|ogg|m4v)$/i)) {
        let archId = '';
        if (url.includes('details/')) archId = url.split('details/')[1].split('/')[0];
        else if (url.includes('download/')) archId = url.split('download/')[1].split('/')[0];
        if (archId) return { url: `https://archive.org/embed/${archId}?autoplay=1`, isNative: false };
    }

    // Wikimedia Commons
    if (url.includes('commons.wikimedia.org')) {
        // If it's a File: page, convert to Special:FilePath for direct streaming
        if (url.includes('/wiki/File:')) {
            let fileName = url.split('/wiki/File:')[1].split('#')[0].split('?')[0];
            // Ensure filename is properly encoded but handle already encoded ones
            try {
                const decoded = decodeURIComponent(fileName);
                fileName = encodeURIComponent(decoded).replace(/%20/g, '_'); // Wikimedia prefers underscores
            } catch (e) {
                // Keep as is if decoding fails
            }
            return { 
                url: `https://commons.wikimedia.org/wiki/Special:FilePath/${fileName}`, 
                isNative: true 
            };
        }
        return { url, isNative: true };
    }

    return { url, isNative: true };
  };

  useEffect(() => {
    const resolveUrl = async () => {
      setIsResolving(true);
      setError(null);
      try {
        let finalUrl = src;
        let native = true;

        if (src.includes('archive.org')) {
            const archiveMp4 = await resolveArchiveVideoUrl(src);
            if (archiveMp4 && archiveMp4.match(/\.(mp4|webm|ogg|m4v)$/i)) {
                finalUrl = archiveMp4;
                native = true;
            } else {
                const embed = getEmbedUrl(src);
                finalUrl = embed.url;
                native = embed.isNative;
            }
        } else if (src.includes('commons.wikimedia.org')) {
            const embed = getEmbedUrl(src);
            finalUrl = embed.url;
            native = true; // Commons is always native via Special:FilePath
        } else {
            const embed = getEmbedUrl(src);
            finalUrl = embed.url;
            native = embed.isNative;
        }

        setResolvedSrc(finalUrl);
        setIsNative(native);
      } catch (err) {
        setError("Erro ao processar fonte do vídeo.");
      } finally {
        setIsResolving(false);
      }
    };
    resolveUrl();
  }, [src]);

  const togglePlay = useCallback(() => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play().catch(() => {});
      setIsPlaying(true);
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  }, []);

  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    const current = videoRef.current.currentTime;
    const dur = videoRef.current.duration;
    setCurrentTime(current);
    if (dur > 0) setProgress((current / dur) * 100);
    
    // Use wikidataId if available, fallback to id, but saving logic depends on DB expecting wikidataid
    const targetId = wikidataId || id;
    if (Math.floor(current) % 15 === 0) savePlaybackProgress(targetId, current);
  };

  const renderContent = () => (
    <div 
        ref={containerRef}
        className="modal-content bg-black border-secondary shadow-lg overflow-hidden position-relative w-100 d-flex flex-row"
        style={{ height: '85vh', minHeight: '500px' }}
        onMouseMove={() => { setShowControls(true); if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current); controlsTimeoutRef.current = setTimeout(() => isPlaying && setShowControls(false), 3000); }}
    >
      <div className="flex-grow-1 position-relative bg-black d-flex align-items-center justify-center">
        {resolvedSrc && isNative ? (
          <div className="w-100 h-100 position-relative d-flex align-items-center justify-content-center">
            <video 
                ref={videoRef} 
                src={resolvedSrc} 
                className="w-100 h-100 bg-black" 
                autoPlay 
                playsInline
                controls
                onTimeUpdate={handleTimeUpdate} 
                onLoadedMetadata={() => { if(videoRef.current) { videoRef.current.currentTime = initialTime; } }}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onClick={togglePlay}
                onError={() => {
                    console.error("Video Error: Failed to load video correctly.");
                    setError("Erro ao carregar o vídeo. Verifique se o formato é suportado pelo seu navegador.");
                }}
                crossOrigin="anonymous"
            >
                {subtitleUrl && (
                    <track 
                        label="Subtitles" 
                        kind="subtitles" 
                        src={subtitleUrl} 
                        default 
                    />
                )}
            </video>
            
            {!isPlaying && !isResolving && !error && (
              <div 
                className="position-absolute top-50 start-50 translate-middle p-4 rounded-circle bg-danger bg-opacity-75 text-white shadow-lg cursor-pointer hover-scale"
                onClick={togglePlay}
                style={{ zIndex: 5 }}
              >
                <Play size={48} fill="currentColor" />
              </div>
            )}
          </div>
        ) : resolvedSrc ? (
          <iframe 
              src={resolvedSrc} 
              className="w-100 h-100 border-0" 
              allow="autoplay; encrypted-media; fullscreen; picture-in-picture" 
              allowFullScreen
          ></iframe>
        ) : null}

        {isResolving && (
          <div className="position-absolute top-50 start-50 translate-middle"> <Loader2 className="animate-spin text-danger" size={48} /> </div>
        )}

        {error && (
          <div className="position-absolute top-50 start-50 translate-middle text-center">
            <AlertCircle className="text-danger mb-2 mx-auto" size={48} />
            <p className="text-white">{error}</p>
          </div>
        )}

        <div className={`position-absolute top-0 start-0 w-100 p-3 d-flex justify-content-between align-items-center transition-opacity ${showControls ? 'opacity-100' : 'opacity-0'}`} style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.8), transparent)', zIndex: 10 }}>
          <div className="d-flex align-items-center gap-2">
              <h6 className="m-0 text-white fw-bold text-shadow">{title}</h6>
              {subtitleUrl && <div className="badge bg-danger d-flex align-items-center gap-1" title="Has Subtitles"><Captions size={12}/> CC</div>}
          </div>
          <button onClick={onClose} className="btn btn-icon text-white p-2"> <X size={32} /> </button>
        </div>
      </div>

      {/* Chat do Cine-Clube - Somente para usuários registrados */}
      {isUserLoggedIn && (
        <div className="d-none d-lg-block">
          <WatchPartyChat roomId={wikidataId || id} />
        </div>
      )}
    </div>
  );

  return createPortal(
      <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.95)', zIndex: 1070 }}>
         <div className="modal-dialog modal-xl modal-dialog-centered"> {renderContent()} </div>
      </div>,
      document.body
  );
};
