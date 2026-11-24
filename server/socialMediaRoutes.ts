import { Router } from "express";
import ytSearch from "yt-search";
import youtubedl from "youtube-dl-exec";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";

const SUPPORTED_HOSTS = [
  "youtube.com", "youtu.be", "tiktok.com", "douyin.com", "instagram.com",
  "facebook.com", "fb.watch", "fb.com", "vimeo.com", "twitter.com", "x.com",
  "pinterest.com", "pin.it", "reddit.com", "redd.it", "soundcloud.com",
  "spotify.com", "capcut.com", "threads.net", "dailymotion.com", "dai.ly"
];

function validateMediaUrl(raw: unknown): string {
  if (typeof raw !== "string" || raw.length > 4096) throw new Error("Informe uma URL de mídia válida.");
  let parsed: URL;
  try { parsed = new URL(raw); } catch { throw new Error("URL inválida."); }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") throw new Error("Somente URLs HTTP/HTTPS são aceitas.");
  const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
  if (!SUPPORTED_HOSTS.some((domain) => host === domain || host.endsWith("." + domain))) {
    throw new Error("Plataforma não suportada. Confira a lista de redes compatíveis.");
  }
  return parsed.toString();
}

export function createSocialMediaRouter() {
  const router = Router();

  router.get("/search", async (req, res) => {
    const query = typeof req.query.q === "string" ? req.query.q.trim().slice(0, 180) : "";
    if (query.length < 2) return res.status(400).json({ error: "Digite pelo menos 2 caracteres para pesquisar." });
    try {
      const result = await ytSearch(query);
      const videos = (result.videos || []).slice(0, 12).map((video: any) => ({
        id: video.videoId || "",
        title: video.title || "Vídeo",
        url: video.url || (video.videoId ? `https://www.youtube.com/watch?v=${video.videoId}` : ""),
        thumbnail: video.thumbnail || video.image || "",
        duration: video.timestamp || "",
        author: video.author?.name || "YouTube"
      })).filter((item: any) => item.url);
      return res.json(videos);
    } catch (error: any) {
      console.error("[ClassicFlix media search]", error?.message || error);
      return res.status(502).json({ error: "Não foi possível pesquisar agora. Cole diretamente o link do vídeo." });
    }
  });

  router.get("/download", async (req, res) => {
    let mediaUrl = "";
    try {
      mediaUrl = validateMediaUrl(req.query.url);
      const mode = req.query.mode === "audio" ? "audio" : "video";
      const quality = typeof req.query.quality === "string" ? req.query.quality : "highest";
      const jobDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "classicflix-media-"));
      const outputTemplate = path.join(jobDir, "%(title).120B-%(id)s.%(ext)s");
      const args: Record<string, any> = {
        output: outputTemplate,
        noPlaylist: true,
        noWarnings: true,
        noProgress: true,
        restrictFilenames: true,
        retries: 3,
        fragmentRetries: 3,
        socketTimeout: 30,
        "no-part": true
      };

      if (mode === "audio") {
        args.format = "bestaudio/best";
        args.extractAudio = true;
        args.audioFormat = "mp3";
        args.audioQuality = "0";
      } else {
        args.format = quality === "360p"
          ? "best[height<=360][ext=mp4]/best[height<=360]/best"
          : quality === "lowest"
            ? "worst[ext=mp4]/worst"
            : "best[ext=mp4]/best";
        args.mergeOutputFormat = "mp4";
      }

      try {
        await youtubedl(mediaUrl, args, { timeout: 15 * 60 * 1000 });
        const files = await fs.promises.readdir(jobDir);
        const outputFile = files.map((name) => path.join(jobDir, name)).find((file) => {
          try { return fs.statSync(file).isFile() && !file.endsWith(".part"); } catch { return false; }
        });
        if (!outputFile) throw new Error("O mecanismo de download não gerou um arquivo de saída.");
        const filename = path.basename(outputFile).replace(/[\r\n"]/g, "_");
        res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(filename)}"`);
        res.setHeader("Content-Type", mode === "audio" ? "audio/mpeg" : "video/mp4");
        const stream = fs.createReadStream(outputFile);
        stream.on("error", (error) => {
          console.error("[ClassicFlix media stream]", error);
          if (!res.headersSent) res.status(500).end("Falha ao transmitir o arquivo.");
        });
        stream.on("close", () => { void fs.promises.rm(jobDir, { recursive: true, force: true }); });
        req.on("close", () => {
          if (!res.writableEnded) stream.destroy();
        });
        stream.pipe(res);
      } catch (error) {
        await fs.promises.rm(jobDir, { recursive: true, force: true });
        throw error;
      }
    } catch (error: any) {
      console.error("[ClassicFlix media download]", mediaUrl, error?.message || error);
      if (!res.headersSent) res.status(502).json({ error: error?.message || "Não foi possível baixar esta mídia. Tente novamente." });
    }
  });

  return router;
}
