
import express from "express";
import { createServer as createViteServer } from "vite";
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
    // ... (existing code)
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

  // API route to update Wikidata item
  app.post('/api/wikidata/update', async (req, res) => {
    const { id, label, description, language, director, year, originalLanguage, originalTitle, producers, country, cinematography, distribution } = req.body;
    
    if (!id) {
      return res.status(400).json({ error: "ID do Wikidata é obrigatório" });
    }

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
        // @ts-ignore
        labels: { [language]: label },
        // @ts-ignore
        descriptions: { [language]: description }
      };

      if (Object.keys(claims).length > 0) {
        editObj.claims = claims;
      }

      const wbEdit = getWbEdit();
      const result = await wbEdit.entity.edit(editObj);
      res.json({ success: true, qid: result.entity.id });
    } catch (error) {
      console.error("Erro Wikidata Update:", error);
      res.status(500).json({ error: "Falha ao atualizar no Wikidata" });
    }
  });

  // Headers for SharedArrayBuffer (required by ffmpeg.wasm)
  app.use((req, res, next) => {
    res.header("Cross-Origin-Embedder-Policy", "require-corp");
    res.header("Cross-Origin-Opener-Policy", "same-origin");
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

  // API route for server-side conversion
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
