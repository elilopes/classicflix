import { GoogleGenAI, Type } from "@google/genai";
import { Movie } from "../types";

// Helper to safely get env vars without crashing if 'process' is undefined
const getEnv = (key: string) => {
    try {
        // @ts-ignore
        if (typeof process !== 'undefined' && process.env) {
            // @ts-ignore
            return process.env[key];
        }
    } catch (e) {
        // Ignore reference errors
    }
    return '';
};

/**
 * Initializes the Gemini API client safely.
 */
const getAIClient = () => {
    const apiKey = getEnv('API_KEY');
    // We pass the key even if empty; the SDK might throw a specific error which we catch later, 
    // rather than crashing on 'process is not defined'
    return new GoogleGenAI({ apiKey: apiKey || 'MISSING_KEY' });
};

/**
 * Uses Gemini to understand complex user queries and map them to local catalog IDs.
 */
export const searchCatalogWithAI = async (query: string, availableMovies: Movie[]): Promise<{ matchedIds: string[], reasoning: string }> => {
  try {
    const ai = getAIClient();
    const movieContext = availableMovies.map(m => 
      `ID: ${m.id}, Title: ${m.title}, Genres: ${(Array.isArray(m.genres) ? m.genres : []).join(", ")}, Year: ${m.year}, Desc: ${m.description}, Lang: ${m.language}`
    ).join("\n");

    const systemInstruction = `You are a movie recommendation engine for a specific catalog of public domain movies. 
    Analyze the user's search query and the provided Movie List.
    Return the IDs of the movies that best match the query.
    If the user asks for a specific feeling (e.g., "scary"), infer genres.
    If the user asks for a plot detail, search descriptions.
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
            matchedIds: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "List of movie IDs that match the query"
            },
            reasoning: {
              type: Type.STRING,
              description: "A brief, friendly explanation of why these were chosen (max 1 sentence)."
            }
          },
          required: ["matchedIds", "reasoning"]
        }
      }
    });

    const jsonText = response.text || "{}";
    const result = JSON.parse(jsonText);
    
    return {
      matchedIds: result.matchedIds || [],
      reasoning: result.reasoning || "Here are some movies based on your search."
    };

  } catch (error) {
    console.error("Gemini Search Error:", error);
    return {
      matchedIds: [],
      reasoning: "AI search unavailable, using basic text match."
    };
  }
};

/**
 * Extracts metadata from a URL using search grounding.
 * UPDATED: Less strict on image quality to ensure we get *something*.
 */
export const extractMetadataFromUrl = async (url: string): Promise<Partial<Movie>> => {
  try {
    const ai = getAIClient();
    const prompt = `Use Google Search to find the details of the video at this specific URL: ${url}
    
    Tasks:
    1. Identify the exact Movie/Short Film title.
    2. Extract accurate info: Year, Director, Duration (Xh Ym), Language.
    3. Generate a compelling description based on the real content found.
    4. Categorize with standard genres.
    5. Find technical details: Cast members, Cinematographer, Music Composer.
    6. Identify underlying themes.
    7. FIND A POSTER URL: Search for ANY valid image URL representing the movie poster or a representative still frame. It does NOT need to be high quality. A small OMDb or Wikipedia thumbnail is fine.

    Return the data in a structured JSON format.`;

    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            description: { type: Type.STRING },
            year: { type: Type.NUMBER },
            director: { type: Type.STRING },
            genres: { type: Type.ARRAY, items: { type: Type.STRING } },
            duration: { type: Type.STRING },
            language: { type: Type.STRING },
            posterUrl: { type: Type.STRING, description: "A valid URL to a movie poster image." },
            cast: { type: Type.ARRAY, items: { type: Type.STRING } },
            cinematographers: { type: Type.ARRAY, items: { type: Type.STRING } },
            composers: { type: Type.ARRAY, items: { type: Type.STRING } },
            themes: { type: Type.ARRAY, items: { type: Type.STRING } }
          },
          required: ["title", "description", "year", "director", "genres", "duration", "language"]
        }
      }
    });

    const jsonText = response.text || "{}";
    return JSON.parse(jsonText);

  } catch (error) {
    console.error("Gemini Extraction Error:", error);
    throw error;
  }
};

/**
 * Generates sample subtitles using the Flash model.
 */
export const generateAISubtitles = async (movieTitle: string, language: string, plot: string): Promise<string> => {
  try {
    const ai = getAIClient();
    const prompt = `Generate a sample WebVTT subtitle file for the first 2 minutes of the movie "${movieTitle}". 
    The target language is "${language}".
    Based on the plot: "${plot}", create plausible opening dialogue.
    
    Format EXACTLY as WebVTT.`;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
    });

    return response.text || "";
  } catch (error) {
    console.error("Subtitle Generation Error:", error);
    return "WEBVTT\n\n00:00:01.000 --> 00:00:05.000\nError generating AI subtitles.";
  }
};

/**
 * Returns interesting trivia about a classic movie.
 */
export const generateMovieTrivia = async (title: string, year: number): Promise<string[]> => {
    try {
        const ai = getAIClient();
        const prompt = `Give me 4 interesting, lesser-known trivia facts about the movie "${title}" from ${year}. 
        Return ONLY a JSON array of strings.`;

        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING }
                }
            }
        });

        const text = response.text || "[]";
        return JSON.parse(text);
    } catch (e) {
        console.error("Error generating trivia", e);
        return ["Trivia currently unavailable for this title."];
    }
}

/**
 * Generates a deep critical analysis of the movie.
 */
export const generateCriticalAnalysis = async (title: string, year: number, language: string): Promise<string> => {
    try {
        const ai = getAIClient();
        const langInstruction = language === 'pt' ? 'in Portuguese' : 'in English';
        
        const prompt = `Write a deep, engaging critical analysis of the classic movie "${title}" (${year}) ${langInstruction}.
        
        Structure:
        1. **Why it's a Classic:** Historical significance.
        2. **Visual Style:** Cinematography and direction analysis.
        3. **Cultural Impact:** How it influenced cinema.
        
        Use Markdown formatting for headers and bold text. Keep it under 300 words.`;

        const response = await ai.models.generateContent({
            model: "gemini-3-pro-preview", 
            contents: prompt,
        });

        return response.text || "Analysis unavailable.";
    } catch (e) {
        return "Could not generate analysis at this time.";
    }
};

/**
 * Generates a summary of what critics thought about the movie.
 * Uses sites like Rotten Tomatoes, Metacritic, AdoroCinema concepts implicitly via training data.
 */
export const generateCriticsSummary = async (title: string, year: number, language: string): Promise<string> => {
    try {
        const ai = getAIClient();
        const langInstruction = language === 'pt' ? 'Responda em Português' : 'Answer in English';
        
        const prompt = `Act as a film critic aggregator. Analyze the critical reception of the movie "${title}" (${year}).
        ${langInstruction}.
        
        Cover the following:
        1. **General Consensus:** What did major critics (like Roger Ebert, Pauline Kael, or modern aggregators like Rotten Tomatoes/Metacritic) think?
        2. **Key Praises:** What aspects were praised? (Acting, Direction, Screenplay).
        3. **Key Criticisms:** What didn't age well or was disliked?
        4. **Legacy:** How is it viewed today?
        
        Mention specific review sources if possible (e.g., "Roger Ebert gave it 4 stars").
        Use Markdown.`;

        const response = await ai.models.generateContent({
            model: "gemini-3-pro-preview", 
            contents: prompt,
        });

        return response.text || "Critics summary unavailable.";
    } catch (e) {
        return "Could not fetch critics summary.";
    }
}

/**
 * Chat Stream for the Concierge
 */
export const createChatSession = (catalog: Movie[], language: string) => {
    const ai = getAIClient();
    
    // Create a mini-index for the system prompt
    const catalogSummary = catalog.map(m => `- ${m.title} (${m.year}): ${m.genres.join(', ')}`).join('\n');
    const langInstruction = language === 'pt' ? 'Responda sempre em Português.' : 'Answer in English.';

    const systemInstruction = `You are "Cine-Sage", a friendly and sophisticated expert on classic cinema.
    ${langInstruction}
    
    You have access to the following movies in our specific catalog:
    ${catalogSummary}
    
    Rules:
    1. If the user asks for a recommendation, prioritize movies FROM THIS LIST.
    2. If the user asks about general film history, answer freely using your knowledge.
    3. Keep answers concise (max 3 sentences unless asked for more).
    4. Be enthusiastic about black and white, silent, and golden age cinema.`;

    return ai.chats.create({
        model: "gemini-3-flash-preview",
        config: { systemInstruction }
    });
};