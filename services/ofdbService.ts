
import { Movie } from '../types';

// OFDb does not have a public JSON API. We use a CORS proxy to fetch the search page and parse it.
// This is fragile but enables client-side integration without a backend.
const CORS_PROXY = 'https://api.allorigins.win/get?url=';
const BASE_SEARCH_URL = 'https://www.ofdb.de/view.php?page=suchergebnis&Kat=All&SText=';

export const searchOfdb = async (query: string): Promise<Partial<Movie>[]> => {
    if (!query) return [];

    try {
        const targetUrl = `${BASE_SEARCH_URL}${encodeURIComponent(query)}`;
        const response = await fetch(`${CORS_PROXY}${encodeURIComponent(targetUrl)}`);
        const json = await response.json();
        
        if (!json.contents) return [];

        const parser = new DOMParser();
        const doc = parser.parseFromString(json.contents, 'text/html');
        
        // OFDb search results are usually in a table list
        // This selector targets the result rows (this logic might need adjustment if OFDb changes layout)
        const rows = Array.from(doc.querySelectorAll('tr[valign="top"]'));
        const results: Partial<Movie>[] = [];

        rows.forEach(row => {
            const linkElement = row.querySelector('a[href^="film/"]');
            const fontElement = row.querySelector('font[size="1"]'); // Often contains year/title details

            if (linkElement) {
                const titleFull = linkElement.textContent || "Unknown";
                const href = linkElement.getAttribute('href') || "";
                const ofdbId = href.split('/')[1] || `ofdb-${Math.random()}`;
                
                // Extract Year from parenthesis usually at end of title or in next column
                let year = 0;
                const yearMatch = titleFull.match(/\((\d{4})\)/);
                if (yearMatch) {
                    year = parseInt(yearMatch[1]);
                } else if (fontElement) {
                     const yearText = fontElement.textContent || "";
                     const yMatch = yearText.match(/\((\d{4})\)/);
                     if (yMatch) year = parseInt(yMatch[1]);
                }

                results.push({
                    id: `ofdb-${ofdbId}`,
                    title: titleFull.replace(/\(\d{4}\)/, '').trim(),
                    year: year || new Date().getFullYear(),
                    type: 'Movie', // OFDb is mostly movies
                    videoUrl: `https://www.ofdb.de/${href}`, // Link to OFDb page as videoUrl placeholder
                    sourceLabel: 'OFDb',
                    description: 'Details available on OFDb.de'
                });
            }
        });

        return results.slice(0, 10); // Limit results
    } catch (error) {
        console.error("OFDb Search Error:", error);
        return [];
    }
};

/**
 * Attempts to get more details. 
 * Since scraping details page is heavy, we return basic info or would need another proxy call.
 */
export const getOfdbDetails = async (ofdbId: string): Promise<Partial<Movie> | null> => {
    // For now, we return null to force manual entry completion, 
    // as parsing the full OFDb detail page safely is complex.
    return null;
};
