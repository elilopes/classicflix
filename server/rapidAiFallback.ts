const DEFAULT_RAPID_API_KEY = "8d0b2005e5msh7794ca50aee0eb4p14f460jsn249cb3b9d70b";

export interface RapidFallbackMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface RapidAiFallbackRequest {
  systemInstruction?: string;
  prompt?: string;
  messages?: RapidFallbackMessage[];
  expectJson?: boolean;
}

interface RapidProviderConfig {
  id: string;
  host: string;
  path: string;
  mode: "openai_chat" | "open_llm";
  model?: string;
}

const getRapidApiKey = (): string =>
  process.env.RAPID_API_KEY || process.env.VITE_RAPID_API_KEY || DEFAULT_RAPID_API_KEY;

const getRapidProviders = (): RapidProviderConfig[] => [
  {
    id: "llama-3.3-70b-multilingual",
    host:
      process.env.RAPID_API_HOST_LLAMA33_MULTI ||
      "llama-3-3-70b-instruct-multilingual-chat-ai-by-meta.p.rapidapi.com",
    path: "/chat/completions",
    mode: "openai_chat",
    model: "meta-llama/Llama-3.3-70B-Instruct",
  },
  {
    id: "llama-3.3-70b-instruct",
    host:
      process.env.RAPID_API_HOST_LLAMA33 ||
      "llama-3-3-70b-instruct.p.rapidapi.com",
    path: "/chat/completions",
    mode: "openai_chat",
    model: "llama-3.3-70b-instruct",
  },
  {
    id: "deepseek-r12",
    host: process.env.RAPID_API_HOST_DEEPSEEK_R12 || "deepseek-r12.p.rapidapi.com",
    path: "/chat/completions",
    mode: "openai_chat",
    model: "deepseek-r1",
  },
  {
    id: "open-llm",
    host: process.env.RAPID_API_HOST_OPEN_LLM || "open-llm.p.rapidapi.com",
    path: "/v0/llmchat",
    mode: "open_llm",
    model: "llama-3.3-70b-instruct",
  },
];

export const shouldTriggerAiFallback = (error: any): boolean => {
  const status = Number(error?.status || error?.statusCode || error?.code);
  if ([400, 401, 403, 404, 408, 429, 500, 502, 503, 504].includes(status)) {
    return true;
  }

  const msg = String(error?.message || error || "").toLowerCase();
  return (
    msg.includes("gemini_api_key is not configured") ||
    msg.includes("403") ||
    msg.includes("401") ||
    msg.includes("429") ||
    msg.includes("forbidden") ||
    msg.includes("permission_denied") ||
    msg.includes("api key") ||
    msg.includes("api_key") ||
    msg.includes("referer") ||
    msg.includes("referrer") ||
    msg.includes("quota") ||
    msg.includes("rate limit") ||
    msg.includes("resource_exhausted") ||
    msg.includes("unavailable") ||
    msg.includes("service unavailable") ||
    msg.includes("overloaded") ||
    msg.includes("503") ||
    msg.includes("502") ||
    msg.includes("504") ||
    msg.includes("deadline") ||
    msg.includes("timeout") ||
    msg.includes("econnreset") ||
    msg.includes("econnrefused") ||
    msg.includes("etimedout") ||
    msg.includes("fetch failed") ||
    msg.includes("network")
  );
};

const stripReasoningAndFences = (text: string): string => {
  return text
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
};

const extractResponseContent = (data: any): string => {
  if (!data) return "";
  if (typeof data === "string") return data.trim();

  const choiceContent = data?.choices?.[0]?.message?.content;
  if (typeof choiceContent === "string" && choiceContent.trim()) {
    return choiceContent.trim();
  }
  if (Array.isArray(choiceContent)) {
    const joined = choiceContent
      .map((part: any) => (typeof part === "string" ? part : part?.text || ""))
      .join("")
      .trim();
    if (joined) return joined;
  }

  const candidates = [
    data?.choices?.[0]?.text,
    data?.message?.content,
    data?.response,
    data?.reply,
    data?.answer,
    data?.output,
    data?.generated_text,
    data?.text,
    data?.content,
    data?.result,
    Array.isArray(data) ? data[0]?.generated_text || data[0]?.text : "",
  ];

  for (const cand of candidates) {
    if (typeof cand === "string" && cand.trim()) {
      return cand.trim();
    }
  }
  return "";
};

export const parseFallbackJson = <T = any>(rawText: string): T => {
  const cleaned = stripReasoningAndFences(rawText);
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const firstObj = cleaned.indexOf("{");
    const lastObj = cleaned.lastIndexOf("}");
    const firstArr = cleaned.indexOf("[");
    const lastArr = cleaned.lastIndexOf("]");

    const hasObj = firstObj !== -1 && lastObj > firstObj;
    const hasArr = firstArr !== -1 && lastArr > firstArr;

    if (hasArr && (!hasObj || firstArr < firstObj)) {
      return JSON.parse(cleaned.slice(firstArr, lastArr + 1)) as T;
    }
    if (hasObj) {
      return JSON.parse(cleaned.slice(firstObj, lastObj + 1)) as T;
    }
    throw new Error("Resposta JSON inválida do provedor de fallback.");
  }
};

const callAnthropicFallback = async (
  messages: RapidFallbackMessage[],
  systemInstruction?: string,
  expectJson?: boolean
): Promise<{ text: string; provider: string } | null> => {
  const anthropicKey = (process.env.ANTHROPIC_API_KEY || "").trim();
  if (!anthropicKey) return null;

  const anthropicMessages = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

  if (anthropicMessages.length === 0) return null;

  const systemParts = [
    systemInstruction,
    ...messages.filter((m) => m.role === "system").map((m) => m.content),
    expectJson ? "Return ONLY valid JSON without markdown code fences or extra commentary." : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  const models = [
    "claude-haiku-4-5",
    "claude-3-5-haiku-latest",
    "claude-sonnet-4-5",
    "claude-3-5-sonnet-latest",
  ];

  const anthropicErrors: string[] = [];
  for (const model of models) {
    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": anthropicKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model,
          max_tokens: 2048,
          ...(systemParts ? { system: systemParts } : {}),
          messages: anthropicMessages,
        }),
        signal: AbortSignal.timeout(22000),
      });

      const data: any = await response.json().catch(() => ({}));
      if (!response.ok) {
        const msg = data?.error?.message || data?.message || `HTTP ${response.status}`;
        anthropicErrors.push(`${model}: ${response.status} ${msg}`);
        if (response.status === 401 || response.status === 403) break;
        continue;
      }

      const content = Array.isArray(data?.content)
        ? data.content
            .map((part: any) => (part?.type === "text" ? part.text || "" : ""))
            .join("")
            .trim()
        : "";

      const cleaned = stripReasoningAndFences(content);
      if (!cleaned) {
        anthropicErrors.push(`${model}: resposta vazia`);
        continue;
      }

      if (expectJson) {
        parseFallbackJson(cleaned);
      }

      console.info(`[AI Fallback] Sucesso com Anthropic (${model})`);
      return { text: cleaned, provider: `anthropic:${model}` };
    } catch (err: any) {
      anthropicErrors.push(`${model}: ${err?.message || String(err)}`);
    }
  }

  if (anthropicErrors.length > 0) {
    throw new Error(`Anthropic (${anthropicErrors.join("; ")})`);
  }
  return null;
};

export const callRapidAiFallback = async (
  request: RapidAiFallbackRequest
): Promise<{ text: string; provider: string }> => {
  const messages: RapidFallbackMessage[] = [];
  if (request.systemInstruction) {
    messages.push({ role: "system", content: request.systemInstruction });
  }
  if (Array.isArray(request.messages) && request.messages.length > 0) {
    messages.push(...request.messages);
  } else if (request.prompt) {
    messages.push({ role: "user", content: request.prompt });
  }

  if (request.expectJson) {
    messages.push({
      role: "system",
      content: "Return ONLY valid JSON without markdown code fences or extra commentary.",
    });
  }

  const failures: string[] = [];

  try {
    const anthropicRes = await callAnthropicFallback(
      messages,
      request.systemInstruction,
      request.expectJson
    );
    if (anthropicRes) {
      return anthropicRes;
    }
  } catch (anthropicErr: any) {
    const reason = anthropicErr?.message || String(anthropicErr);
    console.warn(`[AI Fallback] ${reason}`);
    failures.push(reason);
  }

  const apiKey = getRapidApiKey();
  if (!apiKey) {
    throw new Error(
      failures.length > 0
        ? `Fallback falhou (${failures.join(" | ")}) e RAPID_API_KEY não configurada.`
        : "RAPID_API_KEY não configurada para fallback."
    );
  }

  const flatQuery = messages
    .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
    .join("\n\n");

  const providers = getRapidProviders();

  for (const provider of providers) {
    try {
      const bodyPayload =
        provider.mode === "open_llm"
          ? {
              llm_model: provider.model || "llama-3.3-70b-instruct",
              query: flatQuery,
            }
          : {
              model: provider.model,
              messages,
              stream: false,
            };

      const response = await fetch(`https://${provider.host}${provider.path}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-rapidapi-key": apiKey,
          "x-rapidapi-host": provider.host,
        },
        body: JSON.stringify(bodyPayload),
        signal: AbortSignal.timeout(22000),
      });

      const raw = await response.text();
      let parsed: any = null;
      try {
        parsed = JSON.parse(raw);
      } catch {
        parsed = raw;
      }

      if (!response.ok) {
        const msg =
          (parsed && typeof parsed === "object" && (parsed.message || parsed.error?.message || parsed.error)) ||
          `HTTP ${response.status}`;
        throw new Error(`${response.status}: ${msg}`);
      }

      const content = stripReasoningAndFences(extractResponseContent(parsed));
      if (!content) {
        throw new Error("Resposta vazia do modelo.");
      }

      if (request.expectJson) {
        parseFallbackJson(content);
      }

      console.info(`[AI Fallback] Sucesso com provedor ${provider.id} (${provider.host})`);
      return { text: content, provider: provider.host };
    } catch (err: any) {
      const reason = err?.message || String(err);
      console.warn(`[AI Fallback] Provedor ${provider.host} falhou: ${reason}`);
      failures.push(`${provider.host} (${reason})`);
    }
  }

  throw new Error(`Todos os provedores de fallback falharam: ${failures.join(" | ")}`);
};
