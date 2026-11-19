import { Movie } from "../types";

const getClientEnv = (viteKey: string, nodeKey?: string): string => {
  try {
    // @ts-ignore
    if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[viteKey]) {
      // @ts-ignore
      return import.meta.env[viteKey];
    }
    // @ts-ignore
    if (typeof process !== 'undefined' && process.env) {
      // @ts-ignore
      return process.env[nodeKey || viteKey] || '';
    }
  } catch {
    // ignore env lookup failure
  }
  return '';
};

export interface QuizQuestion {
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
}

export interface ChatHistoryMessage {
  role: 'user' | 'model';
  text: string;
}

async function postGeminiJson<T>(endpoint: string, payload: unknown): Promise<T> {
  const response = await fetch(`/api/gemini/${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    let message = `Request failed with status ${response.status}`;
    try {
      const errData = await response.json();
      if (errData?.error) message = errData.error;
    } catch {
      // ignore non-JSON error body
    }
    throw new Error(message);
  }

  return response.json();
}

export const extractMetadataFromUrl = async (url: string): Promise<Partial<Movie>> => {
  return await postGeminiJson<Partial<Movie>>('extract-metadata', { url });
};

export const searchCatalogWithAI = async (query: string, availableMovies: Movie[]): Promise<{ matchedIds: string[], reasoning: string }> => {
  const compactMovies = availableMovies.map(m => ({
    id: m.id,
    title: m.title,
    titlePt: m.titlePt,
    director: m.director,
    genres: m.genres,
    themes: m.themes,
    year: m.year,
    description: m.description,
    language: m.language,
  }));
  return await postGeminiJson<{ matchedIds: string[], reasoning: string }>('search-catalog', {
    query,
    availableMovies: compactMovies,
  });
};

export const generateMovieTrivia = async (title: string, year: number, language?: string, wikidataId?: string): Promise<string[]> => {
  const data = await postGeminiJson<{ trivia: string[] }>('trivia', { title, year, language, wikidataId });
  if (!Array.isArray(data.trivia)) {
    throw new Error("Resposta inválida ao gerar curiosidades.");
  }
  return data.trivia;
};

export const generateCriticalAnalysis = async (title: string, year: number, language: string, wikidataId?: string): Promise<string> => {
  const data = await postGeminiJson<{ text: string }>('critical-analysis', { title, year, language, wikidataId });
  return data.text || "Analysis unavailable.";
};

export const generateCriticsSummary = async (title: string, year: number, language: string, wikidataId?: string): Promise<string> => {
  const data = await postGeminiJson<{ text: string }>('critics-summary', { title, year, language, wikidataId });
  return data.text || "Critics summary unavailable.";
};

export const generateCinemaHistory = async (title: string, year: number, language: string, wikidataId?: string): Promise<string> => {
  const data = await postGeminiJson<{ text: string }>('cinema-history', { title, year, language, wikidataId });
  return data.text || "History context unavailable.";
};

export const generateMovieEmojis = async (title: string): Promise<string> => {
  try {
    const data = await postGeminiJson<{ text: string }>('movie-emojis', { title });
    return data.text?.trim() || "🎬❓";
  } catch (e) {
    console.error("Emoji generation error:", e);
    return "🎬❓";
  }
};

export const generateMovieHint = async (title: string, year: number): Promise<string> => {
  try {
    const data = await postGeminiJson<{ text: string }>('movie-hint', { title, year });
    return data.text?.trim() || `Released in ${year}`;
  } catch (e) {
    return `Released in ${year}`;
  }
};

export const validateAdedonhaAnswer = async (category: string, letter: string, answer: string): Promise<boolean> => {
  try {
    const data = await postGeminiJson<{ valid: boolean }>('validate-adedonha', { category, letter, answer });
    return Boolean(data.valid);
  } catch (error) {
    console.error("AI Validation error:", error);
    return false;
  }
};

export const generateMovieQuiz = async (movie: { title: string; titlePt?: string; year: number; director?: string }): Promise<QuizQuestion[]> => {
  const data = await postGeminiJson<{ questions: QuizQuestion[] }>('quiz', movie);
  if (!Array.isArray(data.questions)) {
    throw new Error("Invalid quiz payload returned by server.");
  }
  return data.questions;
};

export const streamAssistantChat = async (params: {
  catalog: Movie[];
  language: string;
  history: ChatHistoryMessage[];
  message: string;
  onChunk: (chunkText: string) => void;
}): Promise<void> => {
  const compactCatalog = params.catalog.map(m => ({ title: m.title, year: m.year }));
  const response = await fetch('/api/gemini/chat/stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      catalog: compactCatalog,
      language: params.language,
      history: params.history,
      message: params.message,
    }),
  });

  if (!response.ok || !response.body) {
    let message = `Chat request failed with status ${response.status}`;
    try {
      const errData = await response.json();
      if (errData?.error) message = errData.error;
    } catch {
      // ignore non-JSON error body
    }
    throw new Error(message);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split('\n\n');
    buffer = events.pop() || '';

    for (const event of events) {
      const lines = event.split('\n');
      for (const line of lines) {
        if (!line.startsWith('data:')) continue;
        const jsonStr = line.slice(5).trim();
        if (!jsonStr) continue;
        const parsed = JSON.parse(jsonStr);
        if (parsed.error) {
          throw new Error(parsed.error);
        }
        if (parsed.text) {
          params.onChunk(parsed.text);
        }
      }
    }
  }
};

export const findDirectorForMovie = async (title: string, year: number | null, wikidataId?: string): Promise<{ director: string, wikidataId?: string }> => {
  // 1. Try OMDB
  const omdbKey = getClientEnv('VITE_OMDB_KEY', 'OMDB_KEY') || "dc3946fe";
  if (omdbKey) {
    try {
      const yearParam = year ? `&y=${year}` : '';
      const url = `https://www.omdbapi.com/?t=${encodeURIComponent(title)}${yearParam}&apikey=${omdbKey}`;
      const resp = await fetch(url);
      if (resp.ok) {
        const data = await resp.json();
        if (data.Response === "True" && data.Director && data.Director !== "N/A" && data.Director.toLowerCase() !== "none" && data.Director.toLowerCase() !== "unknown") {
          return { director: data.Director };
        }
      }
    } catch (e) { console.error("OMDB error:", e); }
  }

  // 2. Try TMDB
  const tmdbKey = getClientEnv('VITE_TMDB_API_KEY', 'TMDB_API_KEY') || "e6a44aa8865934c03ad582bc72c5b85d";
  if (tmdbKey) {
    try {
      const yearParam = year ? `&year=${year}` : '';
      const searchUrl = `https://api.themoviedb.org/3/search/movie?api_key=${tmdbKey}&query=${encodeURIComponent(title)}${yearParam}`;
      const resp = await fetch(searchUrl);
      if (resp.ok) {
        const data = await resp.json();
        if (data.results && data.results.length > 0) {
          const movieId = data.results[0].id;
          const creditsUrl = `https://api.themoviedb.org/3/movie/${movieId}/credits?api_key=${tmdbKey}`;
          const creditsResp = await fetch(creditsUrl);
          if (creditsResp.ok) {
            const creditsData = await creditsResp.json();
            const director = creditsData.crew?.find((member: any) => member.job === "Director");
            if (director?.name) {
              return { director: director.name };
            }
          }
        }
      }
    } catch (e) { console.error("TMDB error:", e); }
  }

  // 3. Try IMDb (RapidAPI)
  const rapidKey = getClientEnv('VITE_RAPID_API_KEY', 'RAPID_API_KEY') || "8d0b2005e5msh7794ca50aee0eb4p14f460jsn249cb3b9d70b";
  const rapidHost = getClientEnv('VITE_RAPID_API_HOST_IMDB', 'RAPID_API_HOST_IMDB') || "imdb8.p.rapidapi.com";
  if (rapidKey && rapidHost) {
    try {
      const findUrl = `https://${rapidHost}/title/find?q=${encodeURIComponent(title)}`;
      const resp = await fetch(findUrl, {
        headers: {
          'x-rapidapi-key': rapidKey,
          'x-rapidapi-host': rapidHost
        }
      });
      if (resp.ok) {
        const data = await resp.json();
        if (data.results && data.results.length > 0) {
          const match = (year && data.results.find((r: any) => r.year === year)) || data.results[0];
          if (match && match.id) {
            const tconst = match.id.split('/')[2];
            if (tconst) {
              const detailsUrl = `https://${rapidHost}/title/get-full-credits?tconst=${tconst}`;
              const detailsResp = await fetch(detailsUrl, {
                headers: {
                  'x-rapidapi-key': rapidKey,
                  'x-rapidapi-host': rapidHost
                }
              });
              if (detailsResp.ok) {
                const detailsData = await detailsResp.json();
                const directors = detailsData?.crew?.director || detailsData?.directors || [];
                const directorNames = (Array.isArray(directors) ? directors : [])
                  .map((d: any) => d?.name)
                  .filter(Boolean);
                if (directorNames.length > 0) {
                  return { director: directorNames.join(', ') };
                }
              }
            }
          }
        }
      }
    } catch (e) { console.error("IMDb RapidAPI error:", e); }
  }

  // 4. AI Fallback via Gemini Server Route
  try {
    const aiRes = await postGeminiJson<{ director: string }>('find-director', { title, year, wikidataId });
    if (aiRes?.director && aiRes.director.toLowerCase() !== 'unknown' && aiRes.director.toLowerCase() !== 'n/a') {
      return { director: aiRes.director };
    }
  } catch (e) {
    console.warn("Gemini find-director fallback error:", e);
  }

  return { director: "Unknown" };
};

export const findYearForMovie = async (title: string, wikidataId?: string): Promise<{ year: number } | null> => {
  // 1. Try OMDB
  const omdbKey = getClientEnv('VITE_OMDB_KEY', 'OMDB_KEY') || "dc3946fe";
  if (omdbKey) {
    try {
      const url = `https://www.omdbapi.com/?t=${encodeURIComponent(title)}&apikey=${omdbKey}`;
      const resp = await fetch(url);
      if (resp.ok) {
        const data = await resp.json();
        if (data.Response === "True" && data.Year && data.Year !== "N/A") {
          const yearMatch = data.Year.match(/\d{4}/);
          if (yearMatch) {
            return { year: parseInt(yearMatch[0], 10) };
          }
        }
      }
    } catch (e) { console.error("OMDB year error:", e); }
  }

  // 2. Try TMDB
  const tmdbKey = getClientEnv('VITE_TMDB_API_KEY', 'TMDB_API_KEY') || "e6a44aa8865934c03ad582bc72c5b85d";
  if (tmdbKey) {
    try {
      const searchUrl = `https://api.themoviedb.org/3/search/movie?api_key=${tmdbKey}&query=${encodeURIComponent(title)}`;
      const resp = await fetch(searchUrl);
      if (resp.ok) {
        const data = await resp.json();
        if (data.results && data.results.length > 0 && data.results[0].release_date) {
          const yearMatch = data.results[0].release_date.match(/\d{4}/);
          if (yearMatch) {
            return { year: parseInt(yearMatch[0], 10) };
          }
        }
      }
    } catch (e) { console.error("TMDB year error:", e); }
  }

  // 3. AI Fallback via Gemini Server Route
  try {
    const aiRes = await postGeminiJson<{ year: number | null }>('find-year', { title, wikidataId });
    if (aiRes?.year) {
      return { year: aiRes.year };
    }
  } catch (e) {
    console.warn("Gemini find-year fallback error:", e);
  }

  return null;
};

export const findLanguageForMovie = async (title: string, wikidataId?: string): Promise<{ language: string } | null> => {
  // 1. Try OMDB
  const omdbKey = getClientEnv('VITE_OMDB_KEY', 'OMDB_KEY') || "dc3946fe";
  if (omdbKey) {
    try {
      const url = `https://www.omdbapi.com/?t=${encodeURIComponent(title)}&apikey=${omdbKey}`;
      const resp = await fetch(url);
      if (resp.ok) {
        const data = await resp.json();
        if (data.Response === "True" && data.Language && data.Language !== "N/A" && data.Language.toLowerCase() !== "none") {
          const primaryLanguage = data.Language.split(',')[0].trim();
          if (primaryLanguage && primaryLanguage.toLowerCase() !== "none" && primaryLanguage.toLowerCase() !== "unknown" && primaryLanguage !== "N/A") {
            return { language: primaryLanguage };
          }
        }
      }
    } catch (e) { console.error("OMDB language error:", e); }
  }

  // 2. Try TMDB
  const tmdbKey = getClientEnv('VITE_TMDB_API_KEY', 'TMDB_API_KEY') || "e6a44aa8865934c03ad582bc72c5b85d";
  if (tmdbKey) {
    try {
      const searchUrl = `https://api.themoviedb.org/3/search/movie?api_key=${tmdbKey}&query=${encodeURIComponent(title)}`;
      const resp = await fetch(searchUrl);
      if (resp.ok) {
        const data = await resp.json();
        if (data.results && data.results.length > 0) {
          const langCode = data.results[0].original_language;
          if (langCode && langCode.toLowerCase() !== "xx" && langCode.toLowerCase() !== "none") {
            const langMap: Record<string, string> = {
              'en': 'English', 'fr': 'French', 'es': 'Spanish', 'de': 'German', 'it': 'Italian',
              'ja': 'Japanese', 'ko': 'Korean', 'zh': 'Chinese', 'ru': 'Russian', 'pt': 'Portuguese',
              'hi': 'Hindi', 'ar': 'Arabic', 'tr': 'Turkish', 'nl': 'Dutch', 'sv': 'Swedish',
              'pl': 'Polish', 'da': 'Danish', 'fi': 'Finnish', 'no': 'Norwegian', 'cs': 'Czech'
            };
            const languageName = langMap[langCode] || langCode.toUpperCase();
            return { language: languageName };
          }
        }
      }
    } catch (e) { console.error("TMDB language error:", e); }
  }

  // 3. AI Fallback via Gemini Server Route
  try {
    const aiRes = await postGeminiJson<{ language: string }>('find-language', { title, wikidataId });
    if (aiRes?.language && aiRes.language.toLowerCase() !== 'unknown' && aiRes.language.toLowerCase() !== 'n/a') {
      return { language: aiRes.language };
    }
  } catch (e) {
    console.warn("Gemini find-language fallback error:", e);
  }

  return { language: "Unknown" };
};
