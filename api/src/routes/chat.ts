// src/routes/chat.ts
import express from "express";
import type { Request, Response } from "express";
import { z } from "zod";

const chatRouter = express.Router();

/**
 * ===== Config =====
 */
const WEB_ORIGIN = process.env.WEB_ORIGIN ?? "https://sajumon.netlify.app";
const OPENAI_MODEL = process.env.OPENAI_MODEL ?? "gpt-5-mini";
const MAX_OUTPUT_TOKENS = Number(
  process.env.OPENAI_MAX_OUTPUT_TOKENS ?? "1000"
);

// 1) "stream" 시도 시, 이 시간 내에 OpenAI 응답 헤더라도 못 받으면 폴백
const STREAM_HEADER_TIMEOUT_MS = 30000; // 30s
// 2) 전체 OpenAI 작업 타임아웃(너무 길면 사용자 경험 안 좋음)
const UPSTREAM_TOTAL_TIMEOUT_MS = 360000; // 3min

/**
 * ===== Validation =====
 */
const BodySchema = z.object({
  sessionId: z.string().min(1),
  archetypeId: z.string().min(1),
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

  // Socket hints
  req.socket.setTimeout(0);
  req.socket.setNoDelay(true);
  req.socket.setKeepAlive(true);

  res.flushHeaders?.();
  res.write(`: connected ${Date.now()}\n\n`);

  // Keep-alive to prevent Heroku H15
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

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * ===== OpenAI SSE parsing =====
 * Parses chunks separated by \n\n, reads all data: lines.
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
 * ===== OpenAI payload builders =====
 */
function buildInput(body: Body) {
  const { lang, message, history } = body;

  const system =
    lang === "ko"
      ? [
          "너는 친절하고 정확한 상담사다.",
          "바로 답부터 3~5문장으로 짧게 말해.",
          "반드시 사용자가 읽을 수 있는 텍스트 답변을 출력해.",
        ].join(" ")
      : [
          "You are a helpful assistant.",
          "Answer in 3-5 short sentences and start immediately.",
          "Always output user-visible text.",
        ].join(" ");

  return [
    { role: "system" as const, content: system },
    ...history.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
    { role: "user" as const, content: message },
  ];
}

function buildRequestBody(input: any, stream: boolean) {
  return {
    model: OPENAI_MODEL,
    input,
    stream,
    max_output_tokens: MAX_OUTPUT_TOKENS,
    // ✅ 느림/무응답 방지 (reasoning-only로 끝나는 케이스 줄임)
    reasoning: { effort: "low" },
    text: { verbosity: "low" },
  };
}

/**
 * ===== Non-stream response text extraction =====
 * Responses API는 상황에 따라 필드가 다를 수 있어 방어적으로.
 */
function extractTextFromNonStream(respJson: any): string {
  // Some responses include `output_text` convenience; fallback to scanning output items.
  if (typeof respJson?.output_text === "string") return respJson.output_text;

  const out = respJson?.output;
  if (Array.isArray(out)) {
    // Look for any text-ish fields
    for (const item of out) {
      if (typeof item?.text === "string") return item.text;
      if (typeof item?.content === "string") return item.content;
      // Some formats: item.content: [{type:'output_text', text:'...'}]
      if (Array.isArray(item?.content)) {
        for (const c of item.content) {
          if (typeof c?.text === "string") return c.text;
          if (typeof c?.value === "string") return c.value;
        }
      }
    }
  }

  // Also sometimes there is respJson.text?.value
  if (typeof respJson?.text?.value === "string") return respJson.text.value;

  return "";
}

/**
 * ===== Try stream first, fallback to non-stream =====
 */
async function tryOpenAIStreamToSSE(
  res: Response,
  input: any,
  signal: AbortSignal
): Promise<{ ok: true } | { ok: false; reason: string }> {
  console.log("[chat] stream: before fetch");

  // 헤더 수신이 너무 늦으면 폴백하도록 타임박스
  const headerController = new AbortController();
  const onAbort = () => headerController.abort();
  signal.addEventListener("abort", onAbort, { once: true });

  const headerTimer = setTimeout(() => {
    console.log("[chat] stream: header timeout -> abort stream attempt");
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
      signal: headerController.signal, // stream 시도는 별도 컨트롤러(헤더 타임아웃용)
    });

    clearTimeout(headerTimer);
    signal.removeEventListener("abort", onAbort);

    console.log("[chat] stream: after fetch", openaiRes.status);

    if (!openaiRes.ok || !openaiRes.body) {
      const t = await openaiRes.text().catch(() => "");
      return {
        ok: false,
        reason: `OpenAI stream HTTP ${openaiRes.status} ${t}`.slice(0, 300),
      };
    }

    let sentAnyToken = false;

    for await (const evt of iterateOpenAISSE(openaiRes.body as any)) {
      const e: any = evt;

      // 이벤트가 어떤 타입이든 일단 첫 이벤트를 보면 진단이 쉬움
      // console.log("[chat] stream evt type:", e?.type);

      if (e?.type === "done") break;

      // ✅ 폭넓게 토큰 추출 (파서/타입 변경에 강하게)
      const token =
        (e?.type === "response.output_text.delta" &&
          typeof e?.delta === "string" &&
          e.delta) ||
        (typeof e?.delta === "string" && e.delta) ||
        (typeof e?.output_text_delta === "string" && e.output_text_delta) ||
        (typeof e?.choices?.[0]?.delta?.content === "string" &&
          e.choices[0].delta.content) ||
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
        return {
          ok: false,
          reason: e?.error?.message ?? "OpenAI stream error",
        };
      }
    }

    // 스트림이 끝났는데도 토큰이 한 번도 없으면(= reasoning-only, 혹은 이벤트 타입 미스)
    if (!sentAnyToken) {
      return {
        ok: false,
        reason: "OpenAI stream produced no visible text tokens",
      };
    }

    sendEvent(res, "done", {});
    return { ok: true };
  } catch (e: any) {
    clearTimeout(headerTimer);
    signal.removeEventListener("abort", onAbort);

    // 헤더 타임아웃으로 abort된 경우 폴백을 위해 false 리턴
    if (e?.name === "AbortError") {
      return {
        ok: false,
        reason: "stream attempt aborted (header timeout or client abort)",
      };
    }
    return { ok: false, reason: e?.message ?? "stream attempt failed" };
  }
}

async function fallbackNonStreamToFakeStream(
  res: Response,
  input: any,
  signal: AbortSignal
): Promise<{ ok: true } | { ok: false; reason: string }> {
  console.log("[chat] fallback: before fetch");

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

    console.log("[chat] fallback: after fetch", openaiRes.status);

    if (!openaiRes.ok) {
      const t = await openaiRes.text().catch(() => "");
      return {
        ok: false,
        reason: `OpenAI HTTP ${openaiRes.status} ${t}`.slice(0, 300),
      };
    }

    const json = await openaiRes.json().catch(() => null);
    const text = json ? extractTextFromNonStream(json) : "";

    if (!text) {
      return { ok: false, reason: "OpenAI returned no text (non-stream)" };
    }

    // ✅ "가짜 스트리밍": 짧게 잘라 token 이벤트로 흘려보내기
    const chunks = text.match(/[\s\S]{1,12}/g) ?? [text];
    for (const c of chunks) {
      if ((signal as any).aborted) break;
      sendEvent(res, "token", { token: c });
      await sleep(10);
    }

    sendEvent(res, "done", {});
    return { ok: true };
  } catch (e: any) {
    if (e?.name === "AbortError") {
      return { ok: false, reason: "fallback aborted / timeout" };
    }
    return { ok: false, reason: e?.message ?? "fallback failed" };
  }
}

/**
 * ===== OPTIONS (CORS preflight) =====
 */
chatRouter.options("/", (_req, res) => {
  res.setHeader("Access-Control-Allow-Origin", WEB_ORIGIN);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.sendStatus(204);
});

/**
 * ===== POST /api/chat (SSE) =====
 */
chatRouter.post("/", async (req: Request, res: Response) => {
  console.log("[chat] start");

  const parsed = BodySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid body" });

  const cleanupSSE = sseInit(req, res);
  console.log("[chat] sse ready");

  // 유저가 탭 닫으면 upstream도 중단
  const ac = new AbortController();

  // req.on("close", () => {
  //   console.log("[chat] client closed -> abort");
  //   ac.abort();
  // });

  req.on("close", () => console.log("[chat] req closed (not aborting upstream in debug)"));


  // 전체 타임아웃(6분)
  const totalTimer = setTimeout(() => {
    console.log("[chat] total timeout -> abort");
    ac.abort();
  }, UPSTREAM_TOTAL_TIMEOUT_MS);

  try {
    const body = parsed.data as Body;
    const input = buildInput(body);

    // 사용자에게 즉시 “응답 생성 중” 느낌 주기 (선택)
    // sendEvent(res, "token", { token: body.lang === "ko" ? "생성 중…" : "Generating…" });

    // 1) stream 먼저 시도 (헤더 30초 내 안 오면 폴백)
    const streamResult = await tryOpenAIStreamToSSE(res, input, ac.signal);

    if (streamResult.ok) {
      clearTimeout(totalTimer);
      cleanupSSE();
      return;
    }

    console.log("[chat] stream failed -> fallback:", streamResult.reason);

    // 2) non-stream으로 받아서 가짜 스트리밍
    const fallbackResult = await fallbackNonStreamToFakeStream(
      res,
      input,
      ac.signal
    );

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
    if (e?.name === "AbortError") {
      sendEvent(res, "error", { error: "Request aborted / timeout" });
    } else {
      sendEvent(res, "error", { error: e?.message ?? "server error" });
    }
    res.end();
    clearTimeout(totalTimer);
    cleanupSSE();
  }
});

export default chatRouter;
