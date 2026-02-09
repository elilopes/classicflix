import { GoogleGenAI, Type } from "@google/genai";
import { Movie } from "../types";

// Helper to initialize the AI client using process.env.API_KEY directly as per guidelines
const getAIClient = () => {
    return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

// Fix: Added missing export for extractMetadataFromUrl requested in AddMovieModal.tsx
export const extractMetadataFromUrl = async (url: string): Promise<Partial<Movie>> => {
  try {
    const ai = getAIClient();
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: `Extract movie or series metadata from this URL: ${url}. If you can identify the movie from the URL, provide its details.`,
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
        const ai = getAIClient();
        const response = await ai.models.generateContent({
            model: "gemini-3-pro-preview", 
            contents: `Write a deep, engaging critical analysis of the classic movie "${title}" (${year}) in ${language === 'pt' ? 'Portuguese' : 'English'}. Include historical significance, visual style and cultural impact. Use Markdown.`,
        });
        return response.text || "Analysis unavailable.";
    } catch (e) { return "Could not generate analysis."; }
};

export const generateCriticsSummary = async (title: string, year: number, language: string): Promise<string> => {
    try {
        const ai = getAIClient();
        const response = await ai.models.generateContent({
            model: "gemini-3-pro-preview", 
            contents: `Analyze the critical reception of the movie "${title}" (${year}) in ${language === 'pt' ? 'Portuguese' : 'English'}. Mention consensus, praises and legacy. Use Markdown.`,
        });
        return response.text || "Critics summary unavailable.";
    } catch (e) { return "Could not fetch critics summary."; }
}

export const generateCinemaHistory = async (title: string, year: number, language: string): Promise<string> => {
    try {
        const ai = getAIClient();
        const response = await ai.models.generateContent({
            model: "gemini-3-pro-preview", 
            contents: `Provide historical context about cinema in ${year}, the year "${title}" was released. What were the major trends, technological advances, and concurrent classics? Answer in ${language === 'pt' ? 'Portuguese' : 'English'}. Use Markdown.`,
        });
        return response.text || "History context unavailable.";
    } catch (e) { return "Could not generate cinema history."; }
}

export const createChatSession = (catalog: Movie[], language: string) => {
    const ai = getAIClient();
    const catalogSummary = catalog.map(m => `- ${m.title} (${m.year})`).join('\n');
    const systemInstruction = `You are "Cine-Sage", an expert on classic cinema. Answer in ${language === 'pt' ? 'Portuguese' : 'English'}. Catalog: ${catalogSummary}`;
    return ai.chats.create({
        model: "gemini-3-flash-preview",
        config: { systemInstruction }
    });
};