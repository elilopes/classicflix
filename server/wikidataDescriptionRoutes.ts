import express, { type Request, type Response, type NextFunction } from "express";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const ADMIN_EMAIL = "liclopes@gmail.com";
const JOB_KEY = "wikidata_descriptions_en";
const WIKIDATA_BATCH_SIZE = 40;
const MAX_ATTEMPTS = 5;
const BATCH_DELAY_MS = 1200;
const RETRY_DELAY_MS = 5000;

// Firebase Web API keys are public client identifiers, not privileged credentials.
// The fallback matches firebase-applet-config.json; deployments may override it.
const FIREBASE_WEB_API_KEY =
  process.env.FIREBASE_WEB_API_KEY || "AIzaSyBLtswBOdch7tmJ1yySKi-S0HG7j_ZkSP0";

type QueueItem = { wikidataid: string; attempts: number };
type JobCounts = {
  pending: number;
  processing: number;
  completed: number;
  no_description: number;
  failed: number;
  total: number;
};

let workerPromise: Promise<void> | null = null;
const requestWindows = new Map<string, { startedAt: number; count: number }>();

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const getAdminClient = (): SupabaseClient => {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY precisam estar configuradas no servidor.");
  }
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
};

async function verifyFirebaseAdmin(req: Request, res: Response, next: NextFunction) {
  const authorization = req.headers.authorization || "";
  const tokenMatch = authorization.match(/^Bearer\s+(.+)$/i);
  if (!tokenMatch) return res.status(401).json({ error: "Autenticação Firebase necessária." });

  try {
    const lookupResponse = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(FIREBASE_WEB_API_KEY)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken: tokenMatch[1] }),
        signal: AbortSignal.timeout(10000),
      }
    );
    const lookup = await lookupResponse.json().catch(() => ({})) as any;
    const firebaseUser = lookup?.users?.[0];

    if (!lookupResponse.ok || !firebaseUser) {
      return res.status(401).json({ error: "Token Firebase inválido ou expirado." });
    }
    if (firebaseUser.disabled === true || firebaseUser.emailVerified !== true ||
        String(firebaseUser.email || "").toLowerCase() !== ADMIN_EMAIL) {
      return res.status(403).json({ error: "Esta conta não tem permissão para executar a recuperação." });
    }
    return next();
  } catch (error) {
    console.error("[Wikidata descriptions] Firebase token verification failed:", error);
    return res.status(503).json({ error: "Não foi possível validar a autenticação agora." });
  }
}

function rateLimitAdmin(req: Request, res: Response, next: NextFunction) {
  const forwarded = req.headers["x-forwarded-for"];
  const ip = (Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(",")[0])?.trim() ||
    req.socket.remoteAddress || "unknown";
  const now = Date.now();
  const current = requestWindows.get(ip);
  if (!current || now - current.startedAt >= 60_000) {
    requestWindows.set(ip, { startedAt: now, count: 1 });
    return next();
  }
  if (current.count >= 30) {
    return res.status(429).json({ error: "Muitas solicitações administrativas. Aguarde um minuto." });
  }
  current.count += 1;
  return next();
}

async function getCounts(client: SupabaseClient): Promise<JobCounts> {
  const statuses: Array<keyof Omit<JobCounts, "total">> = [
    "pending", "processing", "completed", "no_description", "failed",
  ];
  const counts: any = {};
  for (const status of statuses) {
    const { count, error } = await client
      .from("wikidata_description_queue")
      .select("wikidataid", { count: "exact", head: true })
      .eq("status", status);
    if (error) throw error;
    counts[status] = count || 0;
  }
  counts.total = statuses.reduce((sum, status) => sum + counts[status], 0);
  return counts as JobCounts;
}

async function updateQueue(
  client: SupabaseClient,
  qids: string[],
  values: Record<string, unknown>
) {
  if (!qids.length) return;
  const { error } = await client
    .from("wikidata_description_queue")
    .update({ ...values, updated_at: new Date().toISOString() })
    .in("wikidataid", qids);
  if (error) throw error;
}

async function fetchWikidataBatch(qids: string[]) {
  const params = new URLSearchParams({
    action: "wbgetentities",
    ids: qids.join("|"),
    props: "descriptions",
    languages: "en",
    format: "json",
    maxlag: "15",
  });
  const response = await fetch(`https://www.wikidata.org/w/api.php?${params.toString()}`, {
    headers: {
      "Accept": "application/json",
      "User-Agent": "ClassicFlix/1.0 (https://classicflix.app; mailto:liclopes@gmail.com)",
    },
    signal: AbortSignal.timeout(30000),
  });
  const payload = await response.json().catch(() => ({})) as any;
  if (!response.ok || payload?.error) {
    const errorCode = String(payload?.error?.code || "");
    const parsedRetryAfter = Number(response.headers.get("retry-after") || 0);
    const error: any = new Error(payload?.error?.info || `Wikidata API respondeu HTTP ${response.status}`);
    error.status = response.status;
    error.code = errorCode;
    error.retryAfter = Number.isFinite(parsedRetryAfter) && parsedRetryAfter > 0 ? parsedRetryAfter : 0;
    error.isTransientLag =
      response.status === 429 ||
      response.status === 503 ||
      errorCode.toLowerCase() === "maxlag";
    throw error;
  }
  return payload?.entities || {};
}

async function runWorker(client: SupabaseClient): Promise<void> {
  let consecutiveLagErrors = 0;

  while (true) {
    const { data: job, error: jobError } = await client
      .from("wikidata_description_jobs")
      .select("*")
      .eq("job_key", JOB_KEY)
      .maybeSingle();
    if (jobError) throw jobError;
    if (!job || job.paused) return;

    const { data: batch, error: claimError } = await client.rpc(
      "claim_wikidata_description_batch",
      { p_limit: WIKIDATA_BATCH_SIZE }
    );
    if (claimError) throw claimError;

    const items = (batch || []) as QueueItem[];
    if (!items.length) {
      const counts = await getCounts(client);
      if (counts.pending > 0 || counts.processing > 0) {
        await sleep(RETRY_DELAY_MS);
        continue;
      }
      await client.from("wikidata_description_jobs").update({
        status: counts.failed > 0 ? "completed_with_errors" : "completed",
        finished_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq("job_key", JOB_KEY);
      return;
    }

    const qids = items.map((item) => item.wikidataid);
    try {
      const entities = await fetchWikidataBatch(qids);
      consecutiveLagErrors = 0;
      const descriptions: Array<{ qid: string; description: string }> = [];
      const noDescription: string[] = [];
      const missingEntities: string[] = [];

      for (const qid of qids) {
        const entity = entities[qid];
        if (!entity || entity.missing !== undefined) {
          missingEntities.push(qid);
          continue;
        }
        const value = entity.descriptions?.en?.value;
        if (typeof value === "string" && value.trim()) {
          descriptions.push({ qid, description: value.trim() });
        } else {
          noDescription.push(qid);
        }
      }

      if (descriptions.length) {
        const { error } = await client.rpc("save_wikidata_english_descriptions", {
          p_items: descriptions,
        });
        if (error) throw error;
      }

      const now = new Date().toISOString();
      await updateQueue(client, descriptions.map((item) => item.qid), {
        status: "completed", processed_at: now, locked_at: null, last_error: null,
      });
      await updateQueue(client, noDescription, {
        status: "no_description", processed_at: now, locked_at: null, last_error: null,
      });
      await updateQueue(client, missingEntities, {
        status: "failed", processed_at: now, locked_at: null,
        last_error: "Entidade não encontrada no Wikidata.",
      });
    } catch (error: any) {
      const retryAfter = Number.isFinite(Number(error?.retryAfter)) ? Math.max(0, Number(error.retryAfter)) : 0;
      const errorMessage = String(error?.message || error).slice(0, 1000);
      const isTransientLag =
        Boolean(error?.isTransientLag) ||
        Number(error?.status) === 429 ||
        Number(error?.status) === 503 ||
        /maxlag|lagged|timeout|timed out|aborted|econnreset|fetch failed/i.test(errorMessage);

      if (isTransientLag) {
        consecutiveLagErrors += 1;
        const lagDelaySeconds = Math.min(
          300,
          Math.max(retryAfter, 15 * (2 ** Math.min(4, consecutiveLagErrors - 1)))
        );
        const nextRetryAt = new Date(Date.now() + lagDelaySeconds * 1000).toISOString();

        const byRestoredAttempts = new Map<number, string[]>();
        for (const item of items) {
          const restoredAttempts = Math.max(0, item.attempts - 1);
          const group = byRestoredAttempts.get(restoredAttempts) || [];
          group.push(item.wikidataid);
          byRestoredAttempts.set(restoredAttempts, group);
        }

        for (const [restoredAttempts, groupQids] of byRestoredAttempts.entries()) {
          await updateQueue(client, groupQids, {
            status: "pending",
            attempts: restoredAttempts,
            next_retry_at: nextRetryAt,
            locked_at: null,
            last_error: errorMessage,
          });
        }

        await sleep(Math.min(30_000, Math.max(RETRY_DELAY_MS, lagDelaySeconds * 1000)));
      } else {
        consecutiveLagErrors = 0;
        const nowIso = new Date().toISOString();
        for (const item of items) {
          const retry = item.attempts < MAX_ATTEMPTS;
          const exponential = Math.min(60 * 60, 30 * (2 ** Math.max(0, item.attempts - 1)));
          const delaySeconds = Math.max(exponential, Math.min(3600, retryAfter));
          await updateQueue(client, [item.wikidataid], {
            status: retry ? "pending" : "failed",
            next_retry_at: retry ? new Date(Date.now() + delaySeconds * 1000).toISOString() : nowIso,
            processed_at: retry ? null : nowIso,
            locked_at: null,
            last_error: errorMessage,
          });
        }
      }
    }

    await sleep(BATCH_DELAY_MS);
  }
}

function ensureWorker(client: SupabaseClient) {
  if (workerPromise) return;
  workerPromise = runWorker(client)
    .catch(async (error) => {
      console.error("[Wikidata descriptions] Worker stopped:", error);
      try {
        await client.from("wikidata_description_jobs").update({
          status: "error",
          last_error: String(error?.message || error).slice(0, 1000),
          updated_at: new Date().toISOString(),
        }).eq("job_key", JOB_KEY);
      } catch (updateError) {
        console.error("[Wikidata descriptions] Could not persist worker error:", updateError);
      }
    })
    .finally(() => {
      workerPromise = null;
    });
}

export function createWikidataDescriptionRouter() {
  const router = express.Router();
  router.use(rateLimitAdmin, verifyFirebaseAdmin);

  router.get("/status", async (_req, res) => {
    try {
      const client = getAdminClient();
      const [{ data: job, error }, counts] = await Promise.all([
        client.from("wikidata_description_jobs").select("*").eq("job_key", JOB_KEY).maybeSingle(),
        getCounts(client),
      ]);
      if (error) throw error;
      if (job?.status === "running" && !job.paused) ensureWorker(client);
      return res.json({ job: job || null, counts });
    } catch (error: any) {
      console.error("[Wikidata descriptions] Status error:", error);
      return res.status(503).json({ error: error?.message || "Não foi possível consultar o processamento." });
    }
  });

  const startOrResume = async (_req: Request, res: Response) => {
    try {
      const client = getAdminClient();
      const { error: seedError } = await client.rpc("seed_wikidata_description_queue");
      if (seedError) throw seedError;

      const now = new Date().toISOString();
      if (!workerPromise) {
        const { error: releaseError } = await client
          .from("wikidata_description_queue")
          .update({
            status: "pending",
            locked_at: null,
            next_retry_at: now,
            updated_at: now,
          })
          .eq("status", "processing");
        if (releaseError) throw releaseError;

        const { error: requeueLagError } = await client
          .from("wikidata_description_queue")
          .update({
            status: "pending",
            attempts: 0,
            locked_at: null,
            next_retry_at: now,
            processed_at: null,
            last_error: null,
            updated_at: now,
          })
          .eq("status", "failed")
          .or("last_error.ilike.%wdqs%,last_error.ilike.%lagged%,last_error.ilike.%maxlag%,last_error.ilike.%429%,last_error.ilike.%503%");
        if (requeueLagError) throw requeueLagError;
      }

      const { error } = await client.from("wikidata_description_jobs").upsert({
        job_key: JOB_KEY,
        status: "running",
        paused: false,
        started_at: now,
        finished_at: null,
        last_error: null,
        updated_at: now,
      }, { onConflict: "job_key" });
      if (error) throw error;
      ensureWorker(client);
      return res.json({ success: true, message: "Recuperação iniciada ou retomada." });
    } catch (error: any) {
      console.error("[Wikidata descriptions] Start error:", error);
      return res.status(503).json({ error: error?.message || "Não foi possível iniciar a recuperação." });
    }
  };

  router.post("/start", startOrResume);
  router.post("/resume", startOrResume);

  router.post("/pause", async (_req, res) => {
    try {
      const client = getAdminClient();
      const { error } = await client.from("wikidata_description_jobs").update({
        status: "paused",
        paused: true,
        updated_at: new Date().toISOString(),
      }).eq("job_key", JOB_KEY);
      if (error) throw error;
      return res.json({ success: true, message: "Pausa solicitada. O lote atual será concluído antes da interrupção." });
    } catch (error: any) {
      console.error("[Wikidata descriptions] Pause error:", error);
      return res.status(503).json({ error: error?.message || "Não foi possível pausar a recuperação." });
    }
  });

  return router;
}
