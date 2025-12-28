export type ChatMsg = { role: "user" | "assistant"; content: string };
const API_BASE = import.meta.env.VITE_API_BASE_URL || "";

type SSEParsed = { event?: string; data?: string };

function parseSSEChunk(chunk: string): SSEParsed {
  // SSE 한 이벤트 블록(= \n\n로 구분) 파싱
  const lines = chunk.split("\n");

  let event: string | undefined;
  const dataLines: string[] = [];

  for (const line of lines) {
    // comment / ping (": ...") 무시
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
  signal?: AbortSignal; // ✅ optional: 외부에서 취소 가능
}) {
  const controller = new AbortController();

  // 외부 signal이 있으면 연결
  const abortFromOutside = () => controller.abort();
  params.signal?.addEventListener("abort", abortFromOutside);

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
      params.onError(`HTTP ${res.status} ${txt}`.slice(0, 200));
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      const parts = buffer.split("\n\n");
      buffer = parts.pop() ?? "";

      for (const part of parts) {
        const { event, data } = parseSSEChunk(part);
        if (!event) continue; // ping/comment 블록은 여기서 그냥 넘어감
        if (!data) continue;

        if (event === "token") {
          try {
            const obj = JSON.parse(data);
            const token = obj?.token;
            if (typeof token === "string" && token.length) params.onToken(token);
          } catch {
            // 잘린 JSON이면 무시 (서버쪽이 \n\n 단위로 잘 보내는지 확인 필요)
          }
          continue;
        }

        if (event === "done") {
          params.onDone();
          return;
        }

        if (event === "error") {
          try {
            const obj = JSON.parse(data);
            params.onError(obj?.error ?? "unknown");
          } catch {
            params.onError("unknown");
          }
          return;
        }
      }
    }

    params.onDone();
  } catch (e: any) {
    if (e?.name === "AbortError") {
      params.onError("aborted");
      return;
    }
    params.onError(e?.message ?? "stream error");
  } finally {
    params.signal?.removeEventListener("abort", abortFromOutside);
  }
}
