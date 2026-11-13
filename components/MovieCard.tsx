
import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Heart, CheckCircle, MonitorPlay, ImageOff, Play, Clock } from 'lucide-react';
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

import { resolveMoviePoster } from '../services/drivePosterMap';

export const MovieCard: React.FC<MovieCardProps> = ({ movie, state, onOpen, viewMode, onPosterFound }) => {
    const initialResolution = resolveMoviePoster(movie);
    const [imageSrc, setImageSrc] = useState<string>(initialResolution.primaryUrl || movie.posterUrl);
    const [triedFallback, setTriedFallback] = useState<boolean>(false);
    const [imageError, setImageError] = useState(false);

    // Synchronize when movie props change
    useEffect(() => {
        const res = resolveMoviePoster(movie);
        setImageSrc(res.primaryUrl || movie.posterUrl);
        setTriedFallback(false);
        setImageError(false);
    }, [movie.id, movie.wikidataId, movie.posterUrl]);

    const handleImageError = () => {
        const fallback = movie.backupPosterUrl || initialResolution.fallbackUrl;
        if (fallback && !triedFallback && fallback !== imageSrc) {
            setTriedFallback(true);
            setImageSrc(fallback);
            setImageError(false);
            return;
        }

        // Try external strategies if available
        if (movie.identifiers?.archiveId && !imageSrc.includes('archive.org')) {
            setImageSrc(`https://archive.org/services/img/${movie.identifiers.archiveId}`);
            setImageError(false);
            return;
        }

        setImageError(true);
    };

    // Effect to try and resolve a better image if the current one is missing or a placeholder
    useEffect(() => {
        let isMounted = true;

        const resolveImage = async () => {
            const isPlaceholder = !imageSrc || 
                                  imageSrc.includes('placehold.co') || 
                                  imageSrc.includes('ui-avatars.com');
            
            if (!isPlaceholder) return;

            // --- STRATEGIES TO FIND IMAGE ---
            let foundUrl = '';

            if (movie.identifiers) {
                // Strategy 1: Archive.org Thumbnail (Fastest, valid for public domain)
                if (movie.identifiers.archiveId && !foundUrl) {
                    foundUrl = `https://archive.org/services/img/${movie.identifiers.archiveId}`;
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
            }

            // --- APPLY & SAVE ---
            if (foundUrl && isMounted) {
                setImageSrc(foundUrl);
                setImageError(false);
                updateMoviePoster(movie.id, foundUrl);
                if (onPosterFound) {
                    onPosterFound(movie.id, foundUrl);
                }
                return;
            }
            
            // Strategy 5 (Fallback): UI Avatars Dynamic Image
            if (isPlaceholder && isMounted) {
                const fallbackUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(movie.title)}&background=1f1f1f&color=e50914&size=512&bold=true&length=2&font-size=0.33&uppercase=true`;
                setImageSrc(fallbackUrl);
            }
        };

        resolveImage();

        return () => { isMounted = false; };
    }, [movie.id, movie.identifiers, movie.posterUrl, movie.title, imageSrc]);

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
                        onError={handleImageError} 
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
                            {(state.watchlater || state.iswatchlist) && <Clock size={14} className="text-primary" />}
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
