import React, { useRef, useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { 
  Play, Pause, Volume2, VolumeX, Maximize, Minimize, 
  X, Settings, AlertCircle, Loader2, RotateCcw, RotateCw, 
  PictureInPicture2, MessageSquare, Sparkles, Subtitles 
} from 'lucide-react';
import { resolveWikimediaDirectUrl } from '../services/wikidataService';
import { resolveArchiveVideoUrl } from '../services/archiveService';
import { generateAISubtitles } from '../services/geminiService';
import { savePlaybackProgress } from '../services/supabaseClient';

interface VideoPlayerProps {
  src: string;
  poster: string;
  title: string;
  id: string;
  description?: string;
  initialTime?: number;
  onClose?: () => void;
}

type VideoType = 'youtube' | 'vimeo' | 'archive' | 'html5' | 'unknown';
type SubtitleMode = 'off' | 'en' | 'pt' | 'ai_gen';

export const VideoPlayer: React.FC<VideoPlayerProps> = ({ 
  src, poster, title, id, description = "", initialTime = 0, onClose 
}) => {
  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // State: Video & Source
  const [resolvedSrc, setResolvedSrc] = useState<string | null>(null);
  const [isResolving, setIsResolving] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isNative, setIsNative] = useState(true); // Determines if we use <video> or <iframe>

  // State: Playback
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0); // 0 to 100
  const [currentTime, setCurrentTime] = useState(initialTime);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);

  // State: UI
  const [showControls, setShowControls] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showSubtitleMenu, setShowSubtitleMenu] = useState(false);

  // State: Subtitles & AI
  const [subtitleMode, setSubtitleMode] = useState<SubtitleMode>('off');
  const [aiSubtitleUrl, setAiSubtitleUrl] = useState<string | null>(null);
  const [isGeneratingSubtitles, setIsGeneratingSubtitles] = useState(false);

  // --- 1. Logic: Video & Source Detection ---

  const detectVideoType = (url: string): VideoType => {
    if (!url) return 'unknown';
    if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube';
    if (url.includes('vimeo.com')) return 'vimeo';
    if (url.includes('archive.org')) return 'archive';
    return 'html5';
  };

  const getEmbedUrl = (type: VideoType, url: string): string => {
      if (type === 'youtube') {
          let videoId = '';
          if (url.includes('youtu.be/')) videoId = url.split('youtu.be/')[1].split('?')[0];
          else if (url.includes('v=')) videoId = url.split('v=')[1].split('&')[0];
          else if (url.includes('/embed/')) videoId = url.split('/embed/')[1].split('?')[0];
          
          return videoId ? `https://www.youtube.com/embed/${videoId}?autoplay=1` : url;
      }
      if (type === 'vimeo') {
          const parts = url.split('/');
          const id = parts[parts.length - 1];
          return `https://player.vimeo.com/video/${id}?autoplay=1`;
      }
      return url;
  };

  useEffect(() => {
    const resolveUrl = async () => {
      setIsResolving(true);
      setError(null);
      
      const type = detectVideoType(src);

      try {
        let finalUrl = src;
        let shouldUseNative = true;

        if (type === 'archive') {
          // Attempt to get direct MP4
          const mp4Url = await resolveArchiveVideoUrl(src);
          
          // Check if resolved URL is different (success) AND looks like a video file
          // This prevents <video> from trying to play an HTML page
          if (mp4Url && mp4Url !== src && mp4Url.match(/\.(mp4|m4v|webm|ogg)$/i)) {
              finalUrl = mp4Url;
              shouldUseNative = true;
          } else {
              // Fallback to Archive.org Embed Player
              let id = '';
              if (src.includes('details/')) id = src.split('details/')[1].split('/')[0];
              else if (src.includes('download/')) id = src.split('download/')[1].split('/')[0];
              
              if (id) {
                  finalUrl = `https://archive.org/embed/${id}?autoplay=1`;
                  shouldUseNative = false;
              } else {
                  // Fallback: If we can't extract ID, just iframe the original URL
                  shouldUseNative = false; 
              }
          }
        } else if (src.includes('wikimedia') || src.includes('upload.wikimedia.org')) {
          finalUrl = await resolveWikimediaDirectUrl(src);
          shouldUseNative = true;
        } else if (type === 'youtube' || type === 'vimeo') {
          finalUrl = getEmbedUrl(type, src);
          shouldUseNative = false;
        } else {
           // Unknown or HTML5
           // Strict check: if it doesn't look like a video file, use iframe
           if (src.match(/\.(mp4|webm|ogg|mov|m4v)$/i)) {
               shouldUseNative = true;
           } else {
               shouldUseNative = false;
           }
        }
        
        if (!finalUrl) throw new Error("Could not resolve video URL");
        
        setResolvedSrc(finalUrl);
        setIsNative(shouldUseNative);

      } catch (err) {
        console.error("Video Resolution Error:", err);
        setError("Unable to load video source.");
      } finally {
        setIsResolving(false);
      }
    };

    resolveUrl();
  }, [src]);

  // --- 2. Logic: Playback Controls ---

  const togglePlay = useCallback(() => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play().catch(e => {
          console.error("Play failed:", e);
      });
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

    if (Math.floor(current) % 10 === 0 && Math.floor(current) > 0) {
       savePlaybackProgress(id, current);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!videoRef.current) return;
    const seekTime = (parseFloat(e.target.value) / 100) * videoRef.current.duration;
    videoRef.current.currentTime = seekTime;
    setProgress(parseFloat(e.target.value));
  };

  const skip = (seconds: number) => {
    if (!videoRef.current) return;
    videoRef.current.currentTime += seconds;
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    videoRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const togglePiP = async () => {
    if (!videoRef.current) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else {
        await videoRef.current.requestPictureInPicture();
      }
    } catch (err) {
      console.error("PiP failed:", err);
    }
  };

  // --- 3. Logic: Subtitles & AI ---

  const handleGenerateAISubtitles = async () => {
    if (isGeneratingSubtitles || !title) return;
    
    setIsGeneratingSubtitles(true);
    setSubtitleMode('ai_gen'); 

    try {
      const vttContent = await generateAISubtitles(title, 'Portuguese', description || 'Plot unknown');
      const blob = new Blob([vttContent], { type: 'text/vtt' });
      const url = URL.createObjectURL(blob);
      setAiSubtitleUrl(url);
      
    } catch (err) {
      console.error("AI Subtitle Error:", err);
      alert("Failed to generate AI subtitles.");
      setSubtitleMode('off');
    } finally {
      setIsGeneratingSubtitles(false);
      setShowSubtitleMenu(false);
    }
  };

  // --- 4. Logic: UX & Interactivity ---

  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying) setShowControls(false);
    }, 3000);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle shortcuts for native video
      if (!isNative) {
          if (e.key === 'Escape' && onClose) onClose();
          return;
      }

      switch(e.key) {
        case ' ':
          e.preventDefault();
          togglePlay();
          break;
        case 'Escape':
          if (isFullscreen) toggleFullscreen();
          else if (onClose) onClose();
          break;
        case 'ArrowLeft':
          skip(-10);
          break;
        case 'ArrowRight':
          skip(10);
          break;
        case 'f':
        case 'F':
          toggleFullscreen();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
      if (aiSubtitleUrl) URL.revokeObjectURL(aiSubtitleUrl);
    };
  }, [togglePlay, isFullscreen, onClose, aiSubtitleUrl, isNative]);

  const onLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
      if (initialTime > 0) videoRef.current.currentTime = initialTime;
    }
  };

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  // --- 5. Render ---

  const renderPlayerContent = () => (
    <div 
        ref={containerRef}
        className="modal-content bg-black border-secondary shadow-lg overflow-hidden position-relative w-100 h-100"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => isPlaying && setShowControls(false)}
        style={{ minHeight: '60vh', maxHeight: '90vh' }}
    >
      {/* Video Element (Native) */}
      {resolvedSrc && isNative && (
        <video
          ref={videoRef}
          src={resolvedSrc}
          className="w-100 h-100 object-fit-contain bg-black"
          onClick={togglePlay}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={onLoadedMetadata}
          onWaiting={() => setIsBuffering(true)}
          onPlaying={() => setIsBuffering(false)}
          autoPlay
          crossOrigin="anonymous"
          style={{ maxHeight: '85vh' }}
        >
          {aiSubtitleUrl && subtitleMode === 'ai_gen' && (
            <track label="AI Generated (PT)" kind="subtitles" srcLang="pt" src={aiSubtitleUrl} default />
          )}
        </video>
      )}

      {/* Iframe Element (YouTube/Vimeo/Archive Embed) */}
      {resolvedSrc && !isNative && (
         <iframe 
            src={resolvedSrc} 
            className="w-100 h-100 bg-black" 
            allow="autoplay; encrypted-media; fullscreen; picture-in-picture" 
            allowFullScreen
            style={{ border: 'none', minHeight: '60vh' }}
         ></iframe>
      )}

      {/* Loading / Error States */}
      {(isResolving || (isBuffering && isNative)) && (
        <div className="position-absolute top-50 start-50 translate-middle pointer-events-none">
          <Loader2 className="animate-spin text-white" size={64} />
        </div>
      )}
      
      {error && (
        <div className="position-absolute top-50 start-50 translate-middle text-center">
          <AlertCircle className="text-danger mb-2 mx-auto" size={48} />
          <p className="text-white">{error}</p>
          <button onClick={onClose} className="btn btn-outline-light btn-sm mt-2">Close</button>
        </div>
      )}

      {/* Top Bar (Always Visible on Hover) */}
      <div 
        className={`position-absolute top-0 start-0 w-100 p-4 d-flex justify-content-between align-items-center bg-gradient-to-b from-black to-transparent transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0'}`}
        style={{ transition: 'opacity 0.3s ease-in-out', background: 'linear-gradient(to bottom, rgba(0,0,0,0.8), transparent)', pointerEvents: showControls ? 'auto' : 'none' }}
      >
        <div>
          <h5 className="m-0 text-white fw-bold text-shadow">{title}</h5>
          {description && <p className="m-0 text-white-50 small d-none d-md-block text-truncate" style={{maxWidth: '400px'}}>{description}</p>}
        </div>
        <button onClick={onClose} className="btn btn-icon text-white hover-scale" style={{ zIndex: 100002 }}>
          <X size={28} />
        </button>
      </div>

      {/* Bottom Controls (Only for Native Video) */}
      {isNative && (
        <div 
            className={`position-absolute bottom-0 start-0 w-100 p-4 bg-gradient-to-t from-black to-transparent transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0'}`}
            style={{ transition: 'opacity 0.3s ease-in-out', background: 'linear-gradient(to top, rgba(0,0,0,0.9), transparent)', pointerEvents: showControls ? 'auto' : 'none' }}
        >
            <div className="d-flex align-items-center gap-3 mb-3">
            <span className="text-white small font-monospace">{formatTime(currentTime)}</span>
            <input
                type="range"
                min="0"
                max="100"
                value={progress}
                onChange={handleSeek}
                className="form-range flex-grow-1"
                style={{ cursor: 'pointer', height: '4px' }}
            />
            <span className="text-white small font-monospace">{formatTime(duration)}</span>
            </div>

            <div className="d-flex justify-content-between align-items-center">
            
            <div className="d-flex align-items-center gap-3">
                <button onClick={togglePlay} className="btn text-white p-0 hover-scale">
                {isPlaying ? <Pause size={28} fill="white" /> : <Play size={28} fill="white" />}
                </button>
                
                <button onClick={() => skip(-10)} className="btn text-white-50 p-0 hover-text-white" title="-10s">
                <RotateCcw size={20} />
                </button>
                <button onClick={() => skip(10)} className="btn text-white-50 p-0 hover-text-white" title="+10s">
                <RotateCw size={20} />
                </button>

                <div className="d-flex align-items-center gap-2 ms-2 group-volume">
                <button onClick={toggleMute} className="btn text-white p-0">
                    {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
                </button>
                <input 
                    type="range" 
                    min="0" 
                    max="1" 
                    step="0.1" 
                    value={isMuted ? 0 : volume}
                    onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    setVolume(val);
                    if (videoRef.current) videoRef.current.volume = val;
                    setIsMuted(val === 0);
                    }}
                    className="form-range d-none d-md-block"
                    style={{ width: '80px', height: '3px' }}
                />
                </div>
            </div>

            <div className="d-flex align-items-center gap-3 position-relative">
                <div className="position-relative">
                <button 
                    className={`btn p-0 ${subtitleMode !== 'off' ? 'text-primary-custom' : 'text-white'}`} 
                    onClick={() => setShowSubtitleMenu(!showSubtitleMenu)}
                    title="Subtitles / AI"
                >
                    {isGeneratingSubtitles ? <Loader2 className="animate-spin" size={20} /> : <MessageSquare size={20} />}
                </button>
                
                {showSubtitleMenu && (
                    <div className="position-absolute bottom-100 end-0 mb-3 bg-dark border border-secondary rounded shadow-lg overflow-hidden" style={{ width: '220px' }}>
                        <div className="p-2 border-bottom border-secondary small text-white-50 fw-bold">Subtitles</div>
                        <button className="dropdown-item text-white small px-3 py-2 d-flex align-items-center justify-content-between" onClick={() => setSubtitleMode('off')}>
                        Off {subtitleMode === 'off' && <Play size={10} fill="currentColor" />}
                        </button>
                        <button className="dropdown-item text-white small px-3 py-2 d-flex align-items-center justify-content-between" onClick={() => setSubtitleMode('en')}>
                        English
                        </button>
                        <button className="dropdown-item text-white small px-3 py-2 d-flex align-items-center justify-content-between" onClick={() => setSubtitleMode('pt')}>
                        Portuguese
                        </button>
                        
                        <div className="border-top border-secondary mt-1 pt-1">
                        <div className="p-2 small text-primary-custom fw-bold d-flex align-items-center gap-2">
                            <Sparkles size={12} /> AI Generate
                        </div>
                        <button 
                            className="dropdown-item text-white small px-3 py-2 d-flex align-items-center gap-2"
                            onClick={handleGenerateAISubtitles}
                            disabled={isGeneratingSubtitles}
                        >
                            {isGeneratingSubtitles ? 'Generating...' : 'Generate (Gemini)'}
                        </button>
                        </div>
                    </div>
                )}
                </div>

                <button onClick={togglePiP} className="btn text-white p-0 d-none d-md-block" title="Picture-in-Picture">
                <PictureInPicture2 size={20} />
                </button>
                
                <div className="vr bg-secondary mx-1" style={{height: '20px'}}></div>

                <button onClick={toggleFullscreen} className="btn text-white p-0 hover-scale">
                {isFullscreen ? <Minimize size={24} /> : <Maximize size={24} />}
                </button>
            </div>
            </div>
        </div>
      )}
    </div>
  );

  const renderModal = () => (
      <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.9)', zIndex: 1060 }} role="dialog">
         <div className="modal-dialog modal-xl modal-dialog-centered" style={{ maxWidth: '95vw' }}>
            {renderPlayerContent()}
         </div>
      </div>
  );

  return createPortal(renderModal(), document.body);
};