import express from "express";

const DEFAULT_RAPID_API_KEY = "8d0b2005e5msh7794ca50aee0eb4p14f460jsn249cb3b9d70b";
const DEFAULT_TRANSLATE_HOST = "google-translate113.p.rapidapi.com";

// Cache em memória no servidor Node.js para evitar chamadas repetidas de rótulos/gêneros idênticos
const translationCache = new Map<string, string>();
const MAX_CACHE_SIZE = 5000;

const getRapidApiKey = (): string =>
  process.env.RAPID_API_KEY || process.env.VITE_RAPID_API_KEY || DEFAULT_RAPID_API_KEY;

const getTranslateHost = (): string =>
  process.env.RAPID_API_HOST_TRANSLATE || DEFAULT_TRANSLATE_HOST;

const extractTranslatedText = (payload: any): string | null => {
  if (!payload) return null;
  if (typeof payload === "string") return payload.trim() || null;
  if (typeof payload.trans === "string" && payload.trans.trim()) return payload.trans.trim();
  if (typeof payload.translatedText === "string" && payload.translatedText.trim()) {
    return payload.translatedText.trim();
  }
  if (typeof payload.translated_text === "string" && payload.translated_text.trim()) {
    return payload.translated_text.trim();
  }
  if (typeof payload.translation === "string" && payload.translation.trim()) {
    return payload.translation.trim();
  }
  if (typeof payload.result === "string" && payload.result.trim()) return payload.result.trim();
  if (typeof payload.text === "string" && payload.text.trim()) return payload.text.trim();
  if (Array.isArray(payload.data?.translations) && payload.data.translations[0]?.translatedText) {
    return String(payload.data.translations[0].translatedText).trim() || null;
  }
  if (Array.isArray(payload) && typeof payload[0] === "string") {
    return payload[0].trim() || null;
  }
  return null;
};

const callGoogleTranslate113 = async (
  text: string,
  from: string,
  to: string
): Promise<string> => {
  const apiKey = getRapidApiKey();
  const host = getTranslateHost();
  const url = `https://${host}/translateText`;

  // 1. Tenta JSON (padrão do playground translatescreen/google-translate113)
  let response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-rapidapi-key": apiKey,
      "x-rapidapi-host": host,
    },
    body: JSON.stringify({ from, to, text }),
    signal: AbortSignal.timeout(10000),
  });

  // 2. Se o gateway exigir form-urlencoded, refaz no formato URLSearchParams
  if (response.status === 400 || response.status === 415) {
    const formParams = new URLSearchParams({ from, to, text });
    response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "x-rapidapi-key": apiKey,
        "x-rapidapi-host": host,
      },
      body: formParams.toString(),
      signal: AbortSignal.timeout(10000),
    });
  }

  const rawText = await response.text();
  let parsed: any = null;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    parsed = rawText;
  }

  if (!response.ok) {
    const msg =
      (parsed && typeof parsed === "object" && (parsed.message || parsed.error)) ||
      `HTTP ${response.status}`;
    const err: any = new Error(`google-translate113 error (${response.status}): ${msg}`);
    err.status = response.status;
    throw err;
  }

  const translated = extractTranslatedText(parsed);
  if (!translated) {
    throw new Error("google-translate113 retornou resposta vazia.");
  }
  return translated;
};

const callNonAiTranslateFallback = async (
  text: string,
  from: string,
  to: string
): Promise<string> => {
  const sl = from || "auto";
  const tl = to || "pt";
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${encodeURIComponent(
    sl
  )}&tl=${encodeURIComponent(tl)}&dt=t&q=${encodeURIComponent(text)}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (!res.ok) {
    throw new Error(`Fallback HTTP translate error (${res.status})`);
  }
  const data: any = await res.json();
  if (Array.isArray(data) && Array.isArray(data[0])) {
    const combined = data[0]
      .map((segment: any) => (Array.isArray(segment) ? segment[0] : ""))
      .filter(Boolean)
      .join("")
      .trim();
    if (combined) return combined;
  }
  throw new Error("Fallback HTTP translate retornou resposta vazia.");
};

export const translateTextNode = async (
  rawText: string,
  from: string = "auto",
  to: string = "pt"
): Promise<{ translatedText: string; provider: string; cached: boolean }> => {
  const text = String(rawText || "").trim();
  if (!text || /^[\d\s\-.:/]+$/.test(text)) {
    return { translatedText: text, provider: "passthrough", cached: true };
  }

  const cacheKey = `${from}:${to}:${text}`;
  const cached = translationCache.get(cacheKey);
  if (cached) {
    return { translatedText: cached, provider: "cache", cached: true };
  }

  let translatedText = "";
  let provider = "google-translate113";

  try {
    translatedText = await callGoogleTranslate113(text, from, to);
  } catch (primaryErr: any) {
    console.warn(
      `[Translate Node] google-translate113 falhou (${primaryErr?.message || primaryErr}); tentando fallback HTTP não-IA.`
    );
    try {
      translatedText = await callNonAiTranslateFallback(text, from, to);
      provider = "google-translate-http-fallback";
    } catch (fallbackErr: any) {
      throw new Error(
        `Falha na tradução (${primaryErr?.message || primaryErr}; fallback: ${
          fallbackErr?.message || fallbackErr
        })`
      );
    }
  }

  if (translationCache.size >= MAX_CACHE_SIZE) {
    const firstKey = translationCache.keys().next().value;
    if (firstKey) translationCache.delete(firstKey);
  }
  translationCache.set(cacheKey, translatedText);

  return { translatedText, provider, cached: false };
};

export function createTranslateRouter() {
  const router = express.Router();

  router.post("/", async (req, res) => {
    try {
      const { text, texts, from = "auto", to = "pt" } = req.body || {};

      if (Array.isArray(texts)) {
        const cleaned = texts.map((item) => String(item || "").trim());
        const results = await Promise.all(
          cleaned.map(async (item) => {
            if (!item) return { original: "", translatedText: "", provider: "passthrough" };
            const out = await translateTextNode(item, from, to);
            return { original: item, ...out };
          })
        );
        return res.json({
          translations: results.map((r) => r.translatedText),
          details: results,
          provider: results.find((r) => r.provider !== "passthrough")?.provider || "google-translate113",
        });
      }

      if (!text || typeof text !== "string") {
        return res.status(400).json({ error: "Campo 'text' ou 'texts' é obrigatório." });
      }

      const result = await translateTextNode(text, from, to);
      return res.json(result);
    } catch (error: any) {
      console.error("[Translate Server] Error:", error);
      return res.status(502).json({
        error: error?.message || "Erro ao traduzir texto no servidor Node.js.",
      });
    }
  });

  router.post("/wikidata", async (req, res) => {
    try {
      const {
        title = "",
        label = "",
        genres = [],
        themes = [],
        instanceLabel = "",
        from = "auto",
        to = "pt",
      } = req.body || {};

      const cleanGenres = Array.isArray(genres)
        ? genres.map((g) => String(g || "").trim()).filter(Boolean)
        : [];
      const cleanThemes = Array.isArray(themes)
        ? themes.map((t) => String(t || "").trim()).filter(Boolean)
        : [];

      const uniqueStrings = Array.from(
        new Set(
          [
            String(title || "").trim(),
            String(label || "").trim(),
            String(instanceLabel || "").trim(),
            ...cleanGenres,
            ...cleanThemes,
          ].filter(Boolean)
        )
      );

      const translatedMap = new Map<string, string>();
      let lastProvider = "google-translate113";

      for (const str of uniqueStrings) {
        const resItem = await translateTextNode(str, from, to);
        translatedMap.set(str, resItem.translatedText);
        if (resItem.provider !== "cache" && resItem.provider !== "passthrough") {
          lastProvider = resItem.provider;
        }
      }

      const titleStr = String(title || "").trim();
      const labelStr = String(label || "").trim();
      const instanceStr = String(instanceLabel || "").trim();

      return res.json({
        titlePt: titleStr ? translatedMap.get(titleStr) || titleStr : "",
        labelPt: labelStr ? translatedMap.get(labelStr) || labelStr : "",
        instanceLabelPt: instanceStr ? translatedMap.get(instanceStr) || instanceStr : "",
        genresPt: cleanGenres.map((g) => translatedMap.get(g) || g),
        themesPt: cleanThemes.map((t) => translatedMap.get(t) || t),
        provider: lastProvider,
      });
    } catch (error: any) {
      console.error("[Translate Wikidata Server] Error:", error);
      return res.status(502).json({
        error: error?.message || "Erro ao traduzir títulos/labels do Wikidata.",
      });
    }
  });

  return router;
}
