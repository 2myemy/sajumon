export type ChatMsg = { role: "user" | "assistant"; content: string };

const API_BASE = import.meta.env.VITE_API_BASE_URL || "";

type SSEParsed = { event?: string; data?: string };

function parseSSEBlock(block: string): SSEParsed {
  const lines = block.split("\n");
  let event: string | undefined;
  const dataLines: string[] = [];

  for (const line of lines) {
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

  let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;

  // ensure callbacks fire once
  let finished = false;
  const safeDone = () => {
    if (finished) return;
    finished = true;
    params.onDone();
  };
  const safeError = (err: string) => {
    if (finished) return;
    finished = true;
    params.onError(err);
  };

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
      // ✅ use caller signal directly (no nested AbortController)
      signal: params.signal,
    });

    if (!res.ok || !res.body) {
      const txt = await res.text().catch(() => "");
      safeError(`HTTP ${res.status} ${txt}`.slice(0, 200));
      return;
    }

    reader = res.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      if (buffer.includes("\r")) buffer = buffer.replace(/\r/g, "");

      // SSE events separated by blank line
      const blocks = buffer.split("\n\n");
      buffer = blocks.pop() ?? "";

      for (const block of blocks) {
        const { event, data } = parseSSEBlock(block);
        if (!event) continue;

        if (event === "token") {
          if (!data) continue;
          try {
            const obj = JSON.parse(data);
            const token = obj?.token;
            if (typeof token === "string" && token.length) {
              params.onToken(token);
            }
          } catch {
            // ignore malformed token payloads
          }
          continue;
        }

        if (event === "done") {
          // server explicitly done
          safeDone();
          return;
        }

        if (event === "error") {
          let msg = "unknown";
          if (data) {
            try {
              const obj = JSON.parse(data);
              msg = obj?.error ?? msg;
            } catch {
              // ignore
            }
          }
          safeError(msg);
          return;
        }
      }
    }

    // stream ended without explicit done
    safeDone();
  } catch (e: any) {
    if (e?.name === "AbortError") {
      safeError("aborted"); // treat as normal cancel
      return;
    }
    safeError(e?.message ?? "stream error");
  } finally {
    if (reader) {
      try {
        await reader.cancel();
      } catch {
        // ignore
      }
    }
  }
}
