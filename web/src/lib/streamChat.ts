export type ChatMsg = { role: "user" | "assistant"; content: string };

const API_BASE = import.meta.env.VITE_API_BASE_URL || "";

type SSEParsed = { event?: string; data?: string };

function parseSSEChunk(chunk: string): SSEParsed {
  // chunk is a single SSE message WITHOUT the trailing blank line
  // expected:
  // event: token
  // data: {"token":"..."}
  const lines = chunk.split("\n");
  let event: string | undefined;
  const dataLines: string[] = [];

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line) continue;
    if (line.startsWith(":")) continue; // comment / ping

    if (line.startsWith("event:")) {
      event = line.slice("event:".length).trim();
      continue;
    }
    if (line.startsWith("data:")) {
      dataLines.push(line.slice("data:".length).trim());
      continue;
    }
  }

  const data = dataLines.length ? dataLines.join("\n") : undefined;
  return { event, data };
}

export async function streamChat(params: {
  sessionId: string;
  archetypeId: string;
  lang: "en" | "ko";
  message: string;
  history: ChatMsg[];
  onToken: (t: string) => void;
  onDone: () => void;
  onError: (err: string) => void;
  signal?: AbortSignal;
}) {
  if (!API_BASE) {
    params.onError("Missing VITE_API_BASE_URL");
    return;
  }

  const controller = new AbortController();

  // external signal -> internal controller
  const abortFromOutside = () => controller.abort("aborted-from-outside");
  const outside = params.signal;

  if (outside) {
    if (outside.aborted) controller.abort("outside-already-aborted");
    else outside.addEventListener("abort", abortFromOutside, { once: true });
  }

  let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  let sawDoneEvent = false;

  try {
    const res = await fetch(`${API_BASE}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: params.sessionId,
        archetypeId: params.archetypeId,
        lang: params.lang,
        message: params.message,
        history: params.history,
      }),
      signal: controller.signal,
    });

    if (!res.ok || !res.body) {
      const txt = await res.text().catch(() => "");
      params.onError(`HTTP ${res.status} ${txt}`.slice(0, 300));
      return;
    }

    reader = res.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // IMPORTANT: normalize CRLF -> LF for reliable splitting
      if (buffer.includes("\r")) buffer = buffer.replace(/\r/g, "");

      // SSE messages separated by blank line
      const parts = buffer.split("\n\n");
      buffer = parts.pop() ?? "";

      for (const part of parts) {
        const { event, data } = parseSSEChunk(part);
        if (!event) continue;

        if (event === "token") {
          if (!data) continue;
          try {
            const obj = JSON.parse(data);
            const token = obj?.token;
            if (typeof token === "string" && token.length) params.onToken(token);
          } catch {
            // ignore malformed token payload
          }
          continue;
        }

        if (event === "done") {
          sawDoneEvent = true;
          await reader.cancel().catch(() => {});
          reader = null;
          params.onDone();
          return;
        }

        if (event === "error") {
          if (data) {
            try {
              const obj = JSON.parse(data);
              params.onError(obj?.error ?? "unknown");
            } catch {
              params.onError("unknown");
            }
          } else {
            params.onError("unknown");
          }
          await reader.cancel().catch(() => {});
          reader = null;
          return;
        }

        // ignore other events
      }
    }

    // Stream ended without "done"
    if (!sawDoneEvent) {
      params.onError("stream closed without done");
      return;
    }

    params.onDone();
  } catch (e: any) {
    // AbortError is a normal cancellation path (page nav, unmount, user stop)
    if (e?.name === "AbortError") {
      return; // silent
    }
    params.onError(e?.message ?? "stream error");
  } finally {
    if (outside) outside.removeEventListener("abort", abortFromOutside);
    if (reader) {
      try {
        await reader.cancel();
      } catch {
        // ignore
      }
    }
  }
}
