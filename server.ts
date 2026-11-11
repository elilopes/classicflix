
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
  if (!wbEditInstance) {
    wbEditInstance = WBEdit({
      instance: 'https://www.wikidata.org',
      credentials: {
        username: process.env.WIKIDATA_BOT_USER || '',
        password: process.env.WIKIDATA_BOT_PASS || ''
      },
      userAgent: 'ClassicFlix-App/1.0'
    });
  }
  return wbEditInstance;
};

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

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

    const summary = editMethod === 'oauth'
      ? (wikiUsername ? `Criado por [[User:${wikiUsername}|${wikiUsername}]] via ClassicFlix (OAuth Wikipedia)` : 'Criado via ClassicFlix (OAuth Wikipedia)')
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
      } else if (accessToken) {
        // Fetch files directly from Google Drive API using user OAuth token
        let pageToken: string | null = null;
        const query = `'${folderId}' in parents and trashed = false`;

        do {
          const url = new URL("https://www.googleapis.com/drive/v3/files");
          url.searchParams.set("q", query);
          url.searchParams.set("pageSize", "1000");
          url.searchParams.set("fields", "nextPageToken, files(id, name, mimeType)");
          if (pageToken) url.searchParams.set("pageToken", pageToken);

          const driveRes = await fetch(url.toString(), {
            headers: { Authorization: `Bearer ${accessToken}` }
          });

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
      } else {
        return res.status(400).json({ 
          error: "Forneça 'accessToken' do Google Drive ou 'fileMappings' contendo qid e posterUrl" 
        });
      }

      console.log(`[Drive Poster Sync] Iniciando atualização de ${mappings.length} posters no Supabase...`);

      let updatedCount = 0;
      let skippedCount = 0;
      const errorsList: string[] = [];

      // Update Supabase movies table for each mapping
      for (const map of mappings) {
        try {
          const { data, error } = await supabase
            .from("movies")
            .update({ posterurl: map.posterUrl })
            .eq("wikidataid", map.qid)
            .select("id, wikidataid");

          if (error) {
            errorsList.push(`${map.qid}: ${error.message}`);
          } else if (data && data.length > 0) {
            updatedCount += data.length;
          } else {
            skippedCount++;
          }
        } catch (e: any) {
          errorsList.push(`${map.qid}: ${e.message}`);
        }
      }

      console.log(`[Drive Poster Sync] Concluído! Atualizados: ${updatedCount}, Não encontrados no banco: ${skippedCount}, Erros: ${errorsList.length}`);

      res.json({
        success: true,
        totalDriveFiles: mappings.length,
        updatedCount,
        skippedCount,
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

    const summary = editMethod === 'oauth'
      ? (wikiUsername ? `Editado por [[User:${wikiUsername}|${wikiUsername}]] via ClassicFlix (OAuth Wikipedia)` : 'Editado via ClassicFlix (OAuth Wikipedia)')
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
    if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
    if (req) {
      const proto = (req.headers['x-forwarded-proto'] as string) || req.protocol || 'http';
      const host = (req.headers['x-forwarded-host'] as string) || req.get('host');
      if (host) return `${proto}://${host}`;
    }
    return "";
  };

  // Endpoint to get Wikipedia authorization URL
  app.get("/api/auth/wikipedia/url", (req, res) => {
    const appUrl = getAppBaseUrl(req);
    const redirectUri = (req.query.redirect_uri as string) || `${appUrl}/auth/wikipedia/callback`;
    const clientId = process.env.WIKIPEDIA_CLIENT_ID;

    if (clientId) {
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
        url: authUrl,
        redirectUri,
        clientId
      });
    }

    // If client ID is not configured, inform client and provide registration guides
    res.json({
      configured: false,
      message: "WIKIPEDIA_CLIENT_ID não configurado.",
      setupUrl: "https://meta.wikimedia.org/wiki/Special:OAuthConsumerRegistration/propose",
      redirectUri,
      devCallbackUrl: `${appUrl}/auth/wikipedia/callback`,
      sharedCallbackUrl: `${appUrl}/auth/wikipedia/callback`
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
    const redirectUri = `${appUrl}/auth/wikipedia/callback`;

    try {
      // Exchange code for token with Wikimedia
      const tokenBody = new URLSearchParams({
        grant_type: "authorization_code",
        code: String(code),
        redirect_uri: redirectUri,
        client_id: clientId || "",
        client_secret: clientSecret || ""
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
        throw new Error(tokenData.message || tokenData.error || "Falha ao obter token de acesso da Wikimedia");
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
        accessToken: tokenData.access_token
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
