// src/routes/chat.ts
import type { Request, Response } from "express";
import express from "express";
import { z } from "zod";

const chatRouter = express.Router();

const BodySchema = z.object({
  sessionId: z.string().min(1),
  archetypeId: z.string().min(1),
  lang: z.enum(["en", "ko"]),
  message: z.string().min(1),
  history: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string() }))
    .default([]),
});

type Body = z.infer<typeof BodySchema>;

function setSSEHeaders(res: Response) {
  res.status(200);
  
  res.setHeader(
    "Access-Control-Allow-Origin",
    "https://sajumon.netlify.app"
  );
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  // flushHeaders는 express 타입에 없을 수 있어서 안전 호출
  (res as any).flushHeaders?.();
}

type SSEEventName = "token" | "done" | "error";

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
 * OpenAI SSE 스트림을 `\n\n` 단위로 나눠 `data:` 라인만 파싱해서 yield
 */
async function* iterateOpenAISSE(readableStream: ReadableStream<Uint8Array>) {
  const reader = readableStream.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    const chunks = buffer.split("\n\n");
    buffer = chunks.pop() ?? "";

    for (const chunk of chunks) {
      const dataLines = chunk
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

type OpenAIStreamEvent =
  | { type: "response.output_text.delta"; delta?: string }
  | { type: "response.completed" }
  | { type: "response.failed"; error?: { message?: string } }
  | { type: "error"; error?: { message?: string } }
  | { type: string; [k: string]: any };

chatRouter.post("/", async (req: Request, res: Response) => {
  const parsed = BodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid body" });
  }

  setSSEHeaders(res);

  const ac = new AbortController();
  req.on("close", () => ac.abort());

  try {
    const { message, history, lang, archetypeId } = parsed.data as Body;

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

    const openaiRes = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY ?? ""}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-5",
        input,
        stream: true,
        // metadata: { archetypeId },
      }),
      signal: ac.signal,
    });

    if (!openaiRes.ok || !openaiRes.body) {
      const errText = await openaiRes.text().catch(() => "");
      sendEvent(res, "error", {
        error: `OpenAI HTTP ${openaiRes.status} ${errText}`.slice(0, 500),
      });
      res.end();
      return;
    }

    for await (const evt of iterateOpenAISSE(openaiRes.body as unknown as ReadableStream<Uint8Array>)) {
      const e = evt as OpenAIStreamEvent;

      if (e.type === "response.output_text.delta") {
        const delta = e.delta;
        if (delta) sendEvent(res, "token", { token: delta });
      } else if (e.type === "response.completed") {
        sendEvent(res, "done", {});
        res.end();
        return;
      } else if (e.type === "error" || e.type === "response.failed") {
        sendEvent(res, "error", { error: e.error?.message ?? "OpenAI error" });
        res.end();
        return;
      }
    }

    // 스트림이 그냥 끝났으면 done
    sendEvent(res, "done", {});
    res.end();
  } catch (e: any) {
    if (e?.name === "AbortError") return;
    sendEvent(res, "error", { error: e?.message ?? "server error" });
    res.end();
  }
});

// ✅ CommonJS export
export = chatRouter;
