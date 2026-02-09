import React, { useRef, useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { 
  Play, Pause, Volume2, VolumeX, Maximize, Minimize, 
  X, AlertCircle, Loader2, RotateCcw, RotateCw
} from 'lucide-react';
import { resolveArchiveVideoUrl } from '../services/archiveService';
import { savePlaybackProgress } from '../services/supabaseClient';

interface VideoPlayerProps {
  src: string;
  poster: string;
  title: string;
  id: string;
  initialTime?: number;
  onClose?: () => void;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({ 
  src, poster, title, id, initialTime = 0, onClose 
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const getEmbedUrl = (url: string): { url: string; isNative: boolean } => {
    if (!url) return { url: '', isNative: true };
    
    // YouTube Robust Extraction
    const ytRegex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i;
    const ytMatch = url.match(ytRegex);
    if (ytMatch && ytMatch[1]) {
        const videoId = ytMatch[1];
        // Solving Error 153 by providing context and clean URL
        const origin = window.location.origin;
        return { 
          url: `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&enablejsapi=1&origin=${encodeURIComponent(origin)}&modestbranding=1`, 
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
    if (Math.floor(current) % 15 === 0) savePlaybackProgress(id, current);
  };

  const renderContent = () => (
    <div 
        ref={containerRef}
        className="modal-content bg-black border-secondary shadow-lg overflow-hidden position-relative w-100"
        style={{ height: '85vh', minHeight: '500px' }}
        onMouseMove={() => { setShowControls(true); if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current); controlsTimeoutRef.current = setTimeout(() => isPlaying && setShowControls(false), 3000); }}
    >
      {resolvedSrc && isNative ? (
        <video 
            ref={videoRef} src={resolvedSrc} 
            className="w-100 h-100 bg-black" 
            autoPlay onTimeUpdate={handleTimeUpdate} 
            onLoadedMetadata={() => { if(videoRef.current) { videoRef.current.currentTime = initialTime; } }}
            onClick={togglePlay}
            crossOrigin="anonymous"
        />
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
        <h6 className="m-0 text-white fw-bold text-shadow">{title}</h6>
        <button onClick={onClose} className="btn btn-icon text-white p-2"> <X size={32} /> </button>
      </div>
    </div>
  );

  return createPortal(
      <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.95)', zIndex: 1070 }}>
         <div className="modal-dialog modal-xl modal-dialog-centered"> {renderContent()} </div>
      </div>,
      document.body
  );
};