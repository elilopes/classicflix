import React from 'react';
import { Heart, CheckCircle, MonitorPlay } from 'lucide-react';
import { Movie, UserMovieInteraction } from '../types';

interface MovieCardProps {
    movie: Movie;
    state: UserMovieInteraction;
    onOpen: () => void;
    viewMode: 'image' | 'text';
}

export const MovieCard: React.FC<MovieCardProps> = ({ movie, state, onOpen, viewMode }) => {
    if (viewMode === 'text') {
        return (
            <div className="col">
                <div className="movie-card-compact border border-secondary shadow-sm" onClick={onOpen}>
                    <h6 className="text-white fw-bold m-0 text-truncate">{movie.titlePt || movie.title}</h6>
                    <div className="d-flex justify-content-between mt-2 small text-secondary">
                        <span>{movie.year}</span>
                        <span>{movie.duration}</span>
                    </div>
                </div>
            </div>
        );
    }
    
    // Image View
    return (
        <div className="col">
            <div className="movie-card shadow-lg border border-secondary" onClick={onOpen} style={{ backgroundImage: `url("${movie.posterUrl}")` }}>
                <div className="movie-card-overlay p-2 d-flex flex-column justify-content-end">
                    <h6 className="text-white fw-bold mb-1 text-shadow small">{movie.titlePt || movie.title}</h6>
                    <div className="d-flex justify-content-between align-items-center">
                        <div className="d-flex gap-2">
                            {state.is_favorite && <Heart size={14} className="text-danger" fill="currentColor" />}
                            {state.is_watched && <CheckCircle size={14} className="text-success" />}
                            {movie.hasSubtitles && <MonitorPlay size={14} className="text-info" />}
                        </div>
                        <div className="badge bg-dark border border-secondary text-warning xsmall">{movie.rating}</div>
                    </div>
                </div>
            </div>
        </div>
    );
};