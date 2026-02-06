
import { Movie } from '../types';

const BASE_URL = 'https://api.tvmaze.com';

// Helper to strip HTML tags from TVMaze summaries
const stripHtml = (html: string) => {
   if (!html) return "";
   return html.replace(/<[^>]*>?/gm, '');
};

export const searchTvMaze = async (query: string): Promise<Partial<Movie>[]> => {
    try {
        const response = await fetch(`${BASE_URL}/search/shows?q=${encodeURIComponent(query)}`);
        const data = await response.json();

        if (!data || !Array.isArray(data)) return [];

        return data.map((item: any) => {
            const show = item.show;
            return {
                id: `tvmaze-${show.id}`,
                title: show.name,
                originalTitle: show.name,
                year: show.premiered ? new Date(show.premiered).getFullYear() : 0,
                description: stripHtml(show.summary),
                posterUrl: show.image?.original || show.image?.medium || "",
                genres: show.genres || [],
                language: show.language || "English",
                rating: show.rating?.average ? show.rating.average.toString() : "N/A",
                duration: show.averageRuntime ? `${show.averageRuntime}m` : "",
                type: 'Series', // TVMaze is primarily shows
                wikidataId: show.externals?.imdb || show.externals?.thetvdb?.toString() || "", // Try to store IMDb ID for linking
                videoUrl: show.officialSite || ""
            };
        });
    } catch (error) {
        console.error("TVMaze Search Error:", error);
        return [];
    }
};

export const getTvMazeDetails = async (tvmazeId: string): Promise<Partial<Movie> | null> => {
    const cleanId = tvmazeId.replace('tvmaze-', '');
    try {
        const response = await fetch(`${BASE_URL}/shows/${cleanId}?embed=cast`);
        const show = await response.json();

        if (!show) return null;

        const cast = show._embedded?.cast?.map((c: any) => c.person.name) || [];

        return {
            title: show.name,
            year: show.premiered ? new Date(show.premiered).getFullYear() : 0,
            description: stripHtml(show.summary),
            posterUrl: show.image?.original || "",
            language: show.language || "English",
            rating: show.rating?.average?.toString() || "N/A",
            duration: show.averageRuntime ? `${show.averageRuntime}m` : "",
            genres: show.genres || [],
            type: 'Series',
            cast: cast,
            wikidataId: show.externals?.imdb || ""
        };
    } catch (error) {
        console.error("TVMaze Details Error:", error);
        return null;
    }
};

export const getTvMazeByImdbId = async (imdbId: string): Promise<Partial<Movie> | null> => {
    if (!imdbId.startsWith('tt')) return null;

    try {
        const response = await fetch(`${BASE_URL}/lookup/shows?imdb=${imdbId}`);
        // TVMaze redirects 302 to the show URL if found, or returns 404
        if (response.status === 404) return null;
        
        const show = await response.json();
        
        return {
            title: show.name,
            year: show.premiered ? new Date(show.premiered).getFullYear() : 0,
            description: stripHtml(show.summary),
            posterUrl: show.image?.original || "",
            genres: show.genres || [],
            rating: show.rating?.average?.toString(),
            type: 'Series'
        };
    } catch (error) {
        // TVMaze lookup might fail if not a show
        return null;
    }
};
