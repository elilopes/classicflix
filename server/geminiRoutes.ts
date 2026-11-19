import express from "express";
import { GoogleGenAI, Type } from "@google/genai";
import {
  callRapidAiFallback,
  parseFallbackJson,
  RapidAiFallbackRequest,
  shouldTriggerAiFallback,
} from "./rapidAiFallback.ts";
import {
  buildNodeCinemaHistory,
  buildNodeCriticalAnalysis,
  buildNodeCriticsSummary,
  buildNodeTrivia,
  findNodeDirector,
  findNodeLanguage,
  findNodeYear,
} from "./movieKnowledgeFallback.ts";

const GEMINI_MODEL = "gemini-4-hydrogen";

interface GeminiClientCandidate {
  apiKey: string;
  label: string;
  referer?: string;
}

const getDefaultAppReferer = (req?: express.Request): string => {
  const fromReq =
    (typeof req?.headers?.referer === "string" && req.headers.referer) ||
    (typeof req?.headers?.origin === "string" && req.headers.origin) ||
    "";
  if (fromReq) return fromReq;
  if (process.env.APP_URL) return process.env.APP_URL;
  return "https://ais-dev-rketbkfc2ioywj5ptq55cf-18401513977.us-west1.run.app/";
};

const getGeminiClientCandidates = (req?: express.Request): GeminiClientCandidate[] => {
  const rawEntries: Array<{ label: string; value?: string }> = [
    { label: "GEMINI_API_KEY", value: process.env.GEMINI_API_KEY },
    { label: "API_KEY", value: process.env.API_KEY },
    { label: "VITE_GEMINI_API_KEY", value: process.env.VITE_GEMINI_API_KEY },
    { label: "NEXT_PUBLIC_GEMINI_API_KEY", value: process.env.NEXT_PUBLIC_GEMINI_API_KEY },
  ];

  const uniqueKeys: Array<{ label: string; apiKey: string }> = [];
  const seenKeys = new Set<string>();
  for (const entry of rawEntries) {
    const cleaned = (entry.value || "").trim();
    if (!cleaned || seenKeys.has(cleaned)) continue;
    seenKeys.add(cleaned);
    uniqueKeys.push({ label: entry.label, apiKey: cleaned });
  }

  if (uniqueKeys.length === 0) {
    throw new Error("GEMINI_API_KEY is not configured in Settings > Secrets on the server.");
  }

  const referer = getDefaultAppReferer(req);
  const candidates: GeminiClientCandidate[] = [];
  for (const k of uniqueKeys) {
    candidates.push({ apiKey: k.apiKey, label: k.label });
    if (referer) {
      candidates.push({ apiKey: k.apiKey, label: `${k.label}+referer`, referer });
    }
  }
  return candidates;
};

const createGeminiClient = (candidate: GeminiClientCandidate) => {
  const headers: Record<string, string> = { "User-Agent": "aistudio-build" };
  if (candidate.referer) {
    headers["Referer"] = candidate.referer;
  }
  return new GoogleGenAI({
    apiKey: candidate.apiKey,
    httpOptions: { headers },
  });
};

const sanitizeErrorText = (text: string): string =>
  text
    .replace(/AIza[0-9A-Za-z_-]{15,}/g, "[GEMINI_KEY]")
    .replace(/sk-ant-[0-9A-Za-z_-]{10,}/g, "[ANTHROPIC_KEY]")
    .replace(/[0-9a-f]{10}msh[0-9a-zA-Z]{10,}/g, "[RAPID_KEY]");

const handleGeminiRouteError = (
  res: express.Response,
  routeName: string,
  error: any,
  fallbackMessage: string
) => {
  console.error(`[Gemini Server] ${routeName} error:`, error);
  const rawMessage = sanitizeErrorText(String(error?.message || fallbackMessage));
  if (rawMessage.includes("GEMINI_API_KEY is not configured") && !rawMessage.includes("fallback falhou")) {
    return res
      .status(503)
      .json({ error: "Chave GEMINI_API_KEY não configurada no servidor (Settings > Secrets).", details: rawMessage });
  }
  const statusCode = Number(error?.status || error?.statusCode) || 500;
  if (
    statusCode === 403 ||
    statusCode === 401 ||
    rawMessage.toLowerCase().includes("forbidden") ||
    rawMessage.toLowerCase().includes("permission_denied") ||
    rawMessage.toLowerCase().includes("api key")
  ) {
    return res.status(403).json({
      error:
        "Erro 403 (Acesso Negado): As chaves de IA configuradas (Gemini, Anthropic e RapidAPI) expiraram, estão restritas ou sem permissão para este modelo. Verifique Settings > Secrets.",
      details: rawMessage,
    });
  }
  if (
    statusCode === 429 ||
    rawMessage.toLowerCase().includes("quota") ||
    rawMessage.toLowerCase().includes("rate limit")
  ) {
    return res.status(429).json({
      error:
        "Limite de cota da API Gemini atingido e provedores de fallback indisponíveis. Tente novamente em instantes.",
      details: rawMessage,
    });
  }
  return res
    .status(statusCode >= 400 && statusCode < 600 ? statusCode : 500)
    .json({ error: rawMessage, details: rawMessage });
};

const executeGeminiAcrossKeys = async <T>(
  req: express.Request | undefined,
  primaryFn: (ai: GoogleGenAI) => Promise<T>
): Promise<T> => {
  const candidates = getGeminiClientCandidates(req);
  let lastError: any = null;
  const attemptErrors: string[] = [];

  for (const candidate of candidates) {
    try {
      const ai = createGeminiClient(candidate);
      return await primaryFn(ai);
    } catch (err: any) {
      lastError = err;
      const errMsg = sanitizeErrorText(String(err?.message || err || ""));
      const status = Number(err?.status || err?.statusCode) || 0;
      console.warn(`[Gemini Server] Tentativa ${candidate.label} falhou (${status || "err"}): ${errMsg}`);
      attemptErrors.push(`${candidate.label}(${status || "err"}): ${errMsg.slice(0, 180)}`);
    }
  }

  const aggError: any = new Error(attemptErrors.join(" ; ") || lastError?.message || "Falha ao chamar Gemini API.");
  aggError.status = lastError?.status || lastError?.statusCode;
  throw aggError;
};

const runWithRapidFallback = async <T>(params: {
  req?: express.Request;
  routeName: string;
  primaryFn: (ai: GoogleGenAI) => Promise<T>;
  fallbackRequest: RapidAiFallbackRequest;
  parseFallback: (rawText: string) => T;
}): Promise<T> => {
  try {
    return await executeGeminiAcrossKeys(params.req, params.primaryFn);
  } catch (primaryError: any) {
    if (!shouldTriggerAiFallback(primaryError)) {
      throw primaryError;
    }

    console.warn(
      `[Gemini Server] ${params.routeName} indisponível/cota/permissão (${
        primaryError?.message || primaryError
      }). Acionando fallback Anthropic/RapidAPI...`
    );

    try {
      const fallbackRes = await callRapidAiFallback(params.fallbackRequest);
      return params.parseFallback(fallbackRes.text);
    } catch (fallbackError: any) {
      const combinedError: any = new Error(
        `Provedor principal falhou (${primaryError?.message || primaryError}) e fallback falhou (${
          fallbackError?.message || fallbackError
        })`
      );
      combinedError.status = primaryError?.status || primaryError?.statusCode || 503;
      throw combinedError;
    }
  }
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

      const prompt = `Extract movie or series metadata from this URL: ${url}. 
      If the URL is from Wikidata, IMDb, TMDb, or Archive.org, use your internal knowledge to provide complete details for that specific production.
      If you can identify the movie from the URL, provide its details even if they are not explicitly on the page.
      Focus on: title, year, director, cast, genres, themes, and a good description.
      Return a JSON object with keys: title, year (integer), description, director, genres (string[]), themes (string[]), cast (string[]), type ('Movie' or 'Series'), language, rating, duration.`;

      const result = await runWithRapidFallback({
        req,
        routeName: "extract-metadata",
        primaryFn: async (ai) => {
          const response = await ai.models.generateContent({
            model: GEMINI_MODEL,
            contents: prompt,
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
          return JSON.parse(response.text || "{}");
        },
        fallbackRequest: { prompt, expectJson: true },
        parseFallback: (raw) => parseFallbackJson(raw),
      });

      return res.json(result);
    } catch (error: any) {
      return handleGeminiRouteError(res, "extract-metadata", error, "Extraction failed.");
    }
  });

  router.post("/search-catalog", async (req, res) => {
    try {
      const { query, availableMovies } = req.body || {};
      if (!query || typeof query !== "string") {
        return res.status(400).json({ error: "Query is required." });
      }

      const moviesList = Array.isArray(availableMovies) ? availableMovies : [];
      const slicedMovies = moviesList.slice(0, 250);
      const movieContext = slicedMovies
        .map(
          (m: any) =>
            `ID: ${m.id} | Title: ${m.title}${m.titlePt ? ` (${m.titlePt})` : ""} | Dir: ${
              m.director || "Unknown"
            } | Genres: ${(Array.isArray(m.genres) ? m.genres : []).join(", ")} | Themes: ${(Array.isArray(
              m.themes
            )
              ? m.themes
              : []
            ).join(", ")} | Year: ${m.year} | Lang: ${m.language} | Desc: ${String(
              m.description || ""
            ).slice(0, 140)}`
        )
        .join("\n");

      const systemInstruction = `You are a movie recommendation engine for a specific catalog of public domain movies. 
    Analyze the user's search query and the provided Movie List.
    Match by title (English or Portuguese), director, genre, theme, year/era, language, or plot semantics.
    Return the exact IDs of the movies that best match the query (up to 30 best matches).
    Return a short "reasoning" in the same language as the query explaining why you picked these movies.
    Return ONLY JSON: { "matchedIds": string[], "reasoning": string }.`;

      const contents = `Movie List:\n${movieContext}\n\nUser Query: "${query}"`;

      const result = await runWithRapidFallback({
        req,
        routeName: "search-catalog",
        primaryFn: async (ai) => {
          const response = await ai.models.generateContent({
            model: GEMINI_MODEL,
            contents,
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
          return JSON.parse(response.text || "{}");
        },
        fallbackRequest: { systemInstruction, prompt: contents, expectJson: true },
        parseFallback: (raw) => {
          const parsed = parseFallbackJson<{ matchedIds?: string[]; reasoning?: string }>(raw);
          return {
            matchedIds: Array.isArray(parsed?.matchedIds) ? parsed.matchedIds : [],
            reasoning: typeof parsed?.reasoning === "string" ? parsed.reasoning : "",
          };
        },
      });

      return res.json(result);
    } catch (error: any) {
      return handleGeminiRouteError(res, "search-catalog", error, "AI search failed.");
    }
  });

  router.post("/find-director", async (req, res) => {
    try {
      const { title, year, wikidataId } = req.body || {};
      if (!title || typeof title !== "string") {
        return res.status(400).json({ error: "Title is required." });
      }

      const nodeDir = await findNodeDirector(title, year, wikidataId).catch(() => null);
      if (nodeDir?.director && nodeDir.director.toLowerCase() !== "unknown") {
        return res.json(nodeDir);
      }

      const prompt = `Who directed the film/production "${title}"${
        year ? ` (${year})` : ""
      }? If uncertain or unknown, return "Unknown". Return ONLY JSON {"director": "Name"} with the director's full name(s) separated by comma.`;

      try {
        const result = await runWithRapidFallback({
          req,
          routeName: "find-director",
          primaryFn: async (ai) => {
            const response = await ai.models.generateContent({
              model: GEMINI_MODEL,
              contents: prompt,
              config: {
                responseMimeType: "application/json",
                responseSchema: {
                  type: Type.OBJECT,
                  properties: {
                    director: { type: Type.STRING },
                  },
                  required: ["director"],
                },
              },
            });
            const parsed = JSON.parse(response.text || "{}");
            return { director: parsed.director || "Unknown" };
          },
          fallbackRequest: { prompt, expectJson: true },
          parseFallback: (raw) => {
            const parsed = parseFallbackJson<{ director?: string }>(raw);
            return { director: parsed.director || "Unknown" };
          },
        });
        return res.json(result);
      } catch {
        return res.json({ director: "Unknown" });
      }
    } catch (error: any) {
      return handleGeminiRouteError(res, "find-director", error, "Failed to identify director.");
    }
  });

  router.post("/find-year", async (req, res) => {
    try {
      const { title, wikidataId } = req.body || {};
      if (!title || typeof title !== "string") {
        return res.status(400).json({ error: "Title is required." });
      }

      const nodeYear = await findNodeYear(title, wikidataId).catch(() => null);
      if (nodeYear?.year) {
        return res.json(nodeYear);
      }

      const prompt = `What is the original release year (4-digit integer) of the film/production "${title}"? If unknown, return 0. Return ONLY JSON {"year": 1950}.`;

      const parseYear = (val: unknown): number | null => {
        const yearNum = Number(val);
        return Number.isFinite(yearNum) && yearNum > 1880 && yearNum <= new Date().getFullYear() + 2
          ? yearNum
          : null;
      };

      try {
        const result = await runWithRapidFallback({
          req,
          routeName: "find-year",
          primaryFn: async (ai) => {
            const response = await ai.models.generateContent({
              model: GEMINI_MODEL,
              contents: prompt,
              config: {
                responseMimeType: "application/json",
                responseSchema: {
                  type: Type.OBJECT,
                  properties: {
                    year: { type: Type.INTEGER },
                  },
                  required: ["year"],
                },
              },
            });
            const parsed = JSON.parse(response.text || "{}");
            return { year: parseYear(parsed.year) };
          },
          fallbackRequest: { prompt, expectJson: true },
          parseFallback: (raw) => {
            const parsed = parseFallbackJson<{ year?: number }>(raw);
            return { year: parseYear(parsed.year) };
          },
        });
        return res.json(result);
      } catch {
        return res.json({ year: null });
      }
    } catch (error: any) {
      return handleGeminiRouteError(res, "find-year", error, "Failed to identify release year.");
    }
  });

  router.post("/find-language", async (req, res) => {
    try {
      const { title, wikidataId } = req.body || {};
      if (!title || typeof title !== "string") {
        return res.status(400).json({ error: "Title is required." });
      }

      const nodeLang = await findNodeLanguage(title, wikidataId).catch(() => null);
      if (nodeLang?.language && nodeLang.language.toLowerCase() !== "unknown") {
        return res.json(nodeLang);
      }

      const prompt = `What is the primary original language in English (e.g., "English", "Portuguese", "French", "German", "Silent") of the film/production "${title}"? If unknown, return "Unknown". Return ONLY JSON {"language": "English"}.`;

      try {
        const result = await runWithRapidFallback({
          req,
          routeName: "find-language",
          primaryFn: async (ai) => {
            const response = await ai.models.generateContent({
              model: GEMINI_MODEL,
              contents: prompt,
              config: {
                responseMimeType: "application/json",
                responseSchema: {
                  type: Type.OBJECT,
                  properties: {
                    language: { type: Type.STRING },
                  },
                  required: ["language"],
                },
              },
            });
            const parsed = JSON.parse(response.text || "{}");
            return { language: parsed.language || "Unknown" };
          },
          fallbackRequest: { prompt, expectJson: true },
          parseFallback: (raw) => {
            const parsed = parseFallbackJson<{ language?: string }>(raw);
            return { language: parsed.language || "Unknown" };
          },
        });
        return res.json(result);
      } catch {
        return res.json({ language: "Unknown" });
      }
    } catch (error: any) {
      return handleGeminiRouteError(res, "find-language", error, "Failed to identify language.");
    }
  });

  router.post("/trivia", async (req, res) => {
    try {
      const { title, year, language, wikidataId } = req.body || {};
      if (!title || typeof title !== "string") {
        return res.status(400).json({ error: "Title is required." });
      }

      const nodeTrivia = await buildNodeTrivia({ title, year, language, wikidataId }).catch(() => null);
      if (nodeTrivia && nodeTrivia.length >= 1) {
        return res.json({ trivia: nodeTrivia });
      }

      const prompt = `Give me 4 interesting, lesser-known trivia facts about the movie "${title}" from ${year}. Return ONLY a JSON array of strings.`;

      try {
        const result = await runWithRapidFallback({
          req,
          routeName: "trivia",
          primaryFn: async (ai) => {
            const response = await ai.models.generateContent({
              model: GEMINI_MODEL,
              contents: prompt,
              config: {
                responseMimeType: "application/json",
                responseSchema: { type: Type.ARRAY, items: { type: Type.STRING } },
              },
            });
            const trivia = JSON.parse(response.text || "[]");
            return { trivia };
          },
          fallbackRequest: { prompt, expectJson: true },
          parseFallback: (raw) => {
            const parsed = parseFallbackJson<any>(raw);
            const trivia = Array.isArray(parsed)
              ? parsed
              : Array.isArray(parsed?.trivia)
                ? parsed.trivia
                : [];
            return { trivia: trivia.map(String) };
          },
        });
        return res.json(result);
      } catch (aiErr) {
        if (nodeTrivia && nodeTrivia.length > 0) {
          return res.json({ trivia: nodeTrivia });
        }
        throw aiErr;
      }
    } catch (error: any) {
      return handleGeminiRouteError(res, "trivia", error, "Failed to generate trivia.");
    }
  });

  router.post("/critical-analysis", async (req, res) => {
    try {
      const { title, year, language, wikidataId } = req.body || {};
      if (!title || typeof title !== "string") {
        return res.status(400).json({ error: "Title is required." });
      }
      const prompt = `Write a deep, engaging critical analysis of the classic movie "${title}" (${year}) in ${getLanguageName(
        language
      )}. Include historical significance, visual style and cultural impact. Use Markdown.`;

      try {
        const result = await runWithRapidFallback({
          req,
          routeName: "critical-analysis",
          primaryFn: async (ai) => {
            const response = await ai.models.generateContent({
              model: GEMINI_MODEL,
              contents: prompt,
            });
            return { text: response.text || "Analysis unavailable." };
          },
          fallbackRequest: { prompt, expectJson: false },
          parseFallback: (raw) => ({ text: raw || "Analysis unavailable." }),
        });
        return res.json(result);
      } catch (aiErr) {
        const nodeAnalysis = await buildNodeCriticalAnalysis({ title, year, language, wikidataId }).catch(
          () => null
        );
        if (nodeAnalysis && nodeAnalysis.trim().length >= 40) {
          return res.json({ text: nodeAnalysis });
        }
        throw aiErr;
      }
    } catch (error: any) {
      return handleGeminiRouteError(res, "critical-analysis", error, "Failed to generate analysis.");
    }
  });

  router.post("/critics-summary", async (req, res) => {
    try {
      const { title, year, language, wikidataId, director } = req.body || {};
      if (!title || typeof title !== "string") {
        return res.status(400).json({ error: "Title is required." });
      }

      const nodeCritics = await buildNodeCriticsSummary({
        title,
        year,
        language,
        wikidataId,
        director,
      }).catch(() => null);
      if (nodeCritics && nodeCritics.trim().length >= 80) {
        return res.json({ text: nodeCritics });
      }

      const prompt = `Analyze the critical reception of the movie "${title}" (${year}) in ${getLanguageName(
        language
      )}. Mention consensus, praises and legacy. Use Markdown.`;

      try {
        const result = await runWithRapidFallback({
          req,
          routeName: "critics-summary",
          primaryFn: async (ai) => {
            const response = await ai.models.generateContent({
              model: GEMINI_MODEL,
              contents: prompt,
            });
            return { text: response.text || "Critics summary unavailable." };
          },
          fallbackRequest: { prompt, expectJson: false },
          parseFallback: (raw) => ({ text: raw || "Critics summary unavailable." }),
        });
        return res.json(result);
      } catch (aiErr) {
        if (nodeCritics && nodeCritics.trim().length > 0) {
          return res.json({ text: nodeCritics });
        }
        throw aiErr;
      }
    } catch (error: any) {
      return handleGeminiRouteError(
        res,
        "critics-summary",
        error,
        "Failed to generate critics summary."
      );
    }
  });

  router.post("/cinema-history", async (req, res) => {
    try {
      const { title, year, language, wikidataId } = req.body || {};
      if (!title || typeof title !== "string") {
        return res.status(400).json({ error: "Title is required." });
      }

      const nodeHistory = await buildNodeCinemaHistory({ title, year, language, wikidataId }).catch(
        () => null
      );
      if (nodeHistory && nodeHistory.trim().length >= 80) {
        return res.json({ text: nodeHistory });
      }

      const prompt = `Provide historical context about cinema in ${year}, the year "${title}" was released. What were the major trends, technological advances, and concurrent classics? Answer in ${getLanguageName(
        language
      )}. Use Markdown.`;

      try {
        const result = await runWithRapidFallback({
          req,
          routeName: "cinema-history",
          primaryFn: async (ai) => {
            const response = await ai.models.generateContent({
              model: GEMINI_MODEL,
              contents: prompt,
            });
            return { text: response.text || "History context unavailable." };
          },
          fallbackRequest: { prompt, expectJson: false },
          parseFallback: (raw) => ({ text: raw || "History context unavailable." }),
        });
        return res.json(result);
      } catch (aiErr) {
        if (nodeHistory && nodeHistory.trim().length > 0) {
          return res.json({ text: nodeHistory });
        }
        throw aiErr;
      }
    } catch (error: any) {
      return handleGeminiRouteError(
        res,
        "cinema-history",
        error,
        "Failed to generate cinema history."
      );
    }
  });

  router.post("/movie-emojis", async (req, res) => {
    try {
      const { title } = req.body || {};
      if (!title || typeof title !== "string") {
        return res.status(400).json({ error: "Title is required." });
      }
      const prompt = `Represent the movie title "${title}" using exactly 3 to 6 emojis or symbols. Return ONLY the emojis, no text.`;

      const result = await runWithRapidFallback({
        req,
        routeName: "movie-emojis",
        primaryFn: async (ai) => {
          const response = await ai.models.generateContent({
            model: GEMINI_MODEL,
            contents: prompt,
          });
          return { text: response.text?.trim() || "🎬❓" };
        },
        fallbackRequest: { prompt, expectJson: false },
        parseFallback: (raw) => ({ text: raw.trim() || "🎬❓" }),
      });

      return res.json(result);
    } catch (error: any) {
      return handleGeminiRouteError(
        res,
        "movie-emojis",
        error,
        "Failed to generate movie emojis."
      );
    }
  });

  router.post("/movie-hint", async (req, res) => {
    try {
      const { title, year } = req.body || {};
      if (!title || typeof title !== "string") {
        return res.status(400).json({ error: "Title is required." });
      }
      const prompt = `Give a very short, one-sentence hint for the movie "${title}" (${year}) without mentioning its title.`;

      const result = await runWithRapidFallback({
        req,
        routeName: "movie-hint",
        primaryFn: async (ai) => {
          const response = await ai.models.generateContent({
            model: GEMINI_MODEL,
            contents: prompt,
          });
          return { text: response.text?.trim() || `Released in ${year}` };
        },
        fallbackRequest: { prompt, expectJson: false },
        parseFallback: (raw) => ({ text: raw.trim() || `Released in ${year}` }),
      });

      return res.json(result);
    } catch (error: any) {
      return handleGeminiRouteError(res, "movie-hint", error, "Failed to generate movie hint.");
    }
  });

  router.post("/validate-adedonha", async (req, res) => {
    try {
      const { category, letter, answer } = req.body || {};
      if (!category || !letter || !answer) {
        return res.status(400).json({ error: "Category, letter, and answer are required." });
      }
      const prompt = `Você é um juiz do jogo Adedonha (Stop). 
    A categoria é: ${category} (Títulos de filmes, Diretores, Desenhos Animados ou Temas de filmes).
    A letra obrigatória é: ${letter}.
    O jogador respondeu: "${answer}".
    
    Responda APENAS "TRUE" se a resposta for válida para a categoria e começar com a letra (ignore acentos e pequenos erros de digitação). 
    Responda "FALSE" se for inválida ou não começar com a letra.
    Exemplo: Categoria "Diretores", Letra "S", Resposta "Steven Spilberg" -> TRUE (mesmo com erro no nome).
    Exemplo: Categoria "Títulos", Letra "A", Resposta "O Auto da Compadecida" -> TRUE (ignora o artigo "O" se a palavra principal começar com A).`;

      const result = await runWithRapidFallback({
        req,
        routeName: "validate-adedonha",
        primaryFn: async (ai) => {
          const response = await ai.models.generateContent({
            model: GEMINI_MODEL,
            contents: prompt,
          });
          const text = response.text || "FALSE";
          return { valid: text.toUpperCase().includes("TRUE") };
        },
        fallbackRequest: { prompt, expectJson: false },
        parseFallback: (raw) => ({ valid: raw.toUpperCase().includes("TRUE") }),
      });

      return res.json(result);
    } catch (error: any) {
      return handleGeminiRouteError(res, "validate-adedonha", error, "Validation failed.");
    }
  });

  router.post("/quiz", async (req, res) => {
    try {
      const { title, titlePt, year, director } = req.body || {};
      const displayTitle = titlePt || title;
      if (!displayTitle || typeof displayTitle !== "string") {
        return res.status(400).json({ error: "Movie title is required." });
      }
      const prompt = `Gere um quiz de 5 perguntas sobre o filme "${displayTitle}" (${year}), dirigido por ${
        director || "Desconhecido"
      }. 
        As perguntas devem ser variadas (enredo, curiosidades, produção). 
        Retorne APENAS um JSON no formato:
        [
          {
            "question": "pergunta",
            "options": ["opção 0", "opção 1", "opção 2", "opção 3"],
            "correctAnswer": 0,
            "explanation": "explicação curta"
          }
        ]`;

      const result = await runWithRapidFallback({
        req,
        routeName: "quiz",
        primaryFn: async (ai) => {
          const response = await ai.models.generateContent({
            model: GEMINI_MODEL,
            contents: prompt,
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
          return { questions };
        },
        fallbackRequest: { prompt, expectJson: true },
        parseFallback: (raw) => {
          const parsed = parseFallbackJson<any>(raw);
          const questions = Array.isArray(parsed)
            ? parsed
            : Array.isArray(parsed?.questions)
              ? parsed.questions
              : [];
          return { questions };
        },
      });

      return res.json(result);
    } catch (error: any) {
      return handleGeminiRouteError(res, "quiz", error, "Failed to generate quiz.");
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

    const catalogList = Array.isArray(catalog) ? catalog : [];
    const catalogSummary = catalogList
      .map((m: any) => `- ${m.title} (${m.year})`)
      .join("\n");
    const systemInstruction = `You are "Assistant AI" (Cine-Sage), an expert on classic cinema. Answer in ${getLanguageName(
      language
    )}. Catalog: ${catalogSummary}`;

    const rawHistory = Array.isArray(history) ? history : [];
    const cleanHistory = rawHistory.filter(
      (msg: any) => msg && typeof msg.text === "string" && msg.text.trim().length > 0
    );

    let streamedAnyChunk = false;

    try {
      const formattedHistory = cleanHistory.map((msg: any) => ({
        role: msg.role === "user" ? ("user" as const) : ("model" as const),
        parts: [{ text: msg.text }],
      }));

      // Gemini chat history must start with a 'user' turn
      while (formattedHistory.length > 0 && formattedHistory[0].role !== "user") {
        formattedHistory.shift();
      }

      await executeGeminiAcrossKeys(req, async (ai) => {
        const chat = ai.chats.create({
          model: GEMINI_MODEL,
          history: formattedHistory,
          config: { systemInstruction },
        });

        const resultStream = await chat.sendMessageStream({ message });

        for await (const chunk of resultStream) {
          const text = chunk.text || "";
          if (text) {
            streamedAnyChunk = true;
            res.write(`data: ${JSON.stringify({ text })}\n\n`);
          }
        }
      });

      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      res.end();
    } catch (error: any) {
      if (!streamedAnyChunk && shouldTriggerAiFallback(error)) {
        console.warn(
          `[Gemini Server] chat/stream indisponível/cota (${
            error?.message || error
          }). Acionando fallback RapidAPI...`
        );
        try {
          const fallbackMessages = [
            ...cleanHistory.map((msg: any) => ({
              role: msg.role === "user" ? ("user" as const) : ("assistant" as const),
              content: msg.text,
            })),
            { role: "user" as const, content: message },
          ];
          const fallbackRes = await callRapidAiFallback({
            systemInstruction,
            messages: fallbackMessages,
            expectJson: false,
          });
          res.write(`data: ${JSON.stringify({ text: fallbackRes.text })}\n\n`);
          res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
          res.end();
          return;
        } catch (fallbackErr: any) {
          console.error("[Gemini Server] chat/stream fallback error:", fallbackErr);
          res.write(
            `data: ${JSON.stringify({
              error: fallbackErr?.message || error?.message || "Streaming error occurred.",
            })}\n\n`
          );
          res.end();
          return;
        }
      }

      console.error("[Gemini Server] chat/stream error:", error);
      res.write(
        `data: ${JSON.stringify({ error: error?.message || "Streaming error occurred." })}\n\n`
      );
      res.end();
    }
  });

  return router;
}
