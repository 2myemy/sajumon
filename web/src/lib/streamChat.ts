export type ChatMsg = { role: "user" | "assistant"; content: string };

const API_BASE = import.meta.env.VITE_API_BASE_URL || "";

type SSEParsed = { event?: string; data?: string };

function parseSSEChunk(chunk: string): SSEParsed {
  const lines = chunk.split("\n");
  let event: string | undefined;
  const dataLines: string[] = [];

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line) continue;
    if (line.startsWith(":")) continue;

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

  const message = params.message.trim();
  if (!message) {
    params.onError("Empty message");
    return;
  }

  const controller = new AbortController();
  const abortFromOutside = () => controller.abort("outside-signal");

  if (params.signal) {
    if (params.signal.aborted) controller.abort("outside-already-aborted");
    else params.signal.addEventListener("abort", abortFromOutside, { once: true });
  }

  let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;

  try {
    const res = await fetch(`${API_BASE}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: params.sessionId,
        archetypeId: params.archetypeId,
        lang: params.lang,
        message,
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

      // CRLF normalize
      if (buffer.includes("\r")) buffer = buffer.replace(/\r/g, "");

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
            // ignore malformed payload
          }
          continue;
        }

        if (event === "error") {
          let msg = "unknown";
          if (data) {
            try {
              const obj = JSON.parse(data);
              msg = obj?.error ?? "unknown";
            } catch {}
          }
          await reader.cancel().catch(() => {});
          reader = null;
          params.onError(msg);
          return;
        }

        if (event === "done") {
          await reader.cancel().catch(() => {});
          reader = null;
          params.onDone();
          return;
        }
      }
    }

    // EOF without explicit done: still finish to avoid stuck UI
    params.onDone();
  } catch (e: any) {
    if (e?.name === "AbortError") return; // silent cancel
    params.onError(e?.message ?? "stream error");
  } finally {
    params.signal?.removeEventListener("abort", abortFromOutside);
    if (reader) {
      try {
        await reader.cancel();
      } catch {}
    }
  }
}
