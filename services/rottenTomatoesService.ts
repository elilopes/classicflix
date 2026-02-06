import { Movie } from '../types';

const RAPID_API_KEY = '8d0b2005e5msh7794ca50aee0eb4p14f460jsn249cb3b9d70b';
const RAPID_API_HOST = 'rottentomato.p.rapidapi.com';

export interface RTResult {
    title: string;
    year: number;
    tomatometer?: number;
    audience_score?: number;
    critics_consensus?: string;
    url?: string;
}

/**
 * Fetches Rotten Tomatoes data using RapidAPI.
 */
export const fetchRottenTomatoesData = async (title: string): Promise<RTResult | null> => {
    if (!title) return null;

    try {
        // The endpoint usually searches. We construct the search URL.
        const url = `https://${RAPID_API_HOST}/?s=${encodeURIComponent(title)}`;
        
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'X-RapidAPI-Key': RAPID_API_KEY,
                'X-RapidAPI-Host': RAPID_API_HOST
            }
        });

        const data = await response.json();

        // The API returns a structure like { movies: [...] }
        if (data && data.movies && data.movies.length > 0) {
            // Find best match
            const bestMatch = data.movies[0]; // Simplest approach: take first
            
            return {
                title: bestMatch.name,
                year: bestMatch.year,
                tomatometer: bestMatch.tomatometer,
                audience_score: bestMatch.audience_score,
                url: bestMatch.url,
                critics_consensus: "Consensus fetched via RapidAPI" 
            };
        }
        
        return null;
    } catch (error) {
        console.error("RapidAPI Rotten Tomatoes Fetch Error:", error);
        return null;
    }
};