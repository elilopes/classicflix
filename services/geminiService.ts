import { GoogleGenAI, Type } from "@google/genai";
import { Movie } from "../types";

// Helper to ensure API key is available, prompting user if necessary in the browser
export const ensureApiKey = async () => {
    if (typeof window !== 'undefined' && (window as any).aistudio) {
        const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY || (window.process?.env as any)?.GEMINI_API_KEY || (window.process?.env as any)?.API_KEY;
        if (!apiKey) {
            const hasKey = await (window as any).aistudio.hasSelectedApiKey();
            if (!hasKey) {
                await (window as any).aistudio.openSelectKey();
            }
        }
    }
};

// Helper to initialize the AI client using process.env.GEMINI_API_KEY as per guidelines
const getAIClient = () => {
    const envStr = JSON.stringify(window.process?.env || {});
    const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY || (window.process?.env as any)?.GEMINI_API_KEY || (window.process?.env as any)?.API_KEY;
    if (!apiKey) {
        throw new Error(`Gemini API Key is not configured. Env: ${envStr}`);
    }
    return new GoogleGenAI({ apiKey });
};

// Fix: Added missing export for extractMetadataFromUrl requested in AddMovieModal.tsx
export const extractMetadataFromUrl = async (url: string): Promise<Partial<Movie>> => {
  try {
    await ensureApiKey();
    const ai = getAIClient();
    const response = await ai.models.generateContent({
      model: "gemini-3.1-pro-preview",
      contents: `Extract movie or series metadata from this URL: ${url}. 
      If the URL is from Wikidata, IMDb, TMDb, or Archive.org, use your internal knowledge to provide complete details for that specific production.
      If you can identify the movie from the URL, provide its details even if they are not explicitly on the page.
      Focus on: title, year, director, cast, genres, themes, and a good description.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            year: { type: Type.INTEGER },
            description: { type: Type.STRING },
            director: { type: Type.STRING },
            genres: { type: Type.ARRAY, items: { type: Type.STRING } },
            themes: { type: Type.ARRAY, items: { type: Type.STRING } },
            cast: { type: Type.ARRAY, items: { type: Type.STRING } },
            type: { type: Type.STRING, description: "'Movie' or 'Series'" },
            language: { type: Type.STRING },
            rating: { type: Type.STRING },
            duration: { type: Type.STRING }
          },
          required: ["title"]
        }
      }
    });

    // Directly accessing .text property as per guidelines
    const jsonText = response.text || "{}";
    return JSON.parse(jsonText);
  } catch (error) {
    console.error("Extraction error:", error);
    return { title: "New Movie" };
  }
};

export const searchCatalogWithAI = async (query: string, availableMovies: Movie[]): Promise<{ matchedIds: string[], reasoning: string }> => {
  try {
    await ensureApiKey();
    const ai = getAIClient();
    const movieContext = availableMovies.map(m => 
      `ID: ${m.id}, Title: ${m.title}, Genres: ${(Array.isArray(m.genres) ? m.genres : []).join(", ")}, Year: ${m.year}, Desc: ${m.description}, Lang: ${m.language}`
    ).join("\n");

    const systemInstruction = `You are a movie recommendation engine for a specific catalog of public domain movies. 
    Analyze the user's search query and the provided Movie List.
    Return the IDs of the movies that best match the query.
    Return a short "reasoning" explaining why you picked these movies.`;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Movie List:\n${movieContext}\n\nUser Query: "${query}"`,
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            matchedIds: { type: Type.ARRAY, items: { type: Type.STRING } },
            reasoning: { type: Type.STRING }
          },
          required: ["matchedIds", "reasoning"]
        }
      }
    });

    const jsonText = response.text || "{}";
    return JSON.parse(jsonText);
  } catch (error) {
    return { matchedIds: [], reasoning: "AI search unavailable." };
  }
};

export const generateMovieTrivia = async (title: string, year: number): Promise<string[]> => {
    try {
        await ensureApiKey();
        const ai = getAIClient();
        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: `Give me 4 interesting, lesser-known trivia facts about the movie "${title}" from ${year}. Return ONLY a JSON array of strings.`,
            config: {
                responseMimeType: "application/json",
                responseSchema: { type: Type.ARRAY, items: { type: Type.STRING } }
            }
        });
        return JSON.parse(response.text || "[]");
    } catch (e) { return ["Trivia unavailable."]; }
}

export const generateCriticalAnalysis = async (title: string, year: number, language: string): Promise<string> => {
    try {
        await ensureApiKey();
        const ai = getAIClient();
        const response = await ai.models.generateContent({
            model: "gemini-3.1-pro-preview", 
            contents: `Write a deep, engaging critical analysis of the classic movie "${title}" (${year}) in ${language === 'pt' ? 'Portuguese' : 'English'}. Include historical significance, visual style and cultural impact. Use Markdown.`,
        });
        return response.text || "Analysis unavailable.";
    } catch (e) { return "Could not generate analysis."; }
};

export const generateCriticsSummary = async (title: string, year: number, language: string): Promise<string> => {
    try {
        await ensureApiKey();
        const ai = getAIClient();
        const response = await ai.models.generateContent({
            model: "gemini-3.1-pro-preview", 
            contents: `Analyze the critical reception of the movie "${title}" (${year}) in ${language === 'pt' ? 'Portuguese' : 'English'}. Mention consensus, praises and legacy. Use Markdown.`,
        });
        return response.text || "Critics summary unavailable.";
    } catch (e) { return "Could not fetch critics summary."; }
}

export const generateCinemaHistory = async (title: string, year: number, language: string): Promise<string> => {
    try {
        await ensureApiKey();
        const ai = getAIClient();
        const response = await ai.models.generateContent({
            model: "gemini-3.1-pro-preview", 
            contents: `Provide historical context about cinema in ${year}, the year "${title}" was released. What were the major trends, technological advances, and concurrent classics? Answer in ${language === 'pt' ? 'Portuguese' : 'English'}. Use Markdown.`,
        });
        return response.text || "History context unavailable.";
    } catch (e) { return "Could not generate cinema history."; }
}

export const generateMovieEmojis = async (title: string): Promise<string> => {
    try {
        const ai = getAIClient();
        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: `Represent the movie title "${title}" using exactly 3 to 6 emojis or symbols. Return ONLY the emojis, no text.`,
        });
        return response.text?.trim() || "🎬❓";
    } catch (e) {
        console.error("Emoji generation error:", e);
        return "🎬❓";
    }
};

export const generateMovieHint = async (title: string, year: number): Promise<string> => {
    try {
        const ai = getAIClient();
        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: `Give a very short, one-sentence hint for the movie "${title}" (${year}) without mentioning its title.`,
        });
        return response.text?.trim() || `Released in ${year}`;
    } catch (e) {
        return `Released in ${year}`;
    }
};

export const validateAdedonhaAnswer = async (category: string, letter: string, answer: string): Promise<boolean> => {
  try {
    await ensureApiKey();
    const ai = getAIClient();
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Você é um juiz do jogo Adedonha (Stop). 
    A categoria é: ${category} (Títulos de filmes, Diretores, Desenhos Animados ou Temas de filmes).
    A letra obrigatória é: ${letter}.
    O jogador respondeu: "${answer}".
    
    Responda APENAS "TRUE" se a resposta for válida para a categoria e começar com a letra (ignore acentos e pequenos erros de digitação). 
    Responda "FALSE" se for inválida ou não começar com a letra.
    Exemplo: Categoria "Diretores", Letra "S", Resposta "Steven Spilberg" -> TRUE (mesmo com erro no nome).
    Exemplo: Categoria "Títulos", Letra "A", Resposta "O Auto da Compadecida" -> TRUE (ignora o artigo "O" se a palavra principal começar com A).`
    });
    
    const text = response.text || "FALSE";
    return text.toUpperCase().includes("TRUE");
  } catch (error) {
    console.error("AI Validation error:", error);
    return false;
  }
};

export const createChatSession = (catalog: Movie[], language: string) => {
    const ai = getAIClient();
    const catalogSummary = catalog.map(m => `- ${m.title} (${m.year})`).join('\n');
    const systemInstruction = `You are "Cine-Sage", an expert on classic cinema. Answer in ${language === 'pt' ? 'Portuguese' : 'English'}. Catalog: ${catalogSummary}`;
    return ai.chats.create({
        model: "gemini-3-flash-preview",
        config: { systemInstruction }
    });
};

export const findDirectorForMovie = async (title: string, year: number | null): Promise<{ director: string, wikidataId?: string }> => {
  console.log(`Starting findDirectorForMovie for "${title}" (${year})`);
  
  // 1. Try OMDB
  const omdbKey = process.env.OMDB_KEY || "dc3946fe";
  console.log("OMDB Key status:", omdbKey ? "Using key (starts with " + omdbKey.substring(0, 3) + "...)" : "Missing");
  if (omdbKey) {
    try {
      const yearParam = year ? `&y=${year}` : '';
      const url = `https://www.omdbapi.com/?t=${encodeURIComponent(title)}${yearParam}&apikey=${omdbKey}`;
      console.log("OMDB Fetch URL:", url);
      const resp = await fetch(url);
      if (!resp.ok) {
        console.warn(`OMDB API returned status: ${resp.status}`);
      } else {
        const data = await resp.json();
        console.log("OMDB Response:", data);
        if (data.Response === "True" && data.Director && data.Director !== "N/A" && data.Director.toLowerCase() !== "none" && data.Director.toLowerCase() !== "unknown") {
          console.log("SUCCESS: Director found via OMDB:", data.Director);
          return { director: data.Director };
        }
      }
    } catch (e) { console.error("OMDB error:", e); }
  }

  // 2. Try TMDB
  const tmdbKey = process.env.TMDB_API_KEY || "e6a44aa8865934c03ad582bc72c5b85d";
  console.log("TMDB Key status:", tmdbKey ? "Using key (starts with " + tmdbKey.substring(0, 3) + "...)" : "Missing");
  if (tmdbKey) {
    try {
      const yearParam = year ? `&year=${year}` : '';
      const searchUrl = `https://api.themoviedb.org/3/search/movie?api_key=${tmdbKey}&query=${encodeURIComponent(title)}${yearParam}`;
      console.log("TMDB Search URL:", searchUrl);
      const resp = await fetch(searchUrl);
      if (!resp.ok) {
        console.warn(`TMDB API returned status: ${resp.status}`);
      } else {
        const data = await resp.json();
        console.log("TMDB Search Data:", data);
        if (data.results && data.results.length > 0) {
          const movieId = data.results[0].id;
          console.log("TMDB Movie ID found:", movieId);
          const creditsUrl = `https://api.themoviedb.org/3/movie/${movieId}/credits?api_key=${tmdbKey}`;
          const creditsResp = await fetch(creditsUrl);
          if (creditsResp.ok) {
            const creditsData = await creditsResp.json();
            const director = creditsData.crew.find((member: any) => member.job === "Director");
            if (director) {
              console.log("SUCCESS: Director found via TMDB:", director.name);
              return { director: director.name };
            }
          }
        }
      }
    } catch (e) { console.error("TMDB error:", e); }
  }

  // 3. Try IMDb (RapidAPI)
  const rapidKey = process.env.RAPID_API_KEY || "8d0b2005e5msh7794ca50aee0eb4p14f460jsn249cb3b9d70b";
  const rapidHost = process.env.RAPID_API_HOST_IMDB || "imdb8.p.rapidapi.com";
  console.log("IMDb RapidAPI status:", rapidKey ? "Key Present" : "Key Missing", rapidHost ? "Host Present" : "Host Missing");
  if (rapidKey && rapidHost) {
    try {
      const findUrl = `https://${rapidHost}/title/find?q=${encodeURIComponent(title)}`;
      console.log("IMDb RapidAPI Find URL:", findUrl);
      const resp = await fetch(findUrl, {
        headers: {
          'x-rapidapi-key': rapidKey,
          'x-rapidapi-host': rapidHost
        }
      });
      if (!resp.ok) {
        console.warn(`IMDb RapidAPI returned status: ${resp.status}`);
      } else {
        const data = await resp.json();
        console.log("IMDb RapidAPI Find Data:", data);
        if (data.results && data.results.length > 0) {
          const match = (year && data.results.find((r: any) => r.year === year)) || data.results[0];
          if (match && match.id) {
            const tconst = match.id.split('/')[2];
            console.log("IMDb tconst found:", tconst);
            const detailsUrl = `https://${rapidHost}/title/get-details?tconst=${tconst}`;
            const detailsResp = await fetch(detailsUrl, {
              headers: {
                'x-rapidapi-key': rapidKey,
                'x-rapidapi-host': rapidHost
              }
            });
            if (detailsResp.ok) {
              const detailsData = await detailsResp.json();
              console.log("IMDb Details Data:", detailsData);
            }
          }
        }
      }
    } catch (e) { console.error("IMDb RapidAPI error:", e); }
  }

  console.log("FAILURE: No director found in any source (Gemini fallback removed).");
  return { director: "Unknown" };
};

export const findYearForMovie = async (title: string): Promise<{ year: number } | null> => {
  console.log(`Starting findYearForMovie for "${title}"`);
  
  // 1. Try OMDB
  const omdbKey = process.env.OMDB_KEY || "dc3946fe";
  if (omdbKey) {
    try {
      const url = `https://www.omdbapi.com/?t=${encodeURIComponent(title)}&apikey=${omdbKey}`;
      const resp = await fetch(url);
      if (resp.ok) {
        const data = await resp.json();
        if (data.Response === "True" && data.Year && data.Year !== "N/A") {
          const yearMatch = data.Year.match(/\d{4}/);
          if (yearMatch) {
            console.log("SUCCESS: Year found via OMDB:", yearMatch[0]);
            return { year: parseInt(yearMatch[0], 10) };
          }
        }
      }
    } catch (e) { console.error("OMDB year error:", e); }
  }

  // 2. Try TMDB
  const tmdbKey = process.env.TMDB_API_KEY || "e6a44aa8865934c03ad582bc72c5b85d";
  if (tmdbKey) {
    try {
      const searchUrl = `https://api.themoviedb.org/3/search/movie?api_key=${tmdbKey}&query=${encodeURIComponent(title)}`;
      const resp = await fetch(searchUrl);
      if (resp.ok) {
        const data = await resp.json();
        if (data.results && data.results.length > 0 && data.results[0].release_date) {
          const yearMatch = data.results[0].release_date.match(/\d{4}/);
          if (yearMatch) {
            console.log("SUCCESS: Year found via TMDB:", yearMatch[0]);
            return { year: parseInt(yearMatch[0], 10) };
          }
        }
      }
    } catch (e) { console.error("TMDB year error:", e); }
  }

  return null;
};

export const findLanguageForMovie = async (title: string): Promise<{ language: string } | null> => {
  console.log(`Starting findLanguageForMovie for "${title}"`);
  
  // 1. Try OMDB
  const omdbKey = process.env.OMDB_KEY || "dc3946fe";
  if (omdbKey) {
    try {
      const url = `https://www.omdbapi.com/?t=${encodeURIComponent(title)}&apikey=${omdbKey}`;
      const resp = await fetch(url);
      if (resp.ok) {
        const data = await resp.json();
        if (data.Response === "True" && data.Language && data.Language !== "N/A" && data.Language.toLowerCase() !== "none") {
          const primaryLanguage = data.Language.split(',')[0].trim();
          if (primaryLanguage && primaryLanguage.toLowerCase() !== "none" && primaryLanguage.toLowerCase() !== "unknown" && primaryLanguage !== "N/A") {
            console.log("SUCCESS: Language found via OMDB:", primaryLanguage);
            return { language: primaryLanguage };
          }
        }
      }
    } catch (e) { console.error("OMDB language error:", e); }
  }

  // 2. Try TMDB
  const tmdbKey = process.env.TMDB_API_KEY || "e6a44aa8865934c03ad582bc72c5b85d";
  if (tmdbKey) {
    try {
      const searchUrl = `https://api.themoviedb.org/3/search/movie?api_key=${tmdbKey}&query=${encodeURIComponent(title)}`;
      const resp = await fetch(searchUrl);
      if (resp.ok) {
        const data = await resp.json();
        if (data.results && data.results.length > 0) {
          const langCode = data.results[0].original_language;
          if (langCode && langCode.toLowerCase() !== "xx" && langCode.toLowerCase() !== "none") {
            // Convert code to name (basic mapping for common ones, or just return code if complex)
            const langMap: Record<string, string> = {
              'en': 'English', 'fr': 'French', 'es': 'Spanish', 'de': 'German', 'it': 'Italian',
              'ja': 'Japanese', 'ko': 'Korean', 'zh': 'Chinese', 'ru': 'Russian', 'pt': 'Portuguese',
              'hi': 'Hindi', 'ar': 'Arabic', 'tr': 'Turkish', 'nl': 'Dutch', 'sv': 'Swedish',
              'pl': 'Polish', 'da': 'Danish', 'fi': 'Finnish', 'no': 'Norwegian', 'cs': 'Czech'
            };
            const languageName = langMap[langCode] || langCode.toUpperCase();
            console.log("SUCCESS: Language found via TMDB:", languageName);
            return { language: languageName };
          }
        }
      }
    } catch (e) { console.error("TMDB language error:", e); }
  }

  console.log("FAILURE: No language found in any source.");
  return { language: "Unknown" };
};
