import express from "express";
import type { Request, Response } from "express";
import { z } from "zod";
import characters from "../../data/characters-60.json";

type Lang = "en" | "ko";
type Mode = "profile" | "fortune" | "career" | "love" | "chat";

type SessionState = {
  mode?: Mode;
  slots?: {
    fortune?: {
      timeframe?: "week" | "month" | "half_year";
      topic?: "career" | "love" | "money" | "health";
    };
    career?: { goal?: "job_search" | "resume" | "interviews" | "portfolio" };
    love?: { stage?: "talking" | "dating" | "long_term" | "breakup" };
    profile?: { depth?: "summary" | "detailed" };
  };
};
const SESSION = new Map<string, SessionState>();

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
const ArchetypeIdSchema = z.enum(
  Object.keys(CHARACTERS) as [string, ...string[]]
);

const chatRouter = express.Router();

/**
 * ===== Config =====
 */
const WEB_ORIGIN = process.env.WEB_ORIGIN ?? "https://sajumon.netlify.app";
const OPENAI_MODEL = process.env.OPENAI_MODEL ?? "gpt-5-mini";
const MAX_OUTPUT_TOKENS = Number(process.env.OPENAI_MAX_OUTPUT_TOKENS ?? "300");
const STREAM_HEADER_TIMEOUT_MS = 45000;
const UPSTREAM_TOTAL_TIMEOUT_MS = 180000;

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
      z.object({ role: z.enum(["user", "assistant"]), content: z.string() })
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

  const keepAlive = setInterval(() => {
    res.write(`: ping ${Date.now()}\n\n`);
    (res as any).flush?.();
  }, 10000);

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

function sendPlainAssistant(res: Response, text: string) {
  for (const ch of text) sendEvent(res, "token", { token: ch });
  sendEvent(res, "done", {});
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
 * ===== Global rules =====
 */
const BASE_RULES: Record<Lang, string[]> = {
  ko: [
    "단정/절대 표현(무조건/절대)을 피하고 현실적인 선택지를 2~3개 제시한다.",
    "짧은 문단과 불릿으로 정리한다(장문 금지).",
    "필요할 때만 다음 행동(Next steps)을 1~3개 제시한다.",
    "질문이 필요하면 1개만 한다(최대 1문항).",
    "죄책감/불안을 유발하거나 압박하지 않는다.",
    "불확실하면 불확실하다고 말하고, 추측은 추측이라고 표시한다.",
  ],
  en: [
    "Avoid absolutes; present 2-3 realistic options.",
    "Prefer short paragraphs and bullets (no long essays).",
    "Include next steps only when they add clear value.",
    "Ask at most one question if needed.",
    "Do not induce guilt/anxiety or pressure the user.",
    "Be transparent about uncertainty; label guesses as guesses.",
  ],
};

function buildModeRules(mode: Mode, lang: Lang, state: SessionState) {
  const common =
    lang === "ko"
      ? [
          "응답 길이 규칙:",
          "- 기본 3~5문장 이내.",
          "- 불릿 최대 3개.",
          "- 결론 먼저, 이유는 짧게.",
        ].join("\n")
      : [
          "Response length rules:",
          "- Default: 3–5 sentences.",
          "- Bullets: max 3.",
          "- Lead with the conclusion; keep rationale short.",
        ].join("\n");

  const modeLine = (() => {
    if (lang === "ko") {
      switch (mode) {
        case "profile":
          return "모드: 성격 설명. 키워드/강점/주의점을 바탕으로 간결하게 설명하고, 마지막에 짧은 확인 질문 1개를 한다.";
        case "fortune":
          return `모드: 운세/흐름. 기간=${
            state.slots?.fortune?.timeframe ?? "미정"
          }, 주제=${
            state.slots?.fortune?.topic ?? "미정"
          } 기반. 단정적 예언 금지.`;
        case "career":
          return `모드: 직업/진로 코칭. 목표=${
            state.slots?.career?.goal ?? "미정"
          } 기준으로 오늘 할 수 있는 다음 행동 제시.`;
        case "love":
          return `모드: 연애/관계 코칭. 상황=${
            state.slots?.love?.stage ?? "미정"
          } 기준, 감정 압박 없이 선택지 제시.`;
        case "chat":
        default:
          return "모드: 일반 상담. 공감은 짧게, 정리와 다음 행동 위주.";
      }
    }
    switch (mode) {
      case "profile":
        return "Mode: personality. Use keywords/strengths/pitfalls succinctly, then ask 1 check-in question.";
      case "fortune":
        return `Mode: fortune/flow. timeframe=${
          state.slots?.fortune?.timeframe ?? "unset"
        }, topic=${
          state.slots?.fortune?.topic ?? "unset"
        }. No absolute predictions.`;
      case "career":
        return `Mode: career coaching. goal=${
          state.slots?.career?.goal ?? "unset"
        }; give actionable next steps.`;
      case "love":
        return `Mode: relationships coaching. stage=${
          state.slots?.love?.stage ?? "unset"
        }; no pressure; offer options.`;
      case "chat":
      default:
        return "Mode: general chat. Keep it short; prioritize clarity and next steps.";
    }
  })();

  return [modeLine, common].join("\n\n");
}

function buildCharacterSystemPrompt(body: Body, state: SessionState) {
  const { archetypeId, lang } = body;
  const ch = CHARACTERS[archetypeId];
  const p = ch?.persona;

  const voice = p?.voice?.[lang]?.join(", ");
  const extra = p?.extraRules?.[lang] ?? [];
  const dos = p?.do?.[lang] ?? [];
  const donts = p?.dont?.[lang] ?? [];
  const closing = p?.signature?.closing?.[lang];
  const catchphrases = p?.signature?.catchphrases?.[lang] ?? [];

  const lines: string[] = [];

  lines.push(
    lang === "ko"
      ? `너는 "${ch?.title}"다. 태그라인: ${ch?.tagline}`
      : `You are "${ch?.title}". Tagline: ${ch?.tagline}`
  );
  lines.push(
    lang === "ko"
      ? `조언 톤: ${ch?.adviceTone}`
      : `Advice tone: ${ch?.adviceTone}`
  );

  lines.push(
    (lang === "ko" ? "공통 규칙:" : "Global rules:") +
      "\n- " +
      BASE_RULES[lang].join("\n- ")
  );
  lines.push(buildModeRules(state.mode ?? "chat", lang, state));

  if (voice)
    lines.push(lang === "ko" ? `말투/보이스: ${voice}` : `Voice: ${voice}`);
  if (extra.length)
    lines.push(
      (lang === "ko" ? "캐릭터 추가 규칙:" : "Character rules:") +
        "\n- " +
        extra.join("\n- ")
    );
  if (dos.length)
    lines.push(
      (lang === "ko" ? "해야 할 것:" : "Do:") + "\n- " + dos.join("\n- ")
    );
  if (donts.length)
    lines.push(
      (lang === "ko" ? "하지 말 것:" : "Don't:") + "\n- " + donts.join("\n- ")
    );
  if (closing)
    lines.push(
      lang === "ko"
        ? `가능하면 마지막은: "${closing}"`
        : `When appropriate, end with: "${closing}"`
    );
  if (catchphrases.length) {
    lines.push(
      lang === "ko"
        ? `가끔(남발 금지) 자연스럽게 섞어도 되는 문구:\n- ${catchphrases.join(
            "\n- "
          )}`
        : `Occasionally (do not overuse), you may weave in:\n- ${catchphrases.join(
            "\n- "
          )}`
    );
  }

  lines.push(
    lang === "ko"
      ? "반드시 텍스트로만 답해."
      : "Always output user-visible text."
  );
  return lines.join("\n\n");
}

/**
 * ===== OpenAI builders =====
 */
function buildInput(body: Body, state: SessionState) {
  return [
    {
      role: "system" as const,
      content: buildCharacterSystemPrompt(body, state),
    },
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
) {
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
      return {
        ok: false as const,
        reason: `OpenAI HTTP ${openaiRes.status} ${t}`.slice(0, 300),
      };
    }

    const json = await openaiRes.json().catch(() => null);
    const text = json ? extractTextFromNonStream(json) : "";
    if (!text)
      return {
        ok: false as const,
        reason: "OpenAI returned no text (non-stream)",
      };

    for (const ch of text) {
      if (signal.aborted) return { ok: false as const, reason: "aborted" };
      sendEvent(res, "token", { token: ch });
    }

    sendEvent(res, "done", {});
    return { ok: true as const };
  } catch (e: any) {
    if (e?.name === "AbortError")
      return { ok: false as const, reason: "aborted" };
    return { ok: false as const, reason: e?.message ?? "fallback failed" };
  }
}

async function tryOpenAIStreamToSSE(
  res: Response,
  input: any,
  signal: AbortSignal
) {
  const headerAC = new AbortController();
  const headerTimer = setTimeout(
    () => headerAC.abort(),
    STREAM_HEADER_TIMEOUT_MS
  );

  // ✅ header timeout + client abort + total abort 모두 결합
  const combined = AbortSignal.any([signal, headerAC.signal]);

  try {
    const openaiRes = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY ?? ""}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(buildRequestBody(input, true)),
      signal: combined,
    });

    clearTimeout(headerTimer);

    if (!openaiRes.ok || !openaiRes.body) {
      const t = await openaiRes.text().catch(() => "");
      return {
        ok: false as const,
        reason: `OpenAI stream HTTP ${openaiRes.status} ${t}`.slice(0, 300),
      };
    }

    let sentAnyToken = false;

    for await (const evt of iterateOpenAISSE(openaiRes.body as any)) {
      const e: any = evt;
      if (e?.type === "done") break;

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
        return { ok: true as const };
      }

      if (e?.type === "error" || e?.type === "response.failed") {
        return {
          ok: false as const,
          reason: e?.error?.message ?? "OpenAI stream error",
        };
      }
    }

    if (!sentAnyToken)
      return {
        ok: false as const,
        reason: "OpenAI stream produced no visible text tokens",
      };

    sendEvent(res, "done", {});
    return { ok: true as const };
  } catch (e: any) {
    clearTimeout(headerTimer);
    if (e?.name === "AbortError")
      return { ok: false as const, reason: "stream attempt aborted" };
    return {
      ok: false as const,
      reason: e?.message ?? "stream attempt failed",
    };
  }
}

/**
 * ===== Mode / Slot parsing =====
 */
function parseLeadingChoice(message: string): number | null {
  const match = message.trim().match(/^([1-5])(?:\b|\s|[).:-])/);
  return match ? Number(match[1]) : null;
}

function ensureSession(sessionId: string): SessionState {
  const state = SESSION.get(sessionId) ?? {};
  state.slots = state.slots ?? {};
  SESSION.set(sessionId, state);
  return state;
}

function askModeMenu(lang: Lang) {
  return lang === "ko"
    ? "어떤 주제로 도와줄까요? 번호로 골라주세요.\n1) 성격\n2) 운세\n3) 직업/진로\n4) 연애/관계\n5) 그냥 상담"
    : "What would you like to talk about? Choose a number.\n1) My personality\n2) Fortune\n3) Work / career\n4) Relationships\n5) Just talk";
}

function modeFromChoice(n: number): Mode {
  if (n === 1) return "profile";
  if (n === 2) return "fortune";
  if (n === 3) return "career";
  if (n === 4) return "love";
  return "chat";
}

function nextQuestionForMode(
  mode: Mode,
  lang: Lang,
  state: SessionState
): string | null {
  if (lang === "ko") {
    switch (mode) {
      case "profile":
        return "좋아요. 어느 정도로 볼까요?\n1) 요약\n2) 자세히";
      case "fortune":
        return "좋아요. 기간은 어느 쪽이야?\n1) 이번 주\n2) 이번 달\n3) 2026년 상반기";
      case "career":
        return "좋아요. 지금 목표는 뭐야?\n1) 취업/지원\n2) 레주메\n3) 면접\n4) 포트폴리오";
      case "love":
        return "좋아요. 상황이 어디에 가까워?\n1) 썸/대화 중\n2) 연애 중\n3) 장기 관계\n4) 이별/정리 중";
      case "chat":
      default:
        return "좋아. 지금 가장 신경 쓰이는 한 가지가 뭐야?";
    }
  }
  switch (mode) {
    case "profile":
      return "Got it. How detailed do you want it?\n1) Summary\n2) Detailed";
    case "fortune":
      return "Got it. What timeframe?\n1) This week\n2) This month\n3) 2026 (first half)";
    case "career":
      return "Got it. What’s your main goal?\n1) Job search\n2) Resume\n3) Interviews\n4) Portfolio";
    case "love":
      return "Got it. Which best describes your situation?\n1) Talking stage\n2) Dating\n3) Long-term\n4) Breakup / moving on";
    case "chat":
    default:
      return "Okay—what’s the one thing on your mind right now?";
  }
}

function handleSlotFill(
  state: SessionState,
  body: Body
): { handled: boolean; reply?: string } {
  const lang = body.lang;
  const mode = state.mode;
  if (!mode) return { handled: false };

  const choice = parseLeadingChoice(body.message);

  if (mode === "profile") {
    if (!state.slots?.profile?.depth) {
      if (!choice || (choice !== 1 && choice !== 2)) {
        return {
          handled: true,
          reply:
            lang === "ko"
              ? "번호로 골라줘.\n1) 요약\n2) 자세히"
              : "Please choose a number.\n1) Summary\n2) Detailed",
        };
      }
      state.slots!.profile = { depth: choice === 1 ? "summary" : "detailed" };
      return { handled: true, reply: "" };
    }
    return { handled: false };
  }

  if (mode === "fortune") {
    const f = state.slots!.fortune ?? {};
    if (!f.timeframe) {
      if (!choice || (choice !== 1 && choice !== 2 && choice !== 3)) {
        return {
          handled: true,
          reply:
            lang === "ko"
              ? "기간을 번호로 골라줘.\n1) 이번 주\n2) 이번 달\n3) 2026년 상반기"
              : "Choose a timeframe.\n1) This week\n2) This month\n3) 2026 (first half)",
        };
      }
      f.timeframe =
        choice === 1 ? "week" : choice === 2 ? "month" : "half_year";
      state.slots!.fortune = f;
      return {
        handled: true,
        reply:
          lang === "ko"
            ? "주제는 뭐로 볼까?\n1) 커리어\n2) 연애\n3) 돈\n4) 건강"
            : "What topic should we focus on?\n1) Career\n2) Love\n3) Money\n4) Health",
      };
    }
    if (!f.topic) {
      const c = parseLeadingChoice(body.message);
      if (!c || c < 1 || c > 4) {
        return {
          handled: true,
          reply:
            lang === "ko"
              ? "주제를 번호로 골라줘.\n1) 커리어\n2) 연애\n3) 돈\n4) 건강"
              : "Choose a topic.\n1) Career\n2) Love\n3) Money\n4) Health",
        };
      }
      f.topic =
        c === 1 ? "career" : c === 2 ? "love" : c === 3 ? "money" : "health";
      state.slots!.fortune = f;
      return { handled: true, reply: "" };
    }
    return { handled: false };
  }

  if (mode === "career") {
    const c = state.slots!.career ?? {};
    if (!c.goal) {
      if (!choice || choice < 1 || choice > 4) {
        return {
          handled: true,
          reply:
            lang === "ko"
              ? "목표를 번호로 골라줘.\n1) 취업/지원\n2) 레주메\n3) 면접\n4) 포트폴리오"
              : "Choose a goal.\n1) Job search\n2) Resume\n3) Interviews\n4) Portfolio",
        };
      }
      c.goal =
        choice === 1
          ? "job_search"
          : choice === 2
          ? "resume"
          : choice === 3
          ? "interviews"
          : "portfolio";
      state.slots!.career = c;
      return { handled: true, reply: "" };
    }
    return { handled: false };
  }

  if (mode === "love") {
    const l = state.slots!.love ?? {};
    if (!l.stage) {
      if (!choice || choice < 1 || choice > 4) {
        return {
          handled: true,
          reply:
            lang === "ko"
              ? "상황을 번호로 골라줘.\n1) 썸/대화 중\n2) 연애 중\n3) 장기 관계\n4) 이별/정리 중"
              : "Choose a situation.\n1) Talking stage\n2) Dating\n3) Long-term\n4) Breakup / moving on",
        };
      }
      l.stage =
        choice === 1
          ? "talking"
          : choice === 2
          ? "dating"
          : choice === 3
          ? "long_term"
          : "breakup";
      state.slots!.love = l;
      return { handled: true, reply: "" };
    }
    return { handled: false };
  }

  return { handled: false };
}

function isReadyToCallLLM(state: SessionState): boolean {
  const mode = state.mode;
  if (!mode) return false;
  if (mode === "chat") return true;
  if (mode === "profile") return !!state.slots?.profile?.depth;
  if (mode === "career") return !!state.slots?.career?.goal;
  if (mode === "love") return !!state.slots?.love?.stage;
  if (mode === "fortune")
    return !!state.slots?.fortune?.timeframe && !!state.slots?.fortune?.topic;
  return true;
}

/**
 * ===== Route =====
 */
chatRouter.post("/", async (req: Request, res: Response) => {
  const cleanupRaw = sseInit(req, res);
  let cleaned = false;
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    cleanupRaw();
  };

  const finish = (fn?: () => void) => {
    try {
      fn?.();
    } finally {
      cleanup();
      if (!res.writableEnded) res.end();
    }
  };

  const parsed = BodySchema.safeParse(req.body);
  if (!parsed.success) {
    return finish(() =>
      sendEvent(res, "error", { error: "Invalid request body" })
    );
  }

  const body = parsed.data;
  const state = ensureSession(body.sessionId);

  const ac = new AbortController();
  const totalTimer = setTimeout(() => ac.abort(), UPSTREAM_TOTAL_TIMEOUT_MS);

  // ✅ 클라이언트 종료 → OpenAI 호출도 바로 중단
  req.on("close", () => ac.abort());
  res.on("close", () => ac.abort());

  try {
    // 1) mode 선택
    if (!state.mode) {
      const n = parseLeadingChoice(body.message);
      if (!n || n < 1 || n > 5)
        return finish(() => sendPlainAssistant(res, askModeMenu(body.lang)));

      state.mode = modeFromChoice(n);
      const q = nextQuestionForMode(state.mode, body.lang, state);
      if (q) return finish(() => sendPlainAssistant(res, q));
    }

    // 2) slot 채우기
    const slot = handleSlotFill(state, body);
    if (slot.handled) {
      if (slot.reply)
        return finish(() =>
          sendPlainAssistant(
            res,
            slot.reply ??
              (body.lang === "ko" ? "좋아. 계속 말해줘." : "Okay—go on.")
          )
        );

      if (!isReadyToCallLLM(state)) {
        const q = nextQuestionForMode(state.mode!, body.lang, state);
        return finish(() =>
          sendPlainAssistant(
            res,
            q ?? (body.lang === "ko" ? "좋아. 계속 말해줘." : "Okay—go on.")
          )
        );
      }
      // 슬롯 완성 → 아래 LLM 호출로 진행
    }

    // 3) 슬롯 부족이면 질문
    if (!isReadyToCallLLM(state)) {
      const q =
        nextQuestionForMode(state.mode ?? "chat", body.lang, state) ??
        askModeMenu(body.lang);
      return finish(() => sendPlainAssistant(res, q));
    }

    // 4) LLM 호출
    const input = buildInput(body, state);

    const streamResult = await tryOpenAIStreamToSSE(res, input, ac.signal);
    if (streamResult.ok) return finish();

    const fallbackResult = await fallbackNonStreamToFakeStream(
      res,
      input,
      ac.signal
    );
    if (!fallbackResult.ok)
      return finish(() =>
        sendEvent(res, "error", { error: fallbackResult.reason })
      );

    return finish();
  } catch (e: any) {
    return finish(() =>
      sendEvent(res, "error", {
        error:
          e?.name === "AbortError"
            ? "Request aborted / timeout"
            : e?.message ?? "server error",
      })
    );
  } finally {
    clearTimeout(totalTimer);
  }
});

export default chatRouter;
