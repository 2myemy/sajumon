export type ChatMsg = { role: "user" | "assistant"; content: string };
const API_BASE = import.meta.env.VITE_API_BASE_URL || "";

export async function streamChat(params: {
  sessionId: string;
  archetypeId: string;
  lang: "en" | "ko";
  message: string;
  history: ChatMsg[];
  onToken: (t: string) => void;
  onDone: () => void;
  onError: (err: string) => void;
}) {
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
  });

  if (!res.ok || !res.body) {
    params.onError(`HTTP ${res.status}`);
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      const parts = buffer.split("\n\n");
      buffer = parts.pop() ?? "";

      for (const part of parts) {
        const lines = part.split("\n");
        const event = (lines.find((l) => l.startsWith("event:")) ?? "")
          .replace("event:", "")
          .trim();
        const dataRaw = (lines.find((l) => l.startsWith("data:")) ?? "")
          .replace("data:", "")
          .trim();

        if (event === "token") {
          const { token } = JSON.parse(dataRaw);
          if (token) params.onToken(token);
        } else if (event === "done") {
          params.onDone();
          return;
        } else if (event === "error") {
          const { error } = JSON.parse(dataRaw);
          params.onError(error ?? "unknown");
          return;
        }
      }
    }

    params.onDone();
  } catch (e: any) {
    params.onError(e?.message ?? "stream error");
  }
}
