// src/routes/chat.ts
import express from "express";
import type { Request, Response } from "express";
import { z } from "zod";
import characters from "../../data/characters-60.json";

type Lang = "en" | "ko";

type Persona = {
  voice?: Record<Lang, string[]>;
  extraRules?: Record<Lang, string[]>;
  do?: Record<Lang, string[]>;
  dont?: Record<Lang, string[]>;
  signature?: {
    closing?: Record<Lang, string>;
    catchphrases?: Record<Lang, string[]>;
  };
};

type Character = {
  id: string;
  title: string;
  tagline: string;
  keywords: string[];
  strengths: string[];
  pitfalls: string[];
  adviceTone: string;
  animal: { name: string; image: string; traits: string[] };
  persona?: Persona;
};

const CHARACTERS = characters as Record<string, Character>;

// ✅ 캐릭터 JSON 키로 archetypeId를 제한 (오타/임의문자열 방지)
const ArchetypeIdSchema = z.enum(Object.keys(CHARACTERS) as [string, ...string[]]);

const chatRouter = express.Router();

/**
 * ===== Config =====
 */
const WEB_ORIGIN = process.env.WEB_ORIGIN ?? "https://sajumon.netlify.app";
const OPENAI_MODEL = process.env.OPENAI_MODEL ?? "gpt-5-mini";
const MAX_OUTPUT_TOKENS = Number(process.env.OPENAI_MAX_OUTPUT_TOKENS ?? "1000");
const STREAM_HEADER_TIMEOUT_MS = 15000; // 15s
const UPSTREAM_TOTAL_TIMEOUT_MS = 180000; // 3min

/**
 * ===== Validation =====
 */
const BodySchema = z.object({
  sessionId: z.string().min(1),
  archetypeId: ArchetypeIdSchema,
  lang: z.enum(["en", "ko"]),
  message: z.string().min(1),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string(),
      })
    )
    .default([]),
});

type Body = z.infer<typeof BodySchema>;

/**
 * ===== SSE helpers =====
 */
type SSEEventName = "token" | "done" | "error";

function sseInit(req: Request, res: Response) {
  res.writeHead(200, {
    "Access-Control-Allow-Origin": WEB_ORIGIN,
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });

  req.socket.setTimeout(0);
  req.socket.setNoDelay(true);
  req.socket.setKeepAlive(true);

  res.flushHeaders?.();
  res.write(`: connected ${Date.now()}\n\n`);

  // Keep-alive (Heroku 등에서 커넥션 유지)
  const keepAlive = setInterval(() => {
    res.write(`: ping ${Date.now()}\n\n`);
    (res as any).flush?.();
  }, 15000);

  const cleanup = () => clearInterval(keepAlive);
  req.on("close", cleanup);
  res.on("close", cleanup);

  return cleanup;
}

function sendEvent(res: Response, event: SSEEventName, data: unknown) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
  (res as any).flush?.();
}

function safeJsonParse<T = any>(s: string): T | null {
  try {
    return JSON.parse(s) as T;
  } catch {
    return null;
  }
}

/**
 * ===== OpenAI SSE parsing =====
 */
async function* iterateOpenAISSE(body: ReadableStream<Uint8Array>) {
  const reader = body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    const parts = buffer.split("\n\n");
    buffer = parts.pop() ?? "";

    for (const part of parts) {
      const dataLines = part
        .split("\n")
        .filter((l) => l.startsWith("data:"))
        .map((l) => l.slice("data:".length).trim());

      if (!dataLines.length) continue;

      const dataStr = dataLines.join("\n");
      if (dataStr === "[DONE]") {
        yield { type: "done" as const };
        continue;
      }

      const obj = safeJsonParse<any>(dataStr);
      if (obj) yield obj;
    }
  }
}

/**
 * ===== Global (common) rules =====
 * 최소 세트: 모든 캐릭터에 공통 적용
 */
const BASE_RULES: Record<Lang, string[]> = {
  ko: [
    "단정/절대 표현(무조건/절대)을 피하고 현실적인 선택지를 2~3개 제시한다.",
    "짧은 문단과 불릿으로 정리한다(장문 금지).",
    "항상 다음 행동(Next steps) 1~3개를 포함한다.",
    "질문이 필요하면 1개만 한다(최대 1문항).",
    "죄책감/불안을 유발하거나 압박하지 않는다.",
    "불확실하면 불확실하다고 말하고, 추측은 추측이라고 표시한다.",
  ],
  en: [
    "Avoid absolutes; present 2-3 realistic options.",
    "Prefer short paragraphs and bullets (no long essays).",
    "Always include 1-3 concrete next steps.",
    "Ask at most one question if needed.",
    "Do not induce guilt/anxiety or pressure the user.",
    "Be transparent about uncertainty; label guesses as guesses.",
  ],
};

function buildCharacterSystemPrompt(body: Body) {
  const { archetypeId, lang } = body;
  const ch = CHARACTERS[archetypeId]; // ✅ enum으로 검증됐으니 항상 존재

  const p = ch?.persona;
  const voice = p?.voice?.[lang]?.join(", ");
  const extra = p?.extraRules?.[lang] ?? [];
  const dos = p?.do?.[lang] ?? [];
  const donts = p?.dont?.[lang] ?? [];
  const closing = p?.signature?.closing?.[lang];
  const catchphrases = p?.signature?.catchphrases?.[lang] ?? [];

  const lines: string[] = [];

  // identity + tone
  lines.push(
    lang === "ko"
      ? `너는 "${ch?.title}"다. 태그라인: ${ch?.tagline}`
      : `You are "${ch?.title}". Tagline: ${ch?.tagline}`
  );
  lines.push(lang === "ko" ? `조언 톤: ${ch?.adviceTone}` : `Advice tone: ${ch?.adviceTone}`);

  // ✅ common rules only here
  lines.push((lang === "ko" ? "공통 규칙:" : "Global rules:") + "\n- " + BASE_RULES[lang].join("\n- "));

  // ✅ persona only here (character-60.json에 포함)
  if (voice) lines.push(lang === "ko" ? `말투/보이스: ${voice}` : `Voice: ${voice}`);

  if (extra.length) {
    lines.push((lang === "ko" ? "캐릭터 추가 규칙:" : "Character rules:") + "\n- " + extra.join("\n- "));
  }
  if (dos.length) {
    lines.push((lang === "ko" ? "해야 할 것:" : "Do:") + "\n- " + dos.join("\n- "));
  }
  if (donts.length) {
    lines.push((lang === "ko" ? "하지 말 것:" : "Don't:") + "\n- " + donts.join("\n- "));
  }
  if (closing) {
    lines.push(
      lang === "ko"
        ? `가능하면 답변 마지막은 이렇게 마무리: "${closing}"`
        : `When appropriate, end with: "${closing}"`
    );
  }
  if (catchphrases.length) {
    lines.push(
      lang === "ko"
        ? `가끔(남발 금지) 이런 문구를 자연스럽게 섞어도 된다:\n- ${catchphrases.join("\n- ")}`
        : `Occasionally (do not overuse), you may weave in:\n- ${catchphrases.join("\n- ")}`
    );
  }

  lines.push(lang === "ko" ? "반드시 텍스트로만 답해." : "Always output user-visible text.");
  return lines.join("\n\n");
}

/**
 * ===== OpenAI payload builders =====
 */
function buildInput(body: Body) {
  const system = buildCharacterSystemPrompt(body);

  return [
    { role: "system" as const, content: system },
    ...body.history.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
    { role: "user" as const, content: body.message },
  ];
}

function buildRequestBody(input: any, stream: boolean) {
  return {
    model: OPENAI_MODEL,
    input,
    stream,
    max_output_tokens: MAX_OUTPUT_TOKENS,
    reasoning: { effort: "low" },
    text: { verbosity: "low" },
  };
}

/**
 * ===== Non-stream response text extraction =====
 */
function extractTextFromNonStream(respJson: any): string {
  if (typeof respJson?.output_text === "string") return respJson.output_text;

  const out = respJson?.output;
  if (Array.isArray(out)) {
    for (const item of out) {
      if (typeof item?.text === "string") return item.text;
      if (typeof item?.content === "string") return item.content;
      if (Array.isArray(item?.content)) {
        for (const c of item.content) {
          if (typeof c?.text === "string") return c.text;
          if (typeof c?.value === "string") return c.value;
        }
      }
    }
  }

  if (typeof respJson?.text?.value === "string") return respJson.text.value;
  return "";
}

async function fallbackNonStreamToFakeStream(
  res: Response,
  input: any,
  signal: AbortSignal
): Promise<{ ok: true } | { ok: false; reason: string }> {
  try {
    const openaiRes = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY ?? ""}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(buildRequestBody(input, false)),
      signal,
    });

    if (!openaiRes.ok) {
      const t = await openaiRes.text().catch(() => "");
      return { ok: false, reason: `OpenAI HTTP ${openaiRes.status} ${t}`.slice(0, 300) };
    }

    const json = await openaiRes.json().catch(() => null);
    const text = json ? extractTextFromNonStream(json) : "";

    if (!text) return { ok: false, reason: "OpenAI returned no text (non-stream)" };

    for (const ch of text) {
      if (signal.aborted) return { ok: false, reason: "aborted" };
      sendEvent(res, "token", { token: ch });
    }

    sendEvent(res, "done", {});
    return { ok: true };
  } catch (e: any) {
    if (e?.name === "AbortError") return { ok: false, reason: "aborted" };
    return { ok: false, reason: e?.message ?? "fallback failed" };
  }
}

async function tryOpenAIStreamToSSE(
  res: Response,
  input: any,
  signal: AbortSignal
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const headerController = new AbortController();
  const onAbort = () => headerController.abort();
  signal.addEventListener("abort", onAbort, { once: true });

  const headerTimer = setTimeout(() => {
    headerController.abort();
  }, STREAM_HEADER_TIMEOUT_MS);

  try {
    const openaiRes = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY ?? ""}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(buildRequestBody(input, true)),
      signal: headerController.signal,
    });

    clearTimeout(headerTimer);
    signal.removeEventListener("abort", onAbort);

    if (!openaiRes.ok || !openaiRes.body) {
      const t = await openaiRes.text().catch(() => "");
      return { ok: false, reason: `OpenAI stream HTTP ${openaiRes.status} ${t}`.slice(0, 300) };
    }

    let sentAnyToken = false;

    for await (const evt of iterateOpenAISSE(openaiRes.body as any)) {
      const e: any = evt;
      if (e?.type === "done") break;

      const token =
        (e?.type === "response.output_text.delta" && typeof e?.delta === "string" && e.delta) ||
        (typeof e?.delta === "string" && e.delta) ||
        (typeof e?.output_text_delta === "string" && e.output_text_delta) ||
        (typeof e?.choices?.[0]?.delta?.content === "string" && e.choices[0].delta.content) ||
        "";

      if (token) {
        sentAnyToken = true;
        sendEvent(res, "token", { token });
        continue;
      }

      if (e?.type === "response.completed" || e?.type === "response.complete") {
        sendEvent(res, "done", {});
        return { ok: true };
      }

      if (e?.type === "error" || e?.type === "response.failed") {
        return { ok: false, reason: e?.error?.message ?? "OpenAI stream error" };
      }
    }

    if (!sentAnyToken) {
      return { ok: false, reason: "OpenAI stream produced no visible text tokens" };
    }

    sendEvent(res, "done", {});
    return { ok: true };
  } catch (e: any) {
    clearTimeout(headerTimer);
    signal.removeEventListener("abort", onAbort);

    if (e?.name === "AbortError") {
      return { ok: false, reason: "stream attempt aborted (header timeout or client abort)" };
    }
    return { ok: false, reason: e?.message ?? "stream attempt failed" };
  }
}

/**
 * ===== Route =====
 */
chatRouter.post("/", async (req: Request, res: Response) => {
  const cleanupSSE = sseInit(req, res);

  const parsed = BodySchema.safeParse(req.body);
  if (!parsed.success) {
    sendEvent(res, "error", { error: "Invalid request body" });
    res.end();
    cleanupSSE();
    return;
  }

  const body = parsed.data;

  const ac = new AbortController();
  const totalTimer = setTimeout(() => ac.abort(), UPSTREAM_TOTAL_TIMEOUT_MS);

  try {
    const input = buildInput(body);

    const streamResult = await tryOpenAIStreamToSSE(res, input, ac.signal);
    if (streamResult.ok) {
      clearTimeout(totalTimer);
      cleanupSSE();
      return;
    }

    const fallbackResult = await fallbackNonStreamToFakeStream(res, input, ac.signal);
    if (!fallbackResult.ok) {
      sendEvent(res, "error", { error: fallbackResult.reason });
      res.end();
      clearTimeout(totalTimer);
      cleanupSSE();
      return;
    }

    res.end();
    clearTimeout(totalTimer);
    cleanupSSE();
  } catch (e: any) {
    sendEvent(res, "error", {
      error: e?.name === "AbortError" ? "Request aborted / timeout" : e?.message ?? "server error",
    });
    res.end();
    clearTimeout(totalTimer);
    cleanupSSE();
  }
});

export default chatRouter;
