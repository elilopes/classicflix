import crypto from "crypto";
import fs from "fs";
import path from "path";
import express, { type Request, type Response, type NextFunction } from "express";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const ADMIN_EMAIL = "liclopes@gmail.com";
const DEFAULT_SUPABASE_URL = "https://rqtlqqmdldpsrtuviedy.supabase.co";
const ALLOWED_FIELDS = new Set([
  "title",
  "titlePt",
  "originalTitle",
  "year",
  "language",
  "posterUrl",
  "videoUrl",
  "trailerUrl",
  "descriptionEn",
  "descriptionPt",
  "director",
  "duration",
  "genres",
  "themes",
  "cast",
  "rating",
  "license",
  "identifiers",
]);
const ALLOWED_MEDIA_TYPES = new Set(["poster", "still", "video", "trailer"]);
const ALLOWED_MEDIA_SOURCES = new Set(["wikidata", "commons", "archive", "tmdb", "youtube"]);

const requestWindows = new Map<string, { startedAt: number; count: number }>();

const getFirebaseWebApiKey = (): string => {
  if (process.env.FIREBASE_WEB_API_KEY) {
    return process.env.FIREBASE_WEB_API_KEY;
  }
  try {
    const configPath = path.resolve(process.cwd(), "firebase-applet-config.json");
    const raw = fs.readFileSync(configPath, "utf-8");
    const parsed = JSON.parse(raw);
    if (typeof parsed?.apiKey === "string" && parsed.apiKey.trim()) {
      return parsed.apiKey.trim();
    }
  } catch {
    // Fallback handled below
  }
  return "";
};

const getAdminClient = (): SupabaseClient => {
  const url = process.env.SUPABASE_URL || DEFAULT_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    const err = new Error(
      "SUPABASE_SERVICE_ROLE_KEY não está configurada no servidor para gravação administrativa."
    ) as Error & { statusCode?: number };
    err.statusCode = 503;
    throw err;
  }
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
};

async function verifyFirebaseAdmin(req: Request, res: Response, next: NextFunction) {
  const authorization = req.headers.authorization || "";
  const tokenMatch = authorization.match(/^Bearer\s+(.+)$/i);
  if (!tokenMatch) {
    return res.status(401).json({ error: "Autenticação Firebase necessária." });
  }

  const apiKey = getFirebaseWebApiKey();
  if (!apiKey) {
    return res.status(503).json({ error: "Chave Web do Firebase não encontrada no servidor." });
  }

  try {
    const lookupResponse = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken: tokenMatch[1] }),
        signal: AbortSignal.timeout(10000),
      }
    );
    const lookup = (await lookupResponse.json().catch(() => ({}))) as any;
    const firebaseUser = lookup?.users?.[0];

    if (!lookupResponse.ok || !firebaseUser) {
      return res.status(401).json({ error: "Token Firebase inválido ou expirado." });
    }
    if (
      firebaseUser.disabled === true ||
      firebaseUser.emailVerified !== true ||
      String(firebaseUser.email || "").toLowerCase() !== ADMIN_EMAIL
    ) {
      return res.status(403).json({ error: "Apenas o administrador do ClassicFlix pode importar ou atualizar produções." });
    }
    return next();
  } catch (error) {
    console.error("[Wikidata import] Firebase verification failed:", error);
    return res.status(503).json({ error: "Não foi possível validar a autenticação agora." });
  }
}

function rateLimitAdmin(req: Request, res: Response, next: NextFunction) {
  const forwarded = req.headers["x-forwarded-for"];
  const ip =
    (Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(",")[0])?.trim() ||
    req.socket.remoteAddress ||
    "unknown";
  const now = Date.now();
  const current = requestWindows.get(ip);
  if (!current || now - current.startedAt >= 60_000) {
    requestWindows.set(ip, { startedAt: now, count: 1 });
    return next();
  }
  if (current.count >= 60) {
    return res.status(429).json({ error: "Muitas solicitações administrativas. Aguarde um minuto." });
  }
  current.count += 1;
  return next();
}

const nullIfEmpty = (val: unknown): string | null => {
  if (typeof val !== "string") return val === null || val === undefined ? null : String(val).trim() || null;
  const trimmed = val.trim();
  return trimmed || null;
};

const safeHttpUrl = (val: unknown): string | null => {
  const str = nullIfEmpty(val);
  if (!str) return null;
  try {
    const parsed = new URL(str);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      return str;
    }
  } catch {
    return null;
  }
  return null;
};

const stableJsonEqual = (a: unknown, b: unknown): boolean => {
  const normA = a === undefined ? null : a;
  const normB = b === undefined ? null : b;
  if (normA === normB) return true;
  if (typeof normA !== typeof normB || normA === null || normB === null) return false;
  if (typeof normA !== "object") return false;
  if (Array.isArray(normA) || Array.isArray(normB)) {
    return JSON.stringify(normA) === JSON.stringify(normB);
  }
  const keysA = Object.keys(normA as Record<string, unknown>).sort();
  const keysB = Object.keys(normB as Record<string, unknown>).sort();
  if (keysA.length !== keysB.length) return false;
  return keysA.every(
    (k, i) => k === keysB[i] && stableJsonEqual((normA as any)[k], (normB as any)[k])
  );
};

const extractFieldValue = (
  field: string,
  movieRow: Record<string, any> | null,
  descRow: Record<string, any> | null,
  techRow: Record<string, any> | null,
  identRow: Record<string, any> | null
) => {
  switch (field) {
    case "title":
      return movieRow?.title ?? null;
    case "titlePt":
      return movieRow?.titlept ?? null;
    case "originalTitle":
      return movieRow?.originaltitle ?? null;
    case "year":
      return movieRow?.year ?? null;
    case "language":
      return movieRow?.language ?? null;
    case "posterUrl":
      return movieRow?.posterurl ?? null;
    case "videoUrl":
      return movieRow?.videourl ?? null;
    case "trailerUrl":
      return movieRow?.trailerurl ?? null;
    case "descriptionEn":
      return descRow?.descriptionen ?? movieRow?.description ?? null;
    case "descriptionPt":
      return descRow?.descriptionpt ?? null;
    case "director":
      return techRow?.director ?? null;
    case "duration":
      return techRow?.duration ?? null;
    case "genres":
      return techRow?.genres ?? null;
    case "themes":
      return techRow?.themes ?? null;
    case "cast":
      return techRow?.castmembers ?? null;
    case "rating":
      return techRow?.rating ?? null;
    case "license":
      return techRow?.sourcelabel ?? null;
    case "identifiers":
      return identRow ?? null;
    default:
      return null;
  }
};

export const createWikidataImportRouter = () => {
  const router = express.Router();
  router.use(verifyFirebaseAdmin, rateLimitAdmin);

  router.post("/", async (req, res) => {
    const body = req.body || {};
    const action = body.action === "update" ? "update" : body.action === "insert" ? "insert" : null;
    const rawQid = typeof body.movie?.wikidataid === "string" ? body.movie.wikidataid.trim().toUpperCase() : "";

    if (!rawQid || !/^Q[1-9]\d*$/.test(rawQid)) {
      return res.status(400).json({ error: "QID do Wikidata inválido ou ausente." });
    }
    if (!action) {
      return res.status(400).json({ error: "Ação de importação inválida." });
    }

    const rawSelectedFields: unknown[] = Array.isArray(body.selectedFields) ? body.selectedFields : [];
    const selectedFields: string[] = [];
    for (const f of rawSelectedFields) {
      if (typeof f !== "string" || !ALLOWED_FIELDS.has(f)) {
        return res.status(400).json({ error: "A seleção contém campos não permitidos." });
      }
      if (!selectedFields.includes(f)) selectedFields.push(f);
    }

    const rawMedia: any[] = Array.isArray(body.media) ? body.media : [];
    const sanitizedMedia = rawMedia
      .map((entry) => {
        const url = safeHttpUrl(entry?.url);
        if (!url) return null;
        const mediaType = ALLOWED_MEDIA_TYPES.has(entry?.media_type) ? entry.media_type : "poster";
        const source = ALLOWED_MEDIA_SOURCES.has(entry?.source) ? entry.source : "wikidata";
        const sourceId = nullIfEmpty(entry?.source_id) || url;
        return {
          media_type: mediaType,
          source,
          source_id: sourceId,
          url,
          page_url: safeHttpUrl(entry?.page_url),
          license: nullIfEmpty(entry?.license),
          attribution: nullIfEmpty(entry?.attribution),
          metadata: entry?.metadata && typeof entry.metadata === "object" ? entry.metadata : {},
        };
      })
      .filter((entry): entry is NonNullable<typeof entry> => entry !== null);

    let client: SupabaseClient;
    try {
      client = getAdminClient();
    } catch (err: any) {
      return res.status(err?.statusCode || 503).json({ error: err?.message || "Servidor sem acesso administrativo ao Supabase." });
    }

    const pMovie = body.movie && typeof body.movie === "object" ? body.movie : {};
    const pDesc = body.description && typeof body.description === "object" ? body.description : {};
    const pTech = body.technicaldetails && typeof body.technicaldetails === "object" ? body.technicaldetails : {};
    const pIdent = body.identifiers && typeof body.identifiers === "object" ? body.identifiers : {};
    const pSources = body.sources && typeof body.sources === "object" ? body.sources : {};

    try {
      const [{ data: oldMovie }, { data: oldDesc }, { data: oldTech }, { data: oldIdent }] = await Promise.all([
        client.from("movies").select("*").ilike("wikidataid", rawQid).maybeSingle(),
        client.from("description").select("*").ilike("wikidataid", rawQid).maybeSingle(),
        client.from("technicaldetails").select("*").ilike("wikidataid", rawQid).maybeSingle(),
        client.from("identifiers").select("*").ilike("wikidataid", rawQid).maybeSingle(),
      ]);

      if (action === "insert" && oldMovie) {
        return res.status(409).json({
          error: `A produção ${rawQid} já existe. Abra a revisão seletiva para atualizar.`,
        });
      }
      if (action === "update" && !oldMovie) {
        return res.status(404).json({
          error: `A produção ${rawQid} não existe no catálogo; use a importação de nova produção.`,
        });
      }

      const targetQid = oldMovie?.wikidataid || rawQid;
      const fallbackRowId = crypto.createHash("md5").update(targetQid).digest("hex").slice(0, 12);
      const rowId = nullIfEmpty(pMovie.id) || oldMovie?.id || fallbackRowId;
      const parsedYear =
        pMovie.year !== null && pMovie.year !== undefined && pMovie.year !== "" && Number(pMovie.year) > 0
          ? Math.trunc(Number(pMovie.year))
          : null;

      const { data: jobRow, error: jobErr } = await client
        .from("import_jobs")
        .insert({
          source: "wikidata",
          action,
          requested_by: null,
          requested_email: ADMIN_EMAIL,
          status: "completed",
          item_count: 1,
          details: {
            wikidataid: targetQid,
            selected_fields: selectedFields,
            media_count: sanitizedMedia.length,
          },
        })
        .select("id")
        .single();

      if (jobErr || !jobRow?.id) {
        throw new Error(jobErr?.message || "Falha ao criar registro do trabalho de importação.");
      }
      const jobId = jobRow.id as string;

      try {
        if (action === "insert") {
          const movieInsert = {
            id: rowId,
            wikidataid: targetQid,
            title: nullIfEmpty(pMovie.title) || targetQid,
            titlept: nullIfEmpty(pMovie.titlept),
            originaltitle: nullIfEmpty(pMovie.originaltitle),
            year: parsedYear,
            language: nullIfEmpty(pMovie.language),
            hassubtitles: Boolean(pMovie.hassubtitles),
            posterurl: nullIfEmpty(pMovie.posterurl),
            videourl: nullIfEmpty(pMovie.videourl),
            trailerurl: nullIfEmpty(pMovie.trailerurl),
            subtitleurl: nullIfEmpty(pMovie.subtitleurl),
            description: nullIfEmpty(pMovie.description),
            type: nullIfEmpty(pMovie.type) || "film",
            awards: nullIfEmpty(pMovie.awards),
            popularity: Number.isFinite(Number(pMovie.popularity)) ? Math.trunc(Number(pMovie.popularity)) : 0,
          };

          const { error: mErr } = await client.from("movies").insert(movieInsert);
          if (mErr) throw new Error(`Falha ao gravar movies: ${mErr.message}`);

          const descInsert = {
            wikidataid: targetQid,
            id: nullIfEmpty(pDesc.id) || rowId,
            title: nullIfEmpty(pDesc.title) || movieInsert.title,
            descriptionen: nullIfEmpty(pDesc.descriptionen),
            descriptionpt: nullIfEmpty(pDesc.descriptionpt),
            descriptionhi: nullIfEmpty(pDesc.descriptionhi),
            descriptionru: nullIfEmpty(pDesc.descriptionru),
            descriptionit: nullIfEmpty(pDesc.descriptionit),
          };
          const { error: dErr } = await client
            .from("description")
            .upsert(descInsert, { onConflict: "wikidataid" });
          if (dErr) throw new Error(`Falha ao gravar description: ${dErr.message}`);

          const techInsert = {
            wikidataid: targetQid,
            id: nullIfEmpty(pTech.id) || rowId,
            title: nullIfEmpty(pTech.title) || movieInsert.title,
            duration: nullIfEmpty(pTech.duration),
            genres: nullIfEmpty(pTech.genres),
            director: nullIfEmpty(pTech.director),
            sourcelabel: nullIfEmpty(pTech.sourcelabel),
            castmembers: nullIfEmpty(pTech.castmembers),
            cinematographers: nullIfEmpty(pTech.cinematographers),
            composers: nullIfEmpty(pTech.composers),
            themes: nullIfEmpty(pTech.themes),
            rating: nullIfEmpty(pTech.rating),
          };
          const { error: tErr } = await client
            .from("technicaldetails")
            .upsert(techInsert, { onConflict: "wikidataid" });
          if (tErr) throw new Error(`Falha ao gravar technicaldetails: ${tErr.message}`);

          const identValues = {
            archiveid: nullIfEmpty(pIdent.archiveid),
            imdbid: nullIfEmpty(pIdent.imdbid),
            omdbid: nullIfEmpty(pIdent.omdbid),
            openmdbid: nullIfEmpty(pIdent.openmdbid),
            googleknowid: nullIfEmpty(pIdent.googleknowid),
            ofdbid: nullIfEmpty(pIdent.ofdbid),
            commons: nullIfEmpty(pIdent.commons),
            youtube: nullIfEmpty(pIdent.youtube),
            tmdbid: nullIfEmpty(pIdent.tmdbid),
          };
          if (Object.values(identValues).some((v) => v !== null)) {
            const { error: iErr } = await client
              .from("identifiers")
              .upsert(
                { wikidataid: targetQid, ...identValues, updatedat: new Date().toISOString() },
                { onConflict: "wikidataid" }
              );
            if (iErr) throw new Error(`Falha ao gravar identifiers: ${iErr.message}`);
          }
        } else {
          // Selective update
          const moviePatch: Record<string, unknown> = {};
          if (selectedFields.includes("title") && nullIfEmpty(pMovie.title)) {
            moviePatch.title = nullIfEmpty(pMovie.title);
          }
          if (selectedFields.includes("titlePt") && nullIfEmpty(pMovie.titlept)) {
            moviePatch.titlept = nullIfEmpty(pMovie.titlept);
          }
          if (selectedFields.includes("originalTitle") && nullIfEmpty(pMovie.originaltitle)) {
            moviePatch.originaltitle = nullIfEmpty(pMovie.originaltitle);
          }
          if (selectedFields.includes("year") && parsedYear !== null) {
            moviePatch.year = parsedYear;
          }
          if (selectedFields.includes("language") && nullIfEmpty(pMovie.language)) {
            moviePatch.language = nullIfEmpty(pMovie.language);
          }
          if (selectedFields.includes("posterUrl") && nullIfEmpty(pMovie.posterurl)) {
            moviePatch.posterurl = nullIfEmpty(pMovie.posterurl);
          }
          if (selectedFields.includes("videoUrl") && nullIfEmpty(pMovie.videourl)) {
            moviePatch.videourl = nullIfEmpty(pMovie.videourl);
          }
          if (selectedFields.includes("trailerUrl") && nullIfEmpty(pMovie.trailerurl)) {
            moviePatch.trailerurl = nullIfEmpty(pMovie.trailerurl);
          }
          if (selectedFields.includes("descriptionEn") && nullIfEmpty(pMovie.description)) {
            moviePatch.description = nullIfEmpty(pMovie.description);
          }
          if (Object.keys(moviePatch).length > 0) {
            const { error: mErr } = await client
              .from("movies")
              .update(moviePatch)
              .eq("wikidataid", targetQid);
            if (mErr) throw new Error(`Falha ao atualizar movies: ${mErr.message}`);
          }

          if (selectedFields.includes("descriptionEn") || selectedFields.includes("descriptionPt")) {
            const nextDescEn = selectedFields.includes("descriptionEn")
              ? nullIfEmpty(pDesc.descriptionen) ?? oldDesc?.descriptionen ?? null
              : oldDesc?.descriptionen ?? null;
            const nextDescPt = selectedFields.includes("descriptionPt")
              ? nullIfEmpty(pDesc.descriptionpt) ?? oldDesc?.descriptionpt ?? null
              : oldDesc?.descriptionpt ?? null;
            const { error: dErr } = await client.from("description").upsert(
              {
                wikidataid: targetQid,
                id: oldDesc?.id ?? nullIfEmpty(pDesc.id) ?? rowId,
                title: oldDesc?.title ?? nullIfEmpty(pDesc.title) ?? oldMovie?.title ?? null,
                descriptionen: nextDescEn,
                descriptionpt: nextDescPt,
                descriptionhi: oldDesc?.descriptionhi ?? null,
                descriptionru: oldDesc?.descriptionru ?? null,
                descriptionit: oldDesc?.descriptionit ?? null,
              },
              { onConflict: "wikidataid" }
            );
            if (dErr) throw new Error(`Falha ao atualizar description: ${dErr.message}`);
          }

          if (
            ["director", "duration", "genres", "themes", "cast", "rating", "license"].some((f) =>
              selectedFields.includes(f)
            )
          ) {
            const { error: tErr } = await client.from("technicaldetails").upsert(
              {
                wikidataid: targetQid,
                id: oldTech?.id ?? nullIfEmpty(pTech.id) ?? rowId,
                title: oldTech?.title ?? nullIfEmpty(pTech.title) ?? oldMovie?.title ?? null,
                duration: selectedFields.includes("duration")
                  ? nullIfEmpty(pTech.duration) ?? oldTech?.duration ?? null
                  : oldTech?.duration ?? null,
                genres: selectedFields.includes("genres")
                  ? nullIfEmpty(pTech.genres) ?? oldTech?.genres ?? null
                  : oldTech?.genres ?? null,
                director: selectedFields.includes("director")
                  ? nullIfEmpty(pTech.director) ?? oldTech?.director ?? null
                  : oldTech?.director ?? null,
                sourcelabel: selectedFields.includes("license")
                  ? nullIfEmpty(pTech.sourcelabel) ?? oldTech?.sourcelabel ?? null
                  : oldTech?.sourcelabel ?? null,
                themes: selectedFields.includes("themes")
                  ? nullIfEmpty(pTech.themes) ?? oldTech?.themes ?? null
                  : oldTech?.themes ?? null,
                castmembers: selectedFields.includes("cast")
                  ? nullIfEmpty(pTech.castmembers) ?? oldTech?.castmembers ?? null
                  : oldTech?.castmembers ?? null,
                rating: selectedFields.includes("rating")
                  ? nullIfEmpty(pTech.rating) ?? oldTech?.rating ?? null
                  : oldTech?.rating ?? null,
              },
              { onConflict: "wikidataid" }
            );
            if (tErr) throw new Error(`Falha ao atualizar technicaldetails: ${tErr.message}`);
          }

          if (selectedFields.includes("identifiers")) {
            const { error: iErr } = await client.from("identifiers").upsert(
              {
                wikidataid: targetQid,
                archiveid: nullIfEmpty(pIdent.archiveid) ?? oldIdent?.archiveid ?? null,
                imdbid: nullIfEmpty(pIdent.imdbid) ?? oldIdent?.imdbid ?? null,
                omdbid: nullIfEmpty(pIdent.omdbid) ?? oldIdent?.omdbid ?? null,
                openmdbid: nullIfEmpty(pIdent.openmdbid) ?? oldIdent?.openmdbid ?? null,
                googleknowid: nullIfEmpty(pIdent.googleknowid) ?? oldIdent?.googleknowid ?? null,
                ofdbid: nullIfEmpty(pIdent.ofdbid) ?? oldIdent?.ofdbid ?? null,
                commons: nullIfEmpty(pIdent.commons) ?? oldIdent?.commons ?? null,
                youtube: nullIfEmpty(pIdent.youtube) ?? oldIdent?.youtube ?? null,
                tmdbid: nullIfEmpty(pIdent.tmdbid) ?? oldIdent?.tmdbid ?? null,
                updatedat: new Date().toISOString(),
              },
              { onConflict: "wikidataid" }
            );
            if (iErr) throw new Error(`Falha ao atualizar identifiers: ${iErr.message}`);
          }
        }

        const [{ data: newMovie }, { data: newDesc }, { data: newTech }, { data: newIdent }] = await Promise.all([
          client.from("movies").select("*").eq("wikidataid", targetQid).maybeSingle(),
          client.from("description").select("*").eq("wikidataid", targetQid).maybeSingle(),
          client.from("technicaldetails").select("*").eq("wikidataid", targetQid).maybeSingle(),
          client.from("identifiers").select("*").eq("wikidataid", targetQid).maybeSingle(),
        ]);

        const historyRows: Array<Record<string, unknown>> = [];
        for (const field of selectedFields) {
          const oldVal = extractFieldValue(field, oldMovie, oldDesc, oldTech, oldIdent);
          const newVal = extractFieldValue(field, newMovie, newDesc, newTech, newIdent);
          if (!stableJsonEqual(oldVal, newVal)) {
            const srcMeta = pSources?.[field];
            historyRows.push({
              import_job_id: jobId,
              wikidataid: targetQid,
              field_name: field,
              old_value: oldVal,
              new_value: newVal,
              source: nullIfEmpty(srcMeta?.source) || "wikidata",
              source_url: safeHttpUrl(srcMeta?.url),
              actor_id: null,
              actor_email: ADMIN_EMAIL,
            });
          }
        }
        if (historyRows.length > 0) {
          const { error: hErr } = await client.from("metadata_history").insert(historyRows);
          if (hErr) throw new Error(`Falha ao registrar histórico: ${hErr.message}`);
        }

        if (sanitizedMedia.length > 0) {
          const mediaRows = sanitizedMedia.map((m) => ({
            wikidataid: targetQid,
            import_job_id: jobId,
            media_type: m.media_type,
            source: m.source,
            source_id: m.source_id,
            url: m.url,
            page_url: m.page_url,
            license: m.license,
            attribution: m.attribution,
            metadata: m.metadata,
          }));
          const { error: mmErr } = await client
            .from("movie_media")
            .upsert(mediaRows, { onConflict: "wikidataid,source,source_id" });
          if (mmErr) throw new Error(`Falha ao gravar mídias: ${mmErr.message}`);
        }

        return res.json({ jobId });
      } catch (innerErr: any) {
        const msg = innerErr?.message || "Falha ao gravar a importação.";
        try {
          await client
            .from("import_jobs")
            .update({
              status: "failed",
              details: {
                wikidataid: targetQid,
                selected_fields: selectedFields,
                error: String(msg).slice(0, 2000),
              },
            })
            .eq("id", jobId);
        } catch {
          // Best-effort audit failure update
        }
        throw innerErr;
      }
    } catch (error: any) {
      console.error("[Wikidata import] Error:", error);
      return res.status(500).json({
        error: error?.message || "Falha ao gravar a importação e seu histórico.",
      });
    }
  });

  router.get("/history", async (req, res) => {
    const rawLimit = Number(req.query.limit);
    const limit = Number.isFinite(rawLimit) ? Math.max(1, Math.min(Math.trunc(rawLimit), 200)) : 50;

    let client: SupabaseClient;
    try {
      client = getAdminClient();
    } catch (err: any) {
      return res.status(err?.statusCode || 503).json({ error: err?.message || "Servidor sem acesso administrativo ao Supabase." });
    }

    try {
      const { data: jobs, error: jobsErr } = await client
        .from("import_jobs")
        .select("id, source, action, status, requested_email, created_at, details")
        .order("created_at", { ascending: false })
        .limit(limit);

      if (jobsErr) throw new Error(jobsErr.message);
      if (!jobs || jobs.length === 0) return res.json({ items: [] });

      const jobIds = jobs.map((j) => j.id);
      const [{ data: mediaRows, error: mediaErr }, { data: historyRows, error: histErr }] = await Promise.all([
        client
          .from("movie_media")
          .select("import_job_id, media_type, source, source_id, url, page_url, license, attribution, created_at")
          .in("import_job_id", jobIds)
          .order("created_at", { ascending: true }),
        client
          .from("metadata_history")
          .select("id, import_job_id, field_name, old_value, new_value, source, source_url, created_at")
          .in("import_job_id", jobIds)
          .order("id", { ascending: true }),
      ]);

      if (mediaErr) throw new Error(mediaErr.message);
      if (histErr) throw new Error(histErr.message);

      const mediaByJob = new Map<string, any[]>();
      for (const m of mediaRows || []) {
        const list = mediaByJob.get(m.import_job_id) || [];
        list.push({
          media_type: m.media_type,
          source: m.source,
          source_id: m.source_id,
          url: m.url,
          page_url: m.page_url,
          license: m.license,
          attribution: m.attribution,
        });
        mediaByJob.set(m.import_job_id, list);
      }

      const changesByJob = new Map<string, any[]>();
      for (const h of historyRows || []) {
        const list = changesByJob.get(h.import_job_id) || [];
        list.push({
          field_name: h.field_name,
          old_value: h.old_value,
          new_value: h.new_value,
          source: h.source,
          source_url: h.source_url,
          created_at: h.created_at,
        });
        changesByJob.set(h.import_job_id, list);
      }

      const items = jobs.map((j) => ({
        id: j.id,
        source: j.source,
        action: j.action,
        status: j.status,
        requested_email: j.requested_email,
        created_at: j.created_at,
        details: j.details,
        media: mediaByJob.get(j.id) || [],
        changes: changesByJob.get(j.id) || [],
      }));

      return res.json({ items });
    } catch (error: any) {
      console.error("[Wikidata import history] Error:", error);
      return res.status(500).json({
        error: error?.message || "Falha ao consultar histórico de importações.",
      });
    }
  });

  return router;
};
