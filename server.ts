
import express from "express";
import { createServer as createViteServer } from "vite";

// Prevent server process termination on uncaught background errors
process.on('uncaughtException', (err) => {
  console.error('[Process Uncaught Exception]:', err);
});
process.on('unhandledRejection', (reason) => {
  console.error('[Process Unhandled Rejection]:', reason);
});
import multer from "multer";
import ffmpeg from "fluent-ffmpeg";
import ffmpegPath from "@ffmpeg-installer/ffmpeg";
import path from "path";
import fs from "fs";
import cors from "cors";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";
import WBEdit from 'wikibase-edit';
import { Server as SocketIOServer } from "socket.io";
import { setupGameSockets } from "./server/gameSockets.ts";
import { createGeminiRouter } from "./server/geminiRoutes.ts";
import { createTranslateRouter } from "./server/translateRoutes.ts";

import { GoogleAuth } from "google-auth-library";
import { google } from "googleapis";

ffmpeg.setFfmpegPath(ffmpegPath.path);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Supabase configuration
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://rqtlqqmdldpsrtuviedy.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJxdGxxcW1kbGRwc3J0dXZpZWR5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk3MDgyOTQsImV4cCI6MjA4NTI4NDI5NH0.egKKScXyTjpS6NcOI1oZT-nCU3IKu_1h5xA48ZN4nSM";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

let wbEditInstance: any = null;

const getWbEdit = () => {
  const user = process.env.WIKIDATA_BOT_USER || '';
  const pass = process.env.WIKIDATA_BOT_PASS || '';
  if (!user || !pass) {
    throw new Error('Credenciais do Bot Wikidata (WIKIDATA_BOT_USER / WIKIDATA_BOT_PASS) não estão configuradas no servidor.');
  }
  if (!wbEditInstance) {
    wbEditInstance = WBEdit({
      instance: 'https://www.wikidata.org',
      credentials: {
        username: user,
        password: pass
      },
      userAgent: 'ClassicFlix-App/1.0'
    });
  }
  return wbEditInstance;
};

const WIKI_OAUTH_COOKIE = 'classicflix_wiki_oauth';

interface WikiOAuthCookieSession {
  accessToken: string;
  refreshToken?: string;
  username?: string;
  expiresAt?: number;
}

const parseCookies = (cookieHeader?: string): Record<string, string> => {
  const cookies: Record<string, string> = {};
  if (!cookieHeader) return cookies;
  for (const part of cookieHeader.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    if (key) {
      try {
        cookies[key] = decodeURIComponent(val);
      } catch {
        cookies[key] = val;
      }
    }
  }
  return cookies;
};

const getWikiSessionCookie = (req: express.Request): WikiOAuthCookieSession | null => {
  const cookies = parseCookies(req.headers.cookie);
  const raw = cookies[WIKI_OAUTH_COOKIE];
  if (!raw) return null;
  try {
    const parsed = JSON.parse(Buffer.from(raw, 'base64url').toString('utf-8')) as WikiOAuthCookieSession;
    if (!parsed?.accessToken) return null;
    if (parsed.expiresAt && Date.now() >= parsed.expiresAt) return null;
    return parsed;
  } catch {
    return null;
  }
};

const buildWikidataClaimStatement = (property: string, value: any) => {
  if (typeof value === 'object' && value !== null && 'text' in value) {
    return {
      mainsnak: {
        snaktype: 'value',
        property,
        datavalue: {
          type: 'monolingualtext',
          value: { text: String(value.text), language: String(value.language || 'pt') }
        }
      },
      type: 'statement',
      rank: 'normal'
    };
  }
  const strVal = String(value).trim();
  if (/^Q\d+$/i.test(strVal)) {
    const numericId = Number(strVal.replace(/^Q/i, ''));
    return {
      mainsnak: {
        snaktype: 'value',
        property,
        datavalue: {
          type: 'wikibase-entityid',
          value: { 'entity-type': 'item', 'numeric-id': numericId, id: strVal.toUpperCase() }
        }
      },
      type: 'statement',
      rank: 'normal'
    };
  }
  if (property === 'P577' && /^\d{4}$/.test(strVal)) {
    return {
      mainsnak: {
        snaktype: 'value',
        property,
        datavalue: {
          type: 'time',
          value: {
            time: `+${strVal}-00-00T00:00:00Z`,
            timezone: 0,
            before: 0,
            after: 0,
            precision: 9,
            calendarmodel: 'http://www.wikidata.org/entity/Q1985727'
          }
        }
      },
      type: 'statement',
      rank: 'normal'
    };
  }
  return {
    mainsnak: {
      snaktype: 'value',
      property,
      datavalue: {
        type: 'string',
        value: strVal
      }
    },
    type: 'statement',
    rank: 'normal'
  };
};

const editWikidataWithOAuth = async (params: {
  qid?: string;
  labels?: Record<string, string>;
  descriptions?: Record<string, string>;
  claims?: Record<string, any>;
  summary: string;
  accessToken: string;
}): Promise<{ id: string }> => {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${params.accessToken}`,
    'User-Agent': 'ClassicFlix-App/1.0 (https://classicflix.app; mailto:liclopes@gmail.com)'
  };

  const tokenRes = await fetch('https://www.wikidata.org/w/api.php?action=query&meta=tokens&format=json', { headers });
  const tokenJson: any = await tokenRes.json().catch(() => ({}));
  if (!tokenRes.ok || tokenJson?.error || !tokenJson?.query?.tokens?.csrftoken) {
    const errMsg = tokenJson?.error?.info || tokenJson?.message || 'Token OAuth da Wikipedia inválido ou expirado. Conecte novamente via OAuth.';
    throw new Error(errMsg);
  }
  const csrfToken = tokenJson.query.tokens.csrftoken;

  const entityData: any = {};
  if (params.labels && Object.keys(params.labels).length > 0) {
    entityData.labels = {};
    for (const [lang, value] of Object.entries(params.labels)) {
      if (value) entityData.labels[lang] = { language: lang, value };
    }
  }
  if (params.descriptions && Object.keys(params.descriptions).length > 0) {
    entityData.descriptions = {};
    for (const [lang, value] of Object.entries(params.descriptions)) {
      if (value) entityData.descriptions[lang] = { language: lang, value };
    }
  }
  if (params.claims && Object.keys(params.claims).length > 0) {
    entityData.claims = {};
    for (const [prop, val] of Object.entries(params.claims)) {
      if (val !== undefined && val !== null && val !== '') {
        entityData.claims[prop] = [buildWikidataClaimStatement(prop, val)];
      }
    }
  }

  const form = new URLSearchParams({
    action: 'wbeditentity',
    format: 'json',
    summary: params.summary,
    data: JSON.stringify(entityData),
    token: csrfToken
  });
  if (params.qid) {
    form.set('id', params.qid);
  } else {
    form.set('new', 'item');
  }

  const editRes = await fetch('https://www.wikidata.org/w/api.php', {
    method: 'POST',
    headers: {
      ...headers,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: form.toString()
  });
  const editJson: any = await editRes.json().catch(() => ({}));
  if (!editRes.ok || editJson?.error || !editJson?.entity?.id) {
    throw new Error(editJson?.error?.info || editJson?.message || 'Falha ao enviar edição via Wikimedia OAuth API');
  }
  return { id: editJson.entity.id };
};

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json({ limit: "10mb" }));

  app.use("/api/gemini", createGeminiRouter());
  app.use("/api/translate", createTranslateRouter());
  // YouTube Data API proxy: keeps the API key on the server and returns embeddable video files only.
  app.get("/api/video/youtube-search", async (req, res) => {
    const apiKey = process.env.YOUTUBE_API_KEY;
    const query = typeof req.query.q === "string" ? req.query.q.trim().slice(0, 180) : "";
    if (!apiKey) return res.status(503).json({ error: "YOUTUBE_API_KEY não configurada no servidor." });
    if (query.length < 3) return res.status(400).json({ error: "Informe um título válido para pesquisar." });
    try {
      const searchParams = new URLSearchParams({
        part: "snippet", type: "video", q: query, maxResults: "10",
        videoEmbeddable: "true", videoSyndicated: "true", key: apiKey
      });
      const searchResponse = await fetch(`https://www.googleapis.com/youtube/v3/search?${searchParams.toString()}`);
      const searchData: any = await searchResponse.json();
      if (!searchResponse.ok) throw new Error(searchData?.error?.message || "Falha na pesquisa do YouTube.");
      const ids = (searchData.items || []).map((item: any) => item.id?.videoId).filter(Boolean);
      if (!ids.length) return res.json({ items: [] });

      const detailParams = new URLSearchParams({ part: "contentDetails,status", id: ids.join(","), key: apiKey });
      const detailResponse = await fetch(`https://www.googleapis.com/youtube/v3/videos?${detailParams.toString()}`);
      const detailData: any = await detailResponse.json();
      if (!detailResponse.ok) throw new Error(detailData?.error?.message || "Falha ao validar vídeos do YouTube.");
      const details = new Map<string, any>((detailData.items || []).map((item: any) => [String(item.id), item] as [string, any]));
      const parseDuration = (iso: string) => {
        const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
        return match ? Number(match[1] || 0) * 3600 + Number(match[2] || 0) * 60 + Number(match[3] || 0) : 0;
      };
      const items = (searchData.items || []).flatMap((item: any) => {
        const videoId = item.id?.videoId;
        const detail: any = details.get(videoId);
        if (!videoId || !detail?.status?.embeddable || detail.status.privacyStatus !== "public") return [];
        return [{
          videoId,
          title: item.snippet?.title || "",
          description: item.snippet?.description || "",
          channelTitle: item.snippet?.channelTitle || "",
          publishedAt: item.snippet?.publishedAt || "",
          durationSeconds: parseDuration(detail.contentDetails?.duration || "")
        }];
      });
      res.setHeader("Cache-Control", "public, max-age=300");
      return res.json({ items });
    } catch (error: any) {
      console.error("YouTube search error:", error);
      return res.status(502).json({ error: error?.message || "Erro ao consultar o YouTube." });
    }
  });


  // API route to toggle like
  app.post("/api/toggle-like", async (req, res) => {
    const { targetId, targetType, userId } = req.body;
    
    try {
      const { error } = await supabase.rpc('toggle_like', {
        p_target_id: targetId,
        p_target_type: targetType,
        p_userid: userId
      });
      
      if (error) throw error;
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error toggling like:", error);
      res.status(500).json({ error: "Failed to toggle like" });
    }
  });

  // API route to create Wikidata item
  app.post('/api/wikidata/create', async (req, res) => {
    const { 
      label, description, language = 'pt', 
      director, year, originalLanguage, originalTitle, 
      producers, country, cinematography, distribution,
      editMethod = 'bot', wikiUsername, userToken 
    } = req.body;

    if (!label || !description) {
      return res.status(400).json({ error: "Label e Descrição são obrigatórios para criar no Wikidata" });
    }

    const cookieSession = getWikiSessionCookie(req);
    const effectiveUser = wikiUsername || cookieSession?.username;
    const summary = editMethod === 'oauth'
      ? (effectiveUser ? `Criado por [[User:${effectiveUser}|${effectiveUser}]] via ClassicFlix (OAuth Wikipedia)` : 'Criado via ClassicFlix (OAuth Wikipedia)')
      : 'Criado via ClassicFlix Bot';

    try {
      const claims: any = {
        P31: 'Q11424' // Item is a Film (filme)
      };
      if (director) claims.P57 = director;
      if (year) claims.P577 = year.toString();
      if (originalLanguage) claims.P364 = originalLanguage;
      if (originalTitle) claims.P1476 = { text: originalTitle, language: language || 'pt' };
      if (producers) claims.P162 = producers;
      if (country) claims.P495 = country;
      if (cinematography) claims.P344 = cinematography;
      if (distribution) claims.P750 = distribution;

      if (editMethod === 'oauth') {
        const oauthToken = userToken || cookieSession?.accessToken;
        if (!oauthToken) {
          return res.status(401).json({
            error: "Sessão OAuth 2.0 da Wikipedia ausente ou expirada. Faça login via OAuth Wikipedia antes de criar com OAuth.",
            editMethod
          });
        }
        const oauthResult = await editWikidataWithOAuth({
          labels: { [language]: label },
          descriptions: { [language]: description },
          claims,
          summary,
          accessToken: oauthToken
        });
        return res.json({
          success: true,
          qid: oauthResult.id,
          editMethod,
          summary
        });
      }

      const createObj: any = {
        labels: { [language]: label },
        descriptions: { [language]: description },
        claims: claims,
        summary: summary
      };

      const wbEdit = getWbEdit();
      const result = await wbEdit.entity.create(createObj);
      res.json({ 
        success: true, 
        qid: result.entity.id,
        editMethod,
        summary
      });
    } catch (error: any) {
      console.error("Erro Wikidata Create:", error);
      res.status(500).json({ 
        error: error.message || "Falha ao criar item no Wikidata",
        editMethod
      });
    }
  });

  // Google Drive Service Account Integration
  app.get("/api/drive/shared-files", async (req, res) => {
    const clientEmail = process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_EMAIL;
    const privateKey = process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_PRIVATE_KEY;
    const folderId = process.env.GOOGLE_DRIVE_SHARED_FOLDER_ID;

    if (!clientEmail || !privateKey) {
      return res.status(400).json({ error: "Service account credentials not configured" });
    }

    try {
      const auth = new GoogleAuth({
        credentials: {
          client_email: clientEmail,
          private_key: privateKey.replace(/\\n/g, "\n"),
        },
        scopes: ["https://www.googleapis.com/auth/drive.readonly"],
      });

      const drive = google.drive({ version: "v3", auth });
      const query = folderId 
        ? `'${folderId}' in parents and mimeType contains 'image/' and trashed = false`
        : "mimeType contains 'image/' and trashed = false";

      const response = await drive.files.list({
        q: query,
        fields: "files(id, name, mimeType, thumbnailLink, webViewLink, iconLink)",
      });

      res.json({ files: response.data.files || [] });
    } catch (error: any) {
      console.error("Google Drive API Error:", error);
      res.status(500).json({ error: error.message || "Failed to fetch Drive files" });
    }
  });

  // Proxy public Wikimedia / Wikidata image URLs so client canvas can convert them to .webp without CORS issues
  app.get("/api/drive/proxy-image", async (req, res) => {
    const rawUrl = typeof req.query.url === "string" ? req.query.url.trim() : "";
    if (!rawUrl) {
      return res.status(400).json({ error: "Parâmetro url é obrigatório" });
    }

    let parsed: URL;
    try {
      parsed = new URL(rawUrl);
    } catch {
      return res.status(400).json({ error: "URL inválida" });
    }

    const allowedHosts = new Set([
      "commons.wikimedia.org",
      "upload.wikimedia.org",
      "www.wikidata.org",
    ]);

    if (parsed.protocol !== "https:" || !allowedHosts.has(parsed.hostname.toLowerCase())) {
      return res.status(403).json({ error: "Host não permitido para proxy de imagem" });
    }

    try {
      const upstream = await fetch(parsed.toString(), {
        redirect: "follow",
        headers: {
          "User-Agent": "ClassicFlixBot/1.0 (https://classicflix.app; public-domain-archiver)",
          "Accept": "image/*,*/*;q=0.8",
        },
      });

      if (!upstream.ok) {
        return res.status(upstream.status).json({
          error: `Falha ao baixar imagem do Wikimedia (${upstream.status})`,
        });
      }

      const contentType = upstream.headers.get("content-type") || "image/jpeg";
      if (!contentType.startsWith("image/")) {
        return res.status(415).json({ error: `Conteúdo retornado não é imagem: ${contentType}` });
      }

      const arrayBuf = await upstream.arrayBuffer();
      res.setHeader("Content-Type", contentType);
      res.setHeader("Cache-Control", "public, max-age=3600");
      res.send(Buffer.from(arrayBuf));
    } catch (err: any) {
      console.error("[Proxy Image Error]:", err);
      res.status(500).json({ error: err?.message || "Erro ao buscar imagem remota" });
    }
  });

  // API endpoint to synchronize posters from Google Drive to Supabase movies table
  app.post("/api/drive/sync-posters", async (req, res) => {
    const { 
      accessToken, 
      folderId = "1EplnNSliyeRLI0KcTYACJrvmIweqlxcX", 
      fileMappings,
      replaceExisting = true 
    } = req.body;

    try {
      let mappings: Array<{ qid: string; posterUrl: string }> = [];

      if (Array.isArray(fileMappings) && fileMappings.length > 0) {
        mappings = fileMappings;
      } else {
        // Fetch files directly from Google Drive API v3 with pagination
        const driveKey = process.env.GOOGLE_DRIVE_API_KEY || "AIzaSyAWGrfCCr7albM3lmCc937gx4uIphbpeKQ";
        let pageToken: string | null = null;
        const query = `'${folderId}' in parents and trashed = false`;

        do {
          const url = new URL("https://www.googleapis.com/drive/v3/files");
          url.searchParams.set("q", query);
          url.searchParams.set("pageSize", "1000");
          url.searchParams.set("fields", "nextPageToken, files(id, name, mimeType)");
          if (accessToken) {
            // OAuth user token
          } else {
            url.searchParams.set("key", driveKey);
          }
          if (pageToken) url.searchParams.set("pageToken", pageToken);

          const headers: Record<string, string> = {};
          if (accessToken) {
            headers["Authorization"] = `Bearer ${accessToken}`;
          }

          const driveRes = await fetch(url.toString(), { headers });

          if (!driveRes.ok) {
            const errJson = await driveRes.json().catch(() => ({}));
            throw new Error(errJson.error?.message || `Google Drive API retornou status ${driveRes.status}`);
          }

          const driveData = await driveRes.json();
          const pageFiles = driveData.files || [];

          for (const f of pageFiles) {
            if (f.name && f.name.toLowerCase().endsWith(".webp") && f.name.toUpperCase().startsWith("Q")) {
              const qid = f.name.replace(/\.webp$/i, "").trim();
              const posterUrl = `https://lh3.googleusercontent.com/d/${f.id}`;
              mappings.push({ qid, posterUrl });
            }
          }

          pageToken = driveData.nextPageToken || null;
        } while (pageToken);
      }

      console.log(`[Drive Poster Sync] Total de posters encontrados no Drive: ${mappings.length}. Iniciando atualização no Supabase...`);

      const adminSb = createClient(SUPABASE_URL, SUPABASE_KEY);
      try {
        await adminSb.auth.signInWithPassword({
          email: 'liclopes@gmail.com',
          password: '@viclic2'
        });
      } catch (authErr: any) {
        console.warn('[Drive Poster Sync] Supabase login error:', authErr?.message);
      }

      // Fetch existing movies to identify which ones need updating
      let existingMovies: Array<{ id: string; wikidataid: string; posterurl: string }> = [];
      let from = 0;
      const fetchStep = 1000;
      while (true) {
        const { data, error } = await adminSb
          .from("movies")
          .select("id, wikidataid, posterurl")
          .range(from, from + fetchStep - 1);
        if (error || !data || data.length === 0) break;
        existingMovies.push(...data);
        if (data.length < fetchStep) break;
        from += fetchStep;
      }

      const moviesByQid = new Map();
      for (const m of existingMovies) {
        if (m.wikidataid) {
          moviesByQid.set(m.wikidataid.trim().toUpperCase(), m);
        }
      }

      const toUpdate: Array<{ wikidataid: string; posterUrl: string }> = [];
      let alreadyUpToDate = 0;
      let notInDatabase = 0;

      for (const map of mappings) {
        const qidUpper = map.qid.trim().toUpperCase();
        const existing = moviesByQid.get(qidUpper);
        if (existing) {
          if (existing.posterurl === map.posterUrl) {
            alreadyUpToDate++;
          } else {
            toUpdate.push({ wikidataid: existing.wikidataid, posterUrl: map.posterUrl });
          }
        } else {
          notInDatabase++;
        }
      }

      let updatedCount = 0;
      const errorsList: string[] = [];
      const concurrency = 25;

      for (let i = 0; i < toUpdate.length; i += concurrency) {
        const chunk = toUpdate.slice(i, i + concurrency);
        await Promise.all(
          chunk.map(async (entry) => {
            try {
              const { error } = await adminSb
                .from("movies")
                .update({ posterurl: entry.posterUrl })
                .eq("wikidataid", entry.wikidataid);
              if (error) {
                errorsList.push(`${entry.wikidataid}: ${error.message}`);
              } else {
                updatedCount++;
              }
            } catch (e: any) {
              errorsList.push(`${entry.wikidataid}: ${e.message}`);
            }
          })
        );
      }

      console.log(`[Drive Poster Sync] Concluído! Atualizados: ${updatedCount}, Já atualizados: ${alreadyUpToDate}, Não no banco: ${notInDatabase}, Erros: ${errorsList.length}`);

      res.json({
        success: true,
        totalDriveFiles: mappings.length,
        updatedCount,
        alreadyUpToDate,
        notInDatabase,
        errorCount: errorsList.length,
        sampleUpdates: mappings.slice(0, 5)
      });
    } catch (err: any) {
      console.error("[Drive Poster Sync Error]:", err);
      res.status(500).json({ success: false, error: err.message || "Erro ao sincronizar posters do Drive" });
    }
  });

  // API route to update Wikidata item
  app.post('/api/wikidata/update', async (req, res) => {
    const { 
      id, label, description, language = 'pt', 
      director, year, originalLanguage, originalTitle, 
      producers, country, cinematography, distribution,
      editMethod = 'bot', wikiUsername, userToken 
    } = req.body;
    
    if (!id) {
      return res.status(400).json({ error: "ID do Wikidata é obrigatório" });
    }

    const cookieSession = getWikiSessionCookie(req);
    const effectiveUser = wikiUsername || cookieSession?.username;
    const summary = editMethod === 'oauth'
      ? (effectiveUser ? `Editado por [[User:${effectiveUser}|${effectiveUser}]] via ClassicFlix (OAuth Wikipedia)` : 'Editado via ClassicFlix (OAuth Wikipedia)')
      : 'Editado via ClassicFlix Bot';

    try {
      const claims: any = {};
      if (director) claims.P57 = director;
      if (year) claims.P577 = year.toString();
      if (originalLanguage) claims.P364 = originalLanguage;
      if (originalTitle) claims.P1476 = { text: originalTitle, language: language || 'pt' };
      if (producers) claims.P162 = producers;
      if (country) claims.P495 = country;
      if (cinematography) claims.P344 = cinematography;
      if (distribution) claims.P750 = distribution;

      if (editMethod === 'oauth') {
        const oauthToken = userToken || cookieSession?.accessToken;
        if (!oauthToken) {
          return res.status(401).json({
            error: "Sessão OAuth 2.0 da Wikipedia ausente ou expirada. Faça login via OAuth Wikipedia antes de editar com OAuth.",
            editMethod
          });
        }
        const oauthResult = await editWikidataWithOAuth({
          qid: id,
          labels: label ? { [language]: label } : undefined,
          descriptions: description ? { [language]: description } : undefined,
          claims,
          summary,
          accessToken: oauthToken
        });
        return res.json({
          success: true,
          qid: oauthResult.id || id,
          editMethod,
          summary
        });
      }

      const editObj: any = {
        id: id,
        summary: summary
      };

      if (label) {
        // @ts-ignore
        editObj.labels = { [language]: label };
      }
      if (description) {
        // @ts-ignore
        editObj.descriptions = { [language]: description };
      }

      if (Object.keys(claims).length > 0) {
        editObj.claims = claims;
      }

      const wbEdit = getWbEdit();
      const result = await wbEdit.entity.edit(editObj);
      res.json({ 
        success: true, 
        qid: result.entity?.id || id,
        editMethod,
        summary
      });
    } catch (error: any) {
      console.error("Erro Wikidata Update:", error);
      res.status(500).json({ 
        error: error.message || "Falha ao atualizar no Wikidata",
        editMethod
      });
    }
  });

  // Allow cross-origin resources (posters, banners, video previews)
  app.use((req, res, next) => {
    res.header("Cross-Origin-Resource-Policy", "cross-origin");
    next();
  });

  // Multer setup for file uploads
  const upload = multer({ 
    dest: "uploads/",
    limits: { fileSize: 500 * 1024 * 1024 } // 500MB limit
  });

  // Ensure uploads, converted, and banner directories exist
  if (!fs.existsSync("uploads")) fs.mkdirSync("uploads");
  if (!fs.existsSync("converted")) fs.mkdirSync("converted");
  if (!fs.existsSync("banner")) fs.mkdirSync("banner", { recursive: true });
  if (!fs.existsSync("public/banner")) fs.mkdirSync("public/banner", { recursive: true });

  // Serve static banner directory
  app.use("/banner", express.static(path.join(process.cwd(), "banner")));
  app.use("/banner", express.static(path.join(process.cwd(), "public/banner")));

  // API route to save banner/poster images locally into the banner folder
  app.post("/api/banner/save", async (req, res) => {
    const { imageUrl, filename } = req.body;
    if (!imageUrl || !filename) {
      return res.status(400).json({ error: "Parâmetros 'imageUrl' e 'filename' são obrigatórios" });
    }

    try {
      // Sanitize filename to avoid directory traversal
      const safeFilename = path.basename(filename).replace(/[^a-zA-Z0-9_.-]/g, "_");
      const bannerFilePath = path.join(process.cwd(), "banner", safeFilename);
      const publicBannerFilePath = path.join(process.cwd(), "public/banner", safeFilename);

      // Fetch image binary from external URL
      const imgResponse = await fetch(imageUrl);
      if (!imgResponse.ok) {
        throw new Error(`Falha ao baixar imagem: ${imgResponse.status} ${imgResponse.statusText}`);
      }

      const arrayBuffer = await imgResponse.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // Write to both banner and public/banner directories for high reliability
      fs.writeFileSync(bannerFilePath, buffer);
      try {
        fs.writeFileSync(publicBannerFilePath, buffer);
      } catch (e) {
        // public/banner write optional if read-only
      }

      console.log(`Banner salvo com sucesso: ${safeFilename} (${buffer.length} bytes)`);
      res.json({
        success: true,
        localPath: `/banner/${safeFilename}`,
        filename: safeFilename,
        size: buffer.length
      });
    } catch (saveErr: any) {
      console.error("Erro ao salvar imagem no diretório banner:", saveErr);
      res.status(500).json({
        success: false,
        error: saveErr.message || "Falha ao salvar imagem na pasta banner"
      });
    }
  });

  // Model Context Protocol (MCP) JSON-RPC 2.0 Endpoint
  app.post("/api/mcp", async (req, res) => {
    try {
      const { handleMcpJsonRpcRequest } = await import("./services/mcpService.ts");
      const requestPayload = req.body;
      const responsePayload = await handleMcpJsonRpcRequest(requestPayload);
      res.json(responsePayload);
    } catch (mcpErr: any) {
      console.error("MCP Protocol Error:", mcpErr);
      res.status(500).json({
        jsonrpc: "2.0",
        id: req.body?.id || null,
        error: { code: -32603, message: mcpErr.message || "Internal MCP error" }
      });
    }
  });

  app.get("/api/mcp", async (req, res) => {
    res.json({
      name: "classicflix-mcp-server",
      version: "1.0.0",
      protocolVersion: "2024-11-05",
      status: "running",
      endpoints: {
        jsonRpc: "/api/mcp",
        oauth21Callback: "/oauth2/callback"
      }
    });
  });

  // --- Wikipedia / Wikimedia OAuth 2.0 Integration ---
  const getAppBaseUrl = (req?: express.Request): string => {
    if (req) {
      const proto = (req.headers['x-forwarded-proto'] as string) || req.protocol || 'https';
      const host = (req.headers['x-forwarded-host'] as string) || req.get('host');
      if (host && !host.startsWith('0.0.0.0')) return `${proto}://${host}`.replace(/\/$/, "");
    }
    if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
    return "";
  };

  const getWikiCallbackUrls = (req?: express.Request) => {
    const base = process.env.APP_URL?.replace(/\/$/, "") || getAppBaseUrl(req);
    const defaultDev = "https://ais-dev-rketbkfc2ioywj5ptq55cf-18401513977.us-west1.run.app/auth/wikipedia/callback";
    const defaultShared = "https://ais-pre-rketbkfc2ioywj5ptq55cf-18401513977.us-west1.run.app/auth/wikipedia/callback";
    if (base && base.includes("ais-dev-")) {
      return {
        devCallbackUrl: `${base}/auth/wikipedia/callback`,
        sharedCallbackUrl: `${base.replace("ais-dev-", "ais-pre-")}/auth/wikipedia/callback`
      };
    }
    if (base && base.includes("ais-pre-")) {
      return {
        devCallbackUrl: `${base.replace("ais-pre-", "ais-dev-")}/auth/wikipedia/callback`,
        sharedCallbackUrl: `${base}/auth/wikipedia/callback`
      };
    }
    return {
      devCallbackUrl: defaultDev,
      sharedCallbackUrl: defaultShared
    };
  };

  const isValidWikiCallbackUrl = (candidate?: string): boolean => {
    if (!candidate) return false;
    try {
      const parsed = new URL(candidate);
      return (
        (parsed.hostname.endsWith('.run.app') || parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') &&
        parsed.pathname.replace(/\/$/, '') === '/auth/wikipedia/callback'
      );
    } catch {
      return false;
    }
  };

  // Endpoint to inspect Wikimedia OAuth 2.0 configuration and HTTP-only session status
  app.get("/api/auth/wikipedia/status", (req, res) => {
    const hasClientId = Boolean(process.env.WIKIPEDIA_CLIENT_ID);
    const hasClientSecret = Boolean(process.env.WIKIPEDIA_CLIENT_SECRET);
    const session = getWikiSessionCookie(req);
    const { devCallbackUrl, sharedCallbackUrl } = getWikiCallbackUrls(req);

    res.json({
      configured: hasClientId && hasClientSecret,
      hasClientId,
      hasClientSecret,
      authenticated: Boolean(session?.accessToken),
      username: session?.username || null,
      setupUrl: "https://meta.wikimedia.org/wiki/Special:OAuthConsumerRegistration/propose",
      devCallbackUrl,
      sharedCallbackUrl
    });
  });

  // Endpoint to clear Wikimedia OAuth cookie session
  app.post("/api/auth/wikipedia/logout", (_req, res) => {
    res.clearCookie(WIKI_OAUTH_COOKIE, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      path: '/'
    });
    res.json({ success: true });
  });

  // Endpoint to get Wikipedia authorization URL
  app.get("/api/auth/wikipedia/url", (req, res) => {
    const appUrl = getAppBaseUrl(req);
    const requestedRedirect = typeof req.query.redirect_uri === 'string' ? req.query.redirect_uri : '';
    const redirectUri = isValidWikiCallbackUrl(requestedRedirect) ? requestedRedirect : `${appUrl}/auth/wikipedia/callback`;
    const clientId = process.env.WIKIPEDIA_CLIENT_ID;
    const hasClientSecret = Boolean(process.env.WIKIPEDIA_CLIENT_SECRET);
    const { devCallbackUrl, sharedCallbackUrl } = getWikiCallbackUrls(req);

    if (clientId && hasClientSecret) {
      const stateObj = { t: Date.now(), redirectUri };
      const state = Buffer.from(JSON.stringify(stateObj)).toString("base64url");
      const params = new URLSearchParams({
        client_id: clientId,
        response_type: "code",
        redirect_uri: redirectUri,
        state: state
      });
      const authUrl = `https://meta.wikimedia.org/w/rest.php/oauth2/authorize?${params.toString()}`;
      return res.json({
        configured: true,
        hasClientId: true,
        hasClientSecret: true,
        url: authUrl,
        redirectUri,
        clientId,
        setupUrl: "https://meta.wikimedia.org/wiki/Special:OAuthConsumerRegistration/propose",
        devCallbackUrl,
        sharedCallbackUrl
      });
    }

    res.json({
      configured: false,
      hasClientId: Boolean(clientId),
      hasClientSecret,
      message: !clientId
        ? "WIKIPEDIA_CLIENT_ID não configurado nos Secrets."
        : "WIKIPEDIA_CLIENT_SECRET não configurado nos Secrets.",
      setupUrl: "https://meta.wikimedia.org/wiki/Special:OAuthConsumerRegistration/propose",
      redirectUri,
      devCallbackUrl,
      sharedCallbackUrl
    });
  });

  // Direct verification of Wikipedia username via Wikimedia API
  app.post("/api/auth/wikipedia/verify", async (req, res) => {
    const { username } = req.body;
    if (!username || typeof username !== "string" || !username.trim()) {
      return res.status(400).json({ success: false, error: "Nome de usuário da Wikipedia é obrigatório" });
    }

    const cleanUser = username.trim();
    try {
      // Query MediaWiki API
      const wikiRes = await fetch(
        `https://pt.wikipedia.org/w/api.php?action=query&list=users&ususers=${encodeURIComponent(cleanUser)}&usprop=editcount|registration|groups&format=json`,
        {
          headers: {
            "User-Agent": "ClassicFlix/1.0 (liclopes@gmail.com)"
          }
        }
      );

      let userInfo: any = null;
      if (wikiRes.ok) {
        const data = await wikiRes.json();
        const users = data?.query?.users;
        if (users && users.length > 0 && !users[0].missing) {
          userInfo = users[0];
        }
      }

      // If not in pt.wikipedia, try en.wikipedia
      if (!userInfo) {
        const enRes = await fetch(
          `https://en.wikipedia.org/w/api.php?action=query&list=users&ususers=${encodeURIComponent(cleanUser)}&usprop=editcount|registration|groups&format=json`,
          {
            headers: {
              "User-Agent": "ClassicFlix/1.0 (liclopes@gmail.com)"
            }
          }
        );
        if (enRes.ok) {
          const enData = await enRes.json();
          const enUsers = enData?.query?.users;
          if (enUsers && enUsers.length > 0 && !enUsers[0].missing) {
            userInfo = enUsers[0];
          }
        }
      }

      const displayName = userInfo ? userInfo.name : cleanUser;
      const editCount = userInfo?.editcount || 1;
      const registered = userInfo?.registration || new Date().toISOString();
      const groups = userInfo?.groups || ["*", "user"];
      const wikiId = `wiki_${displayName.toLowerCase().replace(/[^a-z0-9]/g, "_")}`;
      const email = `${displayName.toLowerCase().replace(/[^a-z0-9]/g, "")}@wikipedia.org`;

      const user = {
        id: wikiId,
        userid: wikiId,
        email: email,
        displayName: displayName,
        photoURL: "https://upload.wikimedia.org/wikipedia/commons/6/63/Wikipedia-logo-en-big.png",
        provider: "wikipedia",
        user_metadata: {
          full_name: displayName,
          avatar_url: "https://upload.wikimedia.org/wikipedia/commons/6/63/Wikipedia-logo-en-big.png",
          wiki_username: displayName,
          edit_count: editCount,
          registered: registered,
          groups: groups
        }
      };

      res.json({ success: true, user });
    } catch (err: any) {
      console.error("Erro na verificação de usuário da Wikipedia:", err);
      res.status(500).json({ success: false, error: err.message || "Erro ao consultar usuário na Wikipedia" });
    }
  });

  // OAuth 2.0 Callback handler for Wikimedia
  app.get(["/auth/wikipedia/callback", "/auth/wikipedia/callback/"], async (req, res) => {
    res.setHeader("Cross-Origin-Opener-Policy", "unsafe-none");
    const { code, error, error_description } = req.query;

    if (error) {
      const errStr = String(error_description || error);
      return res.send(`
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <title>Wikipedia OAuth - Erro</title>
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #121212; color: #fff; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; text-align: center; }
              .box { background: #1f1f1f; padding: 2rem; border-radius: 12px; border: 1px solid #444; max-width: 420px; }
            </style>
          </head>
          <body>
            <div class="box">
              <h2 style="color: #ef4444; margin-top: 0;">Falha na Autenticação</h2>
              <p>${errStr}</p>
              <p style="font-size: 0.85rem; color: #888;">Esta janela fechará em instantes...</p>
            </div>
            <script>
              if (window.opener) {
                window.opener.postMessage({ type: 'WIKIPEDIA_AUTH_ERROR', error: ${JSON.stringify(errStr)} }, '*');
                setTimeout(() => window.close(), 3000);
              } else {
                window.location.href = '/';
              }
            </script>
          </body>
        </html>
      `);
    }

    if (!code) {
      return res.status(400).send("Código de autorização não fornecido");
    }

    const clientId = process.env.WIKIPEDIA_CLIENT_ID;
    const clientSecret = process.env.WIKIPEDIA_CLIENT_SECRET;
    const appUrl = getAppBaseUrl(req);
    let redirectUri = `${appUrl}/auth/wikipedia/callback`;

    if (typeof req.query.state === 'string' && req.query.state) {
      try {
        const parsedState = JSON.parse(Buffer.from(req.query.state, 'base64url').toString('utf-8'));
        if (isValidWikiCallbackUrl(parsedState?.redirectUri)) {
          redirectUri = parsedState.redirectUri;
        }
      } catch {
        // ignore invalid state, fallback to request origin callback URL
      }
    }

    try {
      if (!clientId || !clientSecret) {
        throw new Error("WIKIPEDIA_CLIENT_ID ou WIKIPEDIA_CLIENT_SECRET não configurados no servidor.");
      }

      // Exchange code for token with Wikimedia
      const tokenBody = new URLSearchParams({
        grant_type: "authorization_code",
        code: String(code),
        redirect_uri: redirectUri,
        client_id: clientId,
        client_secret: clientSecret
      });

      const tokenRes = await fetch("https://meta.wikimedia.org/w/rest.php/oauth2/access_token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": "ClassicFlix/1.0 (liclopes@gmail.com)"
        },
        body: tokenBody.toString()
      });

      const tokenData = await tokenRes.json();
      if (!tokenRes.ok || !tokenData.access_token) {
        throw new Error(tokenData.message || tokenData.error_description || tokenData.error || "Falha ao obter token de acesso da Wikimedia");
      }

      // Fetch user profile from Wikimedia
      const profileRes = await fetch("https://meta.wikimedia.org/w/rest.php/oauth2/resource/profile", {
        headers: {
          "Authorization": `Bearer ${tokenData.access_token}`,
          "User-Agent": "ClassicFlix/1.0 (liclopes@gmail.com)"
        }
      });

      const profile = await profileRes.json();
      const wikiUsername = profile.username || "Usuário Wikipedia";
      const wikiId = `wiki_${profile.sub || wikiUsername.toLowerCase().replace(/[^a-z0-9]/g, "_")}`;
      const wikiEmail = profile.email || `${wikiUsername.toLowerCase().replace(/[^a-z0-9]/g, "")}@wikipedia.org`;
      const expiresInMs = (Number(tokenData.expires_in) || 14400) * 1000;

      const cookiePayload: WikiOAuthCookieSession = {
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        username: wikiUsername,
        expiresAt: Date.now() + expiresInMs
      };
      res.cookie(
        WIKI_OAUTH_COOKIE,
        Buffer.from(JSON.stringify(cookiePayload)).toString('base64url'),
        {
          httpOnly: true,
          secure: true,
          sameSite: 'none',
          path: '/',
          maxAge: expiresInMs
        }
      );

      const wikiUser = {
        id: wikiId,
        userid: wikiId,
        email: wikiEmail,
        displayName: wikiUsername,
        photoURL: "https://upload.wikimedia.org/wikipedia/commons/6/63/Wikipedia-logo-en-big.png",
        provider: "wikipedia",
        user_metadata: {
          full_name: wikiUsername,
          avatar_url: "https://upload.wikimedia.org/wikipedia/commons/6/63/Wikipedia-logo-en-big.png",
          wiki_username: wikiUsername,
          wiki_sub: profile.sub,
          edit_count: profile.editcount,
          registered: profile.registered,
          groups: profile.groups
        },
        accessToken: tokenData.access_token,
        expiresIn: Number(tokenData.expires_in) || 14400
      };

      res.send(`
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <title>Wikipedia Conectada</title>
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0f172a; color: #f8fafc; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
              .card { background: #1e293b; border: 1px solid #334155; border-radius: 16px; padding: 32px; text-align: center; max-width: 380px; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.5); }
              .icon { width: 56px; height: 56px; margin-bottom: 16px; border-radius: 50%; background: #ffffff; padding: 6px; }
              .title { color: #38bdf8; font-size: 1.25rem; font-weight: 700; margin: 0 0 8px 0; }
              .sub { color: #94a3b8; font-size: 0.9rem; margin-bottom: 16px; }
            </style>
          </head>
          <body>
            <div class="card">
              <img src="https://upload.wikimedia.org/wikipedia/commons/6/63/Wikipedia-logo-en-big.png" class="icon" alt="Wikipedia" />
              <div class="title">Conectado com a Wikipedia!</div>
              <div class="sub">Bem-vindo, <strong>${wikiUsername}</strong>.</div>
              <p style="font-size: 0.8rem; color: #64748b; margin: 0;">Esta janela fechará automaticamente.</p>
            </div>
            <script>
              const user = ${JSON.stringify(wikiUser)};
              if (window.opener) {
                window.opener.postMessage({ type: 'WIKIPEDIA_AUTH_SUCCESS', user }, '*');
                setTimeout(() => window.close(), 700);
              } else {
                window.location.href = '/';
              }
            </script>
          </body>
        </html>
      `);
    } catch (authErr: any) {
      console.error("Erro no callback OAuth da Wikimedia:", authErr);
      res.send(`
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <title>Wikipedia OAuth - Erro</title>
            <style>
              body { font-family: sans-serif; background: #121212; color: #fff; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; text-align: center; }
              .box { background: #1f1f1f; padding: 2rem; border-radius: 12px; border: 1px solid #444; max-width: 420px; }
            </style>
          </head>
          <body>
            <div class="box">
              <h3 style="color: #ef4444;">Erro ao processar login da Wikipedia</h3>
              <p>${authErr.message || 'Erro inesperado'}</p>
              <button onclick="window.close()" style="background: #333; color: #fff; border: 1px solid #555; padding: 8px 16px; border-radius: 6px; cursor: pointer;">Fechar</button>
            </div>
          </body>
        </html>
      `);
    }
  });

  app.post("/api/convert", upload.single("video"), (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const inputPath = req.file.path;
    const outputFormat = req.body.format || "mp4";
    const outputFilename = `${req.file.filename}.${outputFormat}`;
    const outputPath = path.join("converted", outputFilename);

    console.log(`Converting ${inputPath} to ${outputPath}...`);

    ffmpeg(inputPath)
      .toFormat(outputFormat)
      .on("end", () => {
        console.log("Conversion finished");
        // Delete original file
        fs.unlinkSync(inputPath);
        res.json({ 
          success: true, 
          downloadUrl: `/api/download/${outputFilename}` 
        });
      })
      .on("error", (err) => {
        console.error("Conversion error:", err);
        if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
        res.status(500).json({ error: "Conversion failed" });
      })
      .save(outputPath);
  });

  // Download converted file
  app.get("/api/download/:filename", (req, res) => {
    const filename = req.params.filename;
    const filePath = path.join("converted", filename);

    if (fs.existsSync(filePath)) {
      res.download(filePath, (err) => {
        if (!err) {
          // Optional: delete after download
          // fs.unlinkSync(filePath);
        }
      });
    } else {
      res.status(404).json({ error: "File not found" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Serve static files in production
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.use((req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  // Global Error Middleware
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error("Global Error Handler:", err);
    const status = err.status || err.statusCode || 500;
    res.status(status).json({
      success: false,
      error: err.message || "Internal Server Error",
      stack: process.env.NODE_ENV === "production" ? undefined : err.stack,
    });
  });

  const httpServer = app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });

  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

  setupGameSockets(io);
}

startServer();
