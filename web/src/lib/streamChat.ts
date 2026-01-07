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

  // done 이벤트를 받았는지 추적
  let gotDoneEvent = false;

  try {
    const res = await fetch(`${API_BASE}/api/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // 있으면 SSE 라우팅/프록시에서 도움이 됨
        "Accept": "text/event-stream",
      },
      body: JSON.stringify({
        sessionId: params.sessionId,
        archetypeId: params.archetypeId,
        lang: params.lang,
        message: params.message,
        history: params.history,
      }),
      signal: params.signal,
      cache: "no-store",
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
            if (typeof token === "string" && token.length) params.onToken(token);
          } catch {}
          continue;
        }

        if (event === "done") {
          gotDoneEvent = true;
          // ✅ 여기서 return 하지 말고 루프를 종료시켜 자연스럽게 마무리
          break;
        }

        if (event === "error") {
          let msg = "unknown";
          if (data) {
            try {
              const obj = JSON.parse(data);
              msg = obj?.error ?? msg;
            } catch {}
          }
          safeError(msg);
          return;
        }
      }

      if (gotDoneEvent) break;
    }

    // done 이벤트를 받았든, 스트림이 그냥 끝났든 정상 종료 처리
    safeDone();
  } catch (e: any) {
    // ✅ Abort는 정상 취소로 처리 (에러로 올리지 않기)
    if (e?.name === "AbortError" || params.signal?.aborted) {
      safeDone();
      return;
    }
    safeError(e?.message ?? "stream error");
  } finally {
    // ✅ abort인 경우에만 cancel (정상 흐름에서는 서버가 res.end() 할 때까지 두는 게 안전)
    if (reader && (params.signal?.aborted || !gotDoneEvent)) {
      try {
        await reader.cancel();
      } catch {}
    }
  }
}
