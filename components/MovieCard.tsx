
import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Heart, CheckCircle, MonitorPlay, ImageOff, Play } from 'lucide-react';
import { Movie, UserMovieInteraction } from '../types';
import { getTmdbByImdbId } from '../services/tmdbService';
import { getOmdbMovieDetails } from '../services/omdbService';
import { updateMoviePoster } from '../services/supabaseClient';

interface MovieCardProps {
    movie: Movie;
    state: UserMovieInteraction;
    onOpen: () => void;
    viewMode: 'image' | 'text';
    onPosterFound?: (id: string, url: string) => void;
}


export const SkeletonCard: React.FC = () => {
  return (
    <div className="col">
      <div 
        className="movie-card shadow-lg" 
        style={{ 
          backgroundColor: 'var(--md-surface-variant)',
          opacity: 0.6
        }}
      >
        {/* Shimmer effect */}
        <div className="w-100 h-100 position-relative overflow-hidden">
          <div 
            className="position-absolute top-0 start-0 w-100 h-100"
            style={{
              background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.05), transparent)',
              animation: 'shimmer 1.5s infinite',
              transform: 'translateX(-100%)'
            }}
          ></div>
        </div>
        
        <div className="movie-card-overlay p-3 d-flex flex-column justify-content-end" style={{ opacity: 1 }}>
          <div 
            className="rounded mb-2" 
            style={{ 
              height: '16px', 
              width: '80%', 
              backgroundColor: 'rgba(255,255,255,0.1)',
              animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite'
            }}
          ></div>
          <div className="d-flex justify-content-between align-items-center">
            <div 
              className="rounded" 
              style={{ 
                height: '12px', 
                width: '40%', 
                backgroundColor: 'rgba(255,255,255,0.1)',
                animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite'
              }}
            ></div>
            <div 
              className="rounded" 
              style={{ 
                height: '12px', 
                width: '20%', 
                backgroundColor: 'rgba(255,255,255,0.1)',
                animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite'
              }}
            ></div>
          </div>
        </div>
      </div>
      
      <style>{`
        @keyframes shimmer {
          100% { transform: translateX(100%); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: .5; }
        }
      `}</style>
    </div>
  );
};

export const MovieCard: React.FC<MovieCardProps> = ({ movie, state, onOpen, viewMode, onPosterFound }) => {
    const [imageSrc, setImageSrc] = useState<string>(movie.posterUrl);
    const [imageError, setImageError] = useState(false);

    // Effect to try and resolve a better image if the current one is missing or a placeholder
    useEffect(() => {
        let isMounted = true;

        const resolveImage = async () => {
            // Check if we need to resolve (missing URL or generic placeholder).
            // We treat Wikimedia Special:FilePath as VALID now.
            // We treat ui-avatars as a placeholder because we prefer a real movie poster if available.
            const isPlaceholder = !movie.posterUrl || 
                                  movie.posterUrl.includes('placehold.co') || 
                                  movie.posterUrl.includes('ui-avatars.com');
            
            // If we already have a good image, just set it and return
            if (!isPlaceholder) {
                if (movie.posterUrl !== imageSrc && isMounted) {
                    setImageSrc(movie.posterUrl);
                }
                return;
            }

            // --- STRATEGIES TO FIND IMAGE ---
            let foundUrl = '';

            if (movie.identifiers) {
                // Strategy 1: Archive.org Thumbnail (Fastest, valid for public domain)
                if (movie.identifiers.archiveId && !foundUrl) {
                    const archiveThumb = `https://archive.org/services/img/${movie.identifiers.archiveId}`;
                    // Simple check if it's a valid url format
                    foundUrl = archiveThumb;
                }

                // Strategy 2: TMDb via IMDb ID (High Quality)
                if (movie.identifiers.imdbId && !foundUrl) {
                    try {
                        const tmdbData = await getTmdbByImdbId(movie.identifiers.imdbId);
                        if (tmdbData && tmdbData.posterUrl) {
                            foundUrl = tmdbData.posterUrl;
                        }
                    } catch (e) { /* ignore */ }
                }

                // Strategy 3: OMDb API (Good fallback for classics using IMDb ID or OMDb ID)
                if ((movie.identifiers.omdbId || movie.identifiers.imdbId) && !foundUrl) {
                    const id = movie.identifiers.omdbId || movie.identifiers.imdbId;
                    try {
                        const omdbData = await getOmdbMovieDetails(id);
                        if (omdbData && omdbData.posterUrl && omdbData.posterUrl !== 'N/A') {
                            foundUrl = omdbData.posterUrl;
                        }
                    } catch (e) { /* ignore */ }
                }
                
                // Strategy 4: Open Library / Wikidata (Experimental/Generic)
                // Note: Open Library covers usually rely on ISBN, but we map strictly as requested
                if (movie.id && !foundUrl) {
                    // Try to construct a likely URL, or use a generic service
                    // Note: This is speculative as OpenLibrary is for books, but added per request
                    // foundUrl = `https://covers.openlibrary.org/b/id/${movie.id}-L.jpg`; 
                }
            }

            // --- APPLY & SAVE ---
            
            if (foundUrl) {
                if (isMounted) setImageSrc(foundUrl);
                // PERSISTENCE: Save this found URL back to Supabase so next time it loads instantly
                // We fire and forget this promise to not block the UI
                updateMoviePoster(movie.id, foundUrl);
                if (onPosterFound) {
                    onPosterFound(movie.id, foundUrl);
                }
                return;
            }
            
            // Strategy 5 (Fallback): UI Avatars Dynamic Image
            // If all APIs failed, generate a nice typographic card
            if (isPlaceholder && isMounted) {
                // Creates a dark card with red text (Netflix style palette)
                const fallbackUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(movie.title)}&background=1f1f1f&color=e50914&size=512&bold=true&length=2&font-size=0.33&uppercase=true`;
                setImageSrc(fallbackUrl);
            }
        };

        resolveImage();

        return () => { isMounted = false; };
    }, [movie.id, movie.identifiers, movie.posterUrl, movie.title]);

    const itemVariants = {
        hidden: { opacity: 0, y: 20 },
        visible: { opacity: 1, y: 0 }
    };

    if (viewMode === 'text') {
        return (
            <motion.div 
                className="col" 
                variants={itemVariants}
                initial="hidden"
                animate="visible"
            >
                <div className="movie-card-compact border border-secondary shadow-sm" onClick={onOpen}>
                    <h6 className="text-white fw-bold m-0 text-truncate">{movie.titlePt || movie.title}</h6>
                    <div className="d-flex justify-content-between mt-2 small text-secondary">
                        <span>{movie.year}</span>
                        <span>{movie.duration}</span>
                    </div>
                </div>
            </motion.div>
        );
    }
    
    // Image View
    return (
        <motion.div 
            className="col" 
            variants={itemVariants}
            initial="hidden"
            animate="visible"
        >
            <div 
                className="movie-card shadow-lg" 
                onClick={onOpen} 
                style={{ 
                    backgroundImage: !imageError && imageSrc ? `url("${imageSrc}")` : 'none',
                    backgroundColor: '#1f1f1f'
                }}
            >
                {/* Fallback for completely broken images (Network Error on UI Avatar) */}
                {(imageError || !imageSrc) && (
                    <div className="w-100 h-100 d-flex flex-column justify-content-center align-items-center text-secondary p-3 text-center">
                        <ImageOff size={32} className="mb-2 opacity-50" />
                        <span className="small text-truncate w-100">{movie.title}</span>
                    </div>
                )}

                {/* Hidden image tag to detect load errors */}
                {imageSrc && (
                    <img 
                        src={imageSrc} 
                        style={{ display: 'none' }} 
                        onError={() => setImageError(true)} 
                        onLoad={() => setImageError(false)}
                        alt={movie.title}
                    />
                )}

                <div className="movie-card-overlay p-2 d-flex flex-column justify-content-end">
                    <h6 className="text-white fw-bold mb-0 text-shadow small">{movie.titlePt || movie.title}</h6>
                    <div className="d-flex justify-content-between align-items-center mb-2">
                        <div className="text-white-50 xsmall d-flex gap-1">
                            <span>{movie.language}</span>
                            <span>•</span>
                            <span>{movie.year}</span>
                        </div>
                        <div className="text-warning fw-bold xsmall">{movie.rating}</div>
                    </div>
                    <div className="d-flex justify-content-between align-items-center">
                        <div className="d-flex gap-2 align-items-center">
                            {state.isfavorite && <Heart size={14} className="text-danger" fill="currentColor" />}
                            {state.iswatched && <CheckCircle size={14} className="text-success" />}
                            {movie.hasSubtitles && <MonitorPlay size={14} className="text-info" />}
                        </div>
                        <button 
                          className="btn btn-sm btn-danger rounded-circle p-1 d-flex align-items-center justify-content-center shadow-sm"
                          style={{ width: '26px', height: '26px' }}
                          title={movie.videoUrl ? "Assistir Filme" : "Buscar e Assistir"}
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpen();
                          }}
                        >
                          <Play size={12} fill="white" className="ms-0.5" />
                        </button>
                    </div>
                </div>
            </div>
        </motion.div>
    );
};
