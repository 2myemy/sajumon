// src/routes/chat.ts
import express from "express";
import type { Request, Response } from "express";
import { z } from "zod";

const chatRouter = express.Router();

/**
 * ✅ Request body validation
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

const WEB_ORIGIN = process.env.WEB_ORIGIN ?? "https://sajumon.netlify.app";
const OPENAI_MODEL = process.env.OPENAI_MODEL ?? "gpt-5-mini";
const MAX_OUTPUT_TOKENS = Number(process.env.OPENAI_MAX_OUTPUT_TOKENS ?? "450");

/**
 * ✅ SSE helpers
 */
type SSEEventName = "token" | "done" | "error";

function sseInit(req: Request, res: Response) {
  // Heroku idle 방지 + 프록시 버퍼링 방지
  res.writeHead(200, {
    "Access-Control-Allow-Origin": WEB_ORIGIN,
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });

  // Socket keep-alive (안전장치)
  req.socket.setTimeout(0);
  req.socket.setNoDelay(true);
  req.socket.setKeepAlive(true);

  res.flushHeaders?.();

  // 첫 바이트를 즉시 보내서 “연결 활성화”
  res.write(`: connected ${Date.now()}\n\n`);

  // 15초마다 ping (Heroku H15 idle 방지)
  const keepAlive = setInterval(() => {
    res.write(`: ping ${Date.now()}\n\n`);
  }, 15000);

  const cleanup = () => clearInterval(keepAlive);
  req.on("close", cleanup);
  res.on("close", cleanup);

  return cleanup;
}

function sendEvent(res: Response, event: SSEEventName, data: unknown) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

function safeJsonParse<T = any>(s: string): T | null {
  try {
    return JSON.parse(s) as T;
  } catch {
    return null;
  }
}

/**
 * ✅ Parse OpenAI SSE stream (data: ... \n\n)
 * - yields parsed JSON objects (or { type:"done" })
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

      if (dataLines.length === 0) continue;

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
 * ✅ OPTIONS (CORS preflight)
 */
chatRouter.options("/", (_req, res) => {
  res.setHeader("Access-Control-Allow-Origin", WEB_ORIGIN);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.sendStatus(204);
});

/**
 * ✅ POST /api/chat (SSE)
 */
chatRouter.post("/", async (req: Request, res: Response) => {
  console.log("[chat] start");

  const parsed = BodySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid body" });

  const cleanupSSE = sseInit(req, res);
  console.log("[chat] sse ready");

  const ac = new AbortController();
  req.on("close", () => ac.abort());

  // OpenAI가 오래 걸리면 그냥 끊지 말고 timeout으로 abort + error 이벤트
  const upstreamTimeout = setTimeout(() => {
    console.log("[chat] openai timeout -> abort");
    ac.abort();
  }, 45000);

  try {
    const { message, history, lang } = parsed.data as Body;

    const input = [
      {
        role: "system" as const,
        content:
          lang === "ko"
            ? "너는 친절하고 정확한 상담사다. 짧고 명확하게 답한다."
            : "You are a helpful assistant. Be concise and clear.",
      },
      ...history.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
      { role: "user" as const, content: message },
    ];

    console.log("[chat] before openai fetch", {
      hasKey: Boolean(process.env.OPENAI_API_KEY),
      keyLen: (process.env.OPENAI_API_KEY ?? "").length,
      model: OPENAI_MODEL,
      max: MAX_OUTPUT_TOKENS,
    });

    const openaiRes = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY ?? ""}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        input,
        stream: true,
        max_output_tokens: MAX_OUTPUT_TOKENS,
      }),
      signal: ac.signal,
    });

    clearTimeout(upstreamTimeout);
    console.log("[chat] after openai fetch", openaiRes.status);

    if (!openaiRes.ok || !openaiRes.body) {
      const errText = await openaiRes.text().catch(() => "");
      sendEvent(res, "error", {
        error: `OpenAI HTTP ${openaiRes.status} ${errText}`.slice(0, 800),
      });
      res.end();
      cleanupSSE();
      return;
    }

    // Stream loop
    for await (const evt of iterateOpenAISSE(openaiRes.body as unknown as ReadableStream<Uint8Array>)) {
      const e: any = evt;

      // (디버그 원하면 주석 해제)
      // console.log("[chat] openai evt type:", e?.type);

      if (e?.type === "done") {
        sendEvent(res, "done", {});
        res.end();
        cleanupSSE();
        return;
      }

      // ✅ 다양한 이벤트/포맷을 폭넓게 커버 (stream parsing 흔들려도 토큰 흘려보내기)
      const token =
        (e?.type === "response.output_text.delta" && typeof e?.delta === "string" && e.delta) ||
        (typeof e?.delta === "string" && e.delta) ||
        (typeof e?.output_text_delta === "string" && e.output_text_delta) ||
        (typeof e?.response?.output_text_delta === "string" && e.response.output_text_delta) ||
        (typeof e?.choices?.[0]?.delta?.content === "string" && e.choices[0].delta.content) ||
        "";

      if (token) {
        sendEvent(res, "token", { token });
        continue;
      }

      // ✅ 종료/에러를 폭넓게 처리
      if (e?.type === "response.completed" || e?.type === "response.complete") {
        sendEvent(res, "done", {});
        res.end();
        cleanupSSE();
        return;
      }

      if (e?.type === "error" || e?.type === "response.failed") {
        sendEvent(res, "error", { error: e?.error?.message ?? "OpenAI error" });
        res.end();
        cleanupSSE();
        return;
      }
    }

    // 스트림이 조용히 끝난 경우
    sendEvent(res, "done", {});
    res.end();
    cleanupSSE();
  } catch (e: any) {
    clearTimeout(upstreamTimeout);

    if (e?.name === "AbortError") {
      sendEvent(res, "error", { error: "Request aborted / timeout" });
      res.end();
      cleanupSSE();
      return;
    }

    console.error("[chat] server error", e?.message ?? e);
    sendEvent(res, "error", { error: e?.message ?? "server error" });
    res.end();
    cleanupSSE();
  }
});

export default chatRouter;
