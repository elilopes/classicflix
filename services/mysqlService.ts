
import { Movie } from '../types';

const API_BASE = 'http://localhost:3001/api';

/**
 * Verifica se o servidor MySQL local está acessível
 */
export const checkMysqlAvailability = async (): Promise<boolean> => {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000);
        // Tenta um fetch simples no endpoint de filmes do proxy
        const response = await fetch(`${API_BASE}/movies`, { signal: controller.signal });
        clearTimeout(timeoutId);
        return response.ok;
    } catch (e) {
        return false;
    }
};

/**
 * Busca filmes do banco de dados MySQL local
 */
export const fetchMysqlMovies = async (): Promise<Movie[]> => {
    const response = await fetch(`${API_BASE}/movies`);
    if (!response.ok) throw new Error("Failed to fetch from MySQL");
    const data = await response.json();
    
    // Mapeamento para garantir que campos JSON voltem como arrays limpos
    return data.map((item: any) => ({
        ...item,
        id: item.id,
        wikidataId: item.wikidataid,
        title: item.title,
        genres: typeof item.genres === 'string' ? JSON.parse(item.genres) : (item.genres || []),
        themes: typeof item.themes === 'string' ? JSON.parse(item.themes) : (item.themes || []),
        awards: typeof item.awards === 'string' ? JSON.parse(item.awards) : (item.awards || []),
        cast: typeof item.castmembers === 'string' ? JSON.parse(item.castmembers) : (item.castmembers || []),
        cinematographers: typeof item.cinematographers === 'string' ? JSON.parse(item.cinematographers) : (item.cinematographers || []),
        composers: typeof item.composers === 'string' ? JSON.parse(item.composers) : (item.composers || []),
    }));
};

/**
 * Adiciona um novo filme ao MySQL local
 */
export const addMysqlMovie = async (movie: Partial<Movie>) => {
    const response = await fetch(`${API_BASE}/movies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(movie)
    });
    return response.json();
};
