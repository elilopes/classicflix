import express, { type Request, type Response, type NextFunction } from "express";

const ADMIN_EMAIL = "liclopes@gmail.com";
const FIREBASE_WEB_API_KEY =
  process.env.FIREBASE_WEB_API_KEY || "AIzaSyBLtswBOdch7tmJ1yySKi-S0HG7j_ZkSP0";
const MAX_QIDS_PER_BATCH = 50;
const requestWindows = new Map<string, { startedAt: number; count: number }>();


async function verifyFirebaseAdmin(req: Request, res: Response, next: NextFunction) {
  const match = (req.headers.authorization || "").match(/^Bearer\s+(.+)$/i);
  if (!match) return res.status(401).json({ error: "Autenticação Firebase necessária." });
  try {
    const response = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(FIREBASE_WEB_API_KEY)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken: match[1] }),
        signal: AbortSignal.timeout(10000),
      }
    );
    const payload = await response.json().catch(() => ({})) as any;
    const user = payload?.users?.[0];
    if (!response.ok || !user) return res.status(401).json({ error: "Token Firebase inválido ou expirado." });
    if (user.disabled === true || user.emailVerified !== true ||
        String(user.email || "").toLowerCase() !== ADMIN_EMAIL) {
      return res.status(403).json({ error: "Conta sem permissão para auditar o catálogo." });
    }
    return next();
  } catch (error) {
    console.error("[Wikidata catalog audit] Firebase verification failed:", error);
    return res.status(503).json({ error: "Não foi possível validar a autenticação agora." });
  }
}

function rateLimit(req: Request, res: Response, next: NextFunction) {
  const forwarded = req.headers["x-forwarded-for"];
  const ip = (Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(",")[0])?.trim() ||
    req.socket.remoteAddress || "unknown";
  const now = Date.now();
  const current = requestWindows.get(ip);
  if (!current || now - current.startedAt >= 60_000) {
    requestWindows.set(ip, { startedAt: now, count: 1 });
    return next();
  }
  if (current.count >= 100) {
    return res.status(429).json({ error: "Limite de auditoria atingido. Aguarde um minuto." });
  }
  current.count += 1;
  return next();
}

export const createWikidataCatalogAuditRouter = () => {
  const router = express.Router();
  router.use(verifyFirebaseAdmin, rateLimit);

  router.post("/batch", async (req, res) => {
    const rawQids = Array.isArray(req.body?.qids) ? req.body.qids : [];
    const qids = [...new Set(rawQids.map((value: unknown) =>
      typeof value === "string" ? value.trim().toUpperCase() : ""
    ).filter((value: string) => /^Q[1-9]\d*$/.test(value)))];

    if (!qids.length) return res.status(400).json({ error: "Informe ao menos um QID válido." });
    if (qids.length > MAX_QIDS_PER_BATCH) {
      return res.status(400).json({ error: `O lote pode conter no máximo ${MAX_QIDS_PER_BATCH} QIDs.` });
    }

    try {
      const params = new URLSearchParams({
        action: "wbgetentities",
        ids: qids.join("|"),
        props: "labels|claims",
        languages: "en|pt|fr|es|de|it|ja",
        format: "json",
        formatversion: "2",
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
        const retryAfter = response.headers.get("retry-after");
        return res.status(response.status === 429 ? 429 : 502).json({
          error: payload?.error?.info || `Wikidata respondeu HTTP ${response.status}.`,
          retryAfter: retryAfter ? Number(retryAfter) : null,
          transient: response.status === 429 || response.status === 503 ||
            String(payload?.error?.code || "").toLowerCase() === "maxlag",
        });
      }
      return res.json({ entities: payload.entities || {}, warnings: payload.warnings || null });
    } catch (error: any) {
      console.error("[Wikidata catalog audit] batch failed:", error);
      return res.status(502).json({ error: error?.name === "TimeoutError" ? "Tempo limite ao consultar o Wikidata." : "Falha de rede ao consultar o Wikidata.", transient: true });
    }
  });

  return router;
};
