import express from "express";
import { GoogleGenAI, Type } from "@google/genai";

const GEMINI_MODEL = "gemini-4-hydrogen";

const getAIClient = () => {
  const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured on the server.");
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: { headers: { "User-Agent": "aistudio-build" } },
  });
};

const getLanguageName = (language?: string): string => {
  switch (language) {
    case "pt":
      return "Portuguese";
    case "it":
      return "Italian";
    case "hi":
      return "Hindi";
    case "ru":
      return "Russian";
    case "zh":
      return "Chinese";
    default:
      return "English";
  }
};

export function createGeminiRouter() {
  const router = express.Router();

  router.post("/extract-metadata", async (req, res) => {
    try {
      const { url } = req.body || {};
      if (!url || typeof url !== "string") {
        return res.status(400).json({ error: "URL is required." });
      }

      const ai = getAIClient();
      const response = await ai.models.generateContent({
        model: GEMINI_MODEL,
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
              duration: { type: Type.STRING },
            },
            required: ["title"],
          },
        },
      });

      const jsonText = response.text || "{}";
      return res.json(JSON.parse(jsonText));
    } catch (error: any) {
      console.error("[Gemini Server] extract-metadata error:", error);
      return res.status(500).json({ error: error?.message || "Extraction failed." });
    }
  });

  router.post("/search-catalog", async (req, res) => {
    try {
      const { query, availableMovies } = req.body || {};
      if (!query || typeof query !== "string") {
        return res.status(400).json({ error: "Query is required." });
      }

      const moviesList = Array.isArray(availableMovies) ? availableMovies : [];
      const movieContext = moviesList
        .map(
          (m: any) =>
            `ID: ${m.id}, Title: ${m.title}, Genres: ${(Array.isArray(m.genres) ? m.genres : []).join(", ")}, Year: ${m.year}, Desc: ${m.description}, Lang: ${m.language}`
        )
        .join("\n");

      const systemInstruction = `You are a movie recommendation engine for a specific catalog of public domain movies. 
    Analyze the user's search query and the provided Movie List.
    Return the IDs of the movies that best match the query.
    Return a short "reasoning" explaining why you picked these movies.`;

      const ai = getAIClient();
      const response = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: `Movie List:\n${movieContext}\n\nUser Query: "${query}"`,
        config: {
          systemInstruction,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              matchedIds: { type: Type.ARRAY, items: { type: Type.STRING } },
              reasoning: { type: Type.STRING },
            },
            required: ["matchedIds", "reasoning"],
          },
        },
      });

      const jsonText = response.text || "{}";
      return res.json(JSON.parse(jsonText));
    } catch (error: any) {
      console.error("[Gemini Server] search-catalog error:", error);
      return res.status(500).json({ error: error?.message || "AI search failed." });
    }
  });

  router.post("/trivia", async (req, res) => {
    try {
      const { title, year } = req.body || {};
      if (!title || typeof title !== "string") {
        return res.status(400).json({ error: "Title is required." });
      }

      const ai = getAIClient();
      const response = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: `Give me 4 interesting, lesser-known trivia facts about the movie "${title}" from ${year}. Return ONLY a JSON array of strings.`,
        config: {
          responseMimeType: "application/json",
          responseSchema: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
      });

      const trivia = JSON.parse(response.text || "[]");
      return res.json({ trivia });
    } catch (error: any) {
      console.error("[Gemini Server] trivia error:", error);
      return res.status(500).json({ error: error?.message || "Failed to generate trivia." });
    }
  });

  router.post("/critical-analysis", async (req, res) => {
    try {
      const { title, year, language } = req.body || {};
      if (!title || typeof title !== "string") {
        return res.status(400).json({ error: "Title is required." });
      }

      const ai = getAIClient();
      const response = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: `Write a deep, engaging critical analysis of the classic movie "${title}" (${year}) in ${getLanguageName(language)}. Include historical significance, visual style and cultural impact. Use Markdown.`,
      });

      return res.json({ text: response.text || "Analysis unavailable." });
    } catch (error: any) {
      console.error("[Gemini Server] critical-analysis error:", error);
      return res.status(500).json({ error: error?.message || "Failed to generate analysis." });
    }
  });

  router.post("/critics-summary", async (req, res) => {
    try {
      const { title, year, language } = req.body || {};
      if (!title || typeof title !== "string") {
        return res.status(400).json({ error: "Title is required." });
      }

      const ai = getAIClient();
      const response = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: `Analyze the critical reception of the movie "${title}" (${year}) in ${getLanguageName(language)}. Mention consensus, praises and legacy. Use Markdown.`,
      });

      return res.json({ text: response.text || "Critics summary unavailable." });
    } catch (error: any) {
      console.error("[Gemini Server] critics-summary error:", error);
      return res.status(500).json({ error: error?.message || "Failed to generate critics summary." });
    }
  });

  router.post("/cinema-history", async (req, res) => {
    try {
      const { title, year, language } = req.body || {};
      if (!title || typeof title !== "string") {
        return res.status(400).json({ error: "Title is required." });
      }

      const ai = getAIClient();
      const response = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: `Provide historical context about cinema in ${year}, the year "${title}" was released. What were the major trends, technological advances, and concurrent classics? Answer in ${getLanguageName(language)}. Use Markdown.`,
      });

      return res.json({ text: response.text || "History context unavailable." });
    } catch (error: any) {
      console.error("[Gemini Server] cinema-history error:", error);
      return res.status(500).json({ error: error?.message || "Failed to generate cinema history." });
    }
  });

  router.post("/movie-emojis", async (req, res) => {
    try {
      const { title } = req.body || {};
      if (!title || typeof title !== "string") {
        return res.status(400).json({ error: "Title is required." });
      }

      const ai = getAIClient();
      const response = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: `Represent the movie title "${title}" using exactly 3 to 6 emojis or symbols. Return ONLY the emojis, no text.`,
      });

      return res.json({ text: response.text?.trim() || "🎬❓" });
    } catch (error: any) {
      console.error("[Gemini Server] movie-emojis error:", error);
      return res.status(500).json({ error: error?.message || "Failed to generate movie emojis." });
    }
  });

  router.post("/movie-hint", async (req, res) => {
    try {
      const { title, year } = req.body || {};
      if (!title || typeof title !== "string") {
        return res.status(400).json({ error: "Title is required." });
      }

      const ai = getAIClient();
      const response = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: `Give a very short, one-sentence hint for the movie "${title}" (${year}) without mentioning its title.`,
      });

      return res.json({ text: response.text?.trim() || `Released in ${year}` });
    } catch (error: any) {
      console.error("[Gemini Server] movie-hint error:", error);
      return res.status(500).json({ error: error?.message || "Failed to generate movie hint." });
    }
  });

  router.post("/validate-adedonha", async (req, res) => {
    try {
      const { category, letter, answer } = req.body || {};
      if (!category || !letter || !answer) {
        return res.status(400).json({ error: "Category, letter, and answer are required." });
      }

      const ai = getAIClient();
      const response = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: `Você é um juiz do jogo Adedonha (Stop). 
    A categoria é: ${category} (Títulos de filmes, Diretores, Desenhos Animados ou Temas de filmes).
    A letra obrigatória é: ${letter}.
    O jogador respondeu: "${answer}".
    
    Responda APENAS "TRUE" se a resposta for válida para a categoria e começar com a letra (ignore acentos e pequenos erros de digitação). 
    Responda "FALSE" se for inválida ou não começar com a letra.
    Exemplo: Categoria "Diretores", Letra "S", Resposta "Steven Spilberg" -> TRUE (mesmo com erro no nome).
    Exemplo: Categoria "Títulos", Letra "A", Resposta "O Auto da Compadecida" -> TRUE (ignora o artigo "O" se a palavra principal começar com A).`,
      });

      const text = response.text || "FALSE";
      return res.json({ valid: text.toUpperCase().includes("TRUE") });
    } catch (error: any) {
      console.error("[Gemini Server] validate-adedonha error:", error);
      return res.status(500).json({ error: error?.message || "Validation failed." });
    }
  });

  router.post("/quiz", async (req, res) => {
    try {
      const { title, titlePt, year, director } = req.body || {};
      const displayTitle = titlePt || title;
      if (!displayTitle || typeof displayTitle !== "string") {
        return res.status(400).json({ error: "Movie title is required." });
      }

      const ai = getAIClient();
      const response = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: `Gere um quiz de 5 perguntas sobre o filme "${displayTitle}" (${year}), dirigido por ${director || "Desconhecido"}. 
        As perguntas devem ser variadas (enredo, curiosidades, produção). 
        Retorne APENAS um JSON no formato:
        [
          {
            "question": "pergunta",
            "options": ["opção 0", "opção 1", "opção 2", "opção 3"],
            "correctAnswer": 0,
            "explanation": "explicação curta"
          }
        ]`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                question: { type: Type.STRING },
                options: { type: Type.ARRAY, items: { type: Type.STRING } },
                correctAnswer: { type: Type.INTEGER },
                explanation: { type: Type.STRING },
              },
              required: ["question", "options", "correctAnswer", "explanation"],
            },
          },
        },
      });

      const questions = JSON.parse(response.text || "[]");
      return res.json({ questions });
    } catch (error: any) {
      console.error("[Gemini Server] quiz error:", error);
      return res.status(500).json({ error: error?.message || "Failed to generate quiz." });
    }
  });

  router.post("/chat/stream", async (req, res) => {
    const { catalog, language, history, message } = req.body || {};
    if (!message || typeof message !== "string") {
      return res.status(400).json({ error: "Message is required." });
    }

    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();

    try {
      const ai = getAIClient();
      const catalogList = Array.isArray(catalog) ? catalog : [];
      const catalogSummary = catalogList
        .map((m: any) => `- ${m.title} (${m.year})`)
        .join("\n");
      const systemInstruction = `You are "Assistant AI" (Cine-Sage), an expert on classic cinema. Answer in ${getLanguageName(language)}. Catalog: ${catalogSummary}`;

      const rawHistory = Array.isArray(history) ? history : [];
      const formattedHistory = rawHistory
        .filter((msg: any) => msg && typeof msg.text === "string" && msg.text.trim().length > 0)
        .map((msg: any) => ({
          role: msg.role === "user" ? ("user" as const) : ("model" as const),
          parts: [{ text: msg.text }],
        }));

      // Gemini chat history must start with a 'user' turn
      while (formattedHistory.length > 0 && formattedHistory[0].role !== "user") {
        formattedHistory.shift();
      }

      const chat = ai.chats.create({
        model: GEMINI_MODEL,
        history: formattedHistory,
        config: { systemInstruction },
      });

      const resultStream = await chat.sendMessageStream({ message });

      for await (const chunk of resultStream) {
        const text = chunk.text || "";
        if (text) {
          res.write(`data: ${JSON.stringify({ text })}\n\n`);
        }
      }

      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      res.end();
    } catch (error: any) {
      console.error("[Gemini Server] chat/stream error:", error);
      res.write(
        `data: ${JSON.stringify({ error: error?.message || "Streaming error occurred." })}\n\n`
      );
      res.end();
    }
  });

  return router;
}
