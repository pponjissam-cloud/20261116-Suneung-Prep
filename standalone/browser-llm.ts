/**
 * HTML 단독 실행판에서 lib/llm.ts 대신 쓰는 모듈.
 * 서버 없이 브라우저에서 AI API를 직접 호출한다 (사용자 본인의 API 키 사용).
 * Claude(Anthropic) 키와 Gemini(Google AI Studio) 키를 모두 지원한다.
 * generateJson 의 동작(JSON 추출 → Zod 검증 → convert → 오류 피드백 재시도)은 서버판과 같다.
 */
import type { ZodType, ZodTypeDef } from "zod";
import { OutputRuleError, PassageUnsuitableError } from "@/lib/errors";
import { getApiKey, getModel, getProvider, isLegacyGeminiKey } from "./settings";

export class ApiKeyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ApiKeyError";
  }
}

type ContentBlock =
  | { type: "text"; text: string }
  | { type: "image"; source: { type: "base64"; media_type: string; data: string } }
  | { type: "document"; source: { type: "base64"; media_type: string; data: string } };
type MessageParam = { role: "user" | "assistant"; content: string | ContentBlock[] };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type CallArgs = { system: string; messages: MessageParam[]; max_tokens: number };
type HttpFailure = { status: number; message: string; retryAfterSec?: number };

/**
 * 요청 한 번 보내기 + 일시 오류 재시도.
 * 요청 한도(429)·과부하(503·529)·서버 오류(5xx)·네트워크 오류는 기다렸다가 최대 4번 다시 보낸다.
 */
async function withRetry(
  send: () => Promise<Response>,
  parseOk: (json: unknown) => string,
  parseFail: (res: Response) => Promise<HttpFailure>,
  maxRetries = 4,
) {
  for (let attempt = 0; ; attempt++) {
    let res: Response;
    try {
      res = await send();
    } catch {
      if (attempt < 2) {
        await sleep(2000 * (attempt + 1));
        continue;
      }
      throw new Error("AI 서버에 연결하지 못했습니다. 인터넷 연결을 확인하세요. (휴대폰 앱의 미리보기 화면이라면 Chrome 등 브라우저에서 파일을 열어 주세요)");
    }
    if (res.ok) return parseOk(await res.json());
    const f = await parseFail(res);
    if ((f.status === 429 || f.status >= 500) && attempt < maxRetries) {
      await sleep((f.retryAfterSec && f.retryAfterSec > 0 ? Math.min(f.retryAfterSec, 90) : 5 * (attempt + 1)) * 1000);
      continue;
    }
    return Promise.reject(f);
  }
}

// ───────── Claude (Anthropic) ─────────
async function callAnthropic(key: string, model: string, body: CallArgs): Promise<string> {
  try {
    return await withRetry(
      () =>
        fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-api-key": key,
            "anthropic-version": "2023-06-01",
            "anthropic-dangerous-direct-browser-access": "true",
          },
          body: JSON.stringify({ model, ...body }),
        }),
      (json) =>
        (json as { content: { type: string; text?: string }[] }).content
          .filter((b) => b.type === "text")
          .map((b) => b.text ?? "")
          .join(""),
      async (res) => {
        const err = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
        return { status: res.status, message: err?.error?.message ?? `HTTP ${res.status}`, retryAfterSec: Number(res.headers.get("retry-after")) || undefined };
      },
    );
  } catch (e) {
    if (e instanceof Error) throw e;
    const f = e as HttpFailure;
    if (f.status === 401 || f.status === 403) throw new ApiKeyError(`Claude API 키가 올바르지 않거나 권한이 없습니다. (${f.message})`);
    if (f.status === 404 && /model/i.test(f.message)) throw new ApiKeyError(`모델 이름을 확인하세요: ${model} (${f.message})`);
    if (f.status === 429) throw new Error(`Claude 요청 한도를 넘었습니다. 잠시 후 다시 시도하세요. (${f.message})`);
    throw new Error(`Claude API 오류: ${f.message}`);
  }
}

// ───────── Gemini (Google AI Studio) ─────────
type GeminiPart = { text?: string; thought?: boolean; inlineData?: { mimeType: string; data: string } };

/** 재시도 대화(이전 출력 + 피드백)를 user 한 턴으로 합친다. Gemini 3 의 thought signature 없이도 안전하게 이어 가기 위함 */
function toGeminiParts(messages: MessageParam[]): GeminiPart[] {
  const parts: GeminiPart[] = [];
  messages.forEach((m, i) => {
    if (i > 0) parts.push({ text: m.role === "assistant" ? "\n\n[당신의 이전 출력]\n" : "\n\n[수정 요청]\n" });
    const blocks: ContentBlock[] = typeof m.content === "string" ? [{ type: "text", text: m.content }] : m.content;
    for (const b of blocks) parts.push(b.type === "text" ? { text: b.text } : { inlineData: { mimeType: b.source.media_type, data: b.source.data } });
  });
  return parts;
}

/** 이 모델이 지금 혼잡·한도 초과·없음 → 다른 모델로 넘어가도 되는 오류 */
class GeminiBusyError extends Error {}

/** Gemini 모델 하나로 호출. 혼잡하면 짧게 2번만 다시 해 보고 GeminiBusyError */
async function callGeminiModel(key: string, model: string, body: CallArgs): Promise<string> {
  try {
    return await withRetry(
      () =>
        fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
          method: "POST",
          headers: { "content-type": "application/json", "x-goog-api-key": key },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: body.system }] },
            contents: [{ role: "user", parts: toGeminiParts(body.messages) }],
            // 생각(thinking) 토큰도 출력 한도에 포함되므로 넉넉히 잡는다
            generationConfig: { maxOutputTokens: Math.max(body.max_tokens * 2, 16384), responseMimeType: "application/json" },
          }),
        }),
      (json) => {
        const j = json as { candidates?: { content?: { parts?: GeminiPart[] }; finishReason?: string }[]; promptFeedback?: { blockReason?: string } };
        if (j.promptFeedback?.blockReason) throw new Error(`Gemini가 요청을 거절했습니다 (${j.promptFeedback.blockReason}).`);
        const c = j.candidates?.[0];
        const text = (c?.content?.parts ?? [])
          .filter((p) => p.text && !p.thought)
          .map((p) => p.text)
          .join("");
        if (!text && c?.finishReason && c.finishReason !== "STOP") throw new OutputRuleError(`응답이 비었습니다 (${c.finishReason}). JSON만 출력하세요.`);
        return text;
      },
      async (res) => {
        const err = (await res.json().catch(() => null)) as {
          error?: { message?: string; status?: string; details?: { "@type"?: string; retryDelay?: string }[] };
        } | null;
        const delay = err?.error?.details?.find((d) => d["@type"]?.includes("RetryInfo"))?.retryDelay;
        return {
          status: res.status,
          message: `${err?.error?.status ?? ""} ${err?.error?.message ?? `HTTP ${res.status}`}`.trim(),
          retryAfterSec: delay ? parseFloat(delay) : Number(res.headers.get("retry-after")) || undefined,
        };
      },
      2,
    );
  } catch (e) {
    if (e instanceof Error) throw e;
    const f = e as HttpFailure;
    if (f.status === 401 || f.status === 403 || /API key not valid|API_KEY_INVALID|PERMISSION_DENIED|UNAUTHENTICATED/i.test(f.message)) {
      const hint = isLegacyGeminiKey(key)
        ? " AIza로 시작하는 예전 형식 키는 2026년 9월부터 거부됩니다. Google AI Studio(aistudio.google.com/apikey)에서 새 키(AQ.로 시작)를 만들어 화면 맨 위 '변경'에서 바꿔 넣으세요."
        : /ACCESS_TOKEN_TYPE_UNSUPPORTED/i.test(f.message)
          ? " 새 키가 아직 활성화되지 않았을 수 있습니다. 몇 분 뒤 다시 시도하거나 AI Studio에서 키를 새로 만들어 보세요."
          : " 키를 빠짐없이 복사했는지 확인하고, 화면 맨 위 '변경'에서 다시 넣어 주세요.";
      throw new ApiKeyError(`Gemini API 키가 거부되었습니다.${hint} (${f.message})`);
    }
    if (f.status === 404 || f.status === 429 || f.status >= 500) throw new GeminiBusyError(`${model}: ${f.message}`);
    throw new Error(`Gemini API 오류: ${f.message}`);
  }
}

/** 고른 모델이 혼잡하면 차례로 넘어갈 예비 모델 */
export const GEMINI_FALLBACKS = ["gemini-3.8-flash", "gemini-3.6-flash", "gemini-3.5-flash-lite"];
/** 혼잡했던 모델은 잠시(5분) 뒤로 미룬다 → 남은 요청이 같은 모델에서 시간을 버리지 않게 */
const COOLDOWN_MS = 5 * 60_000;
const cooldownUntil = new Map<string, number>();

async function callGemini(key: string, model: string, body: CallArgs): Promise<string> {
  const chain = [model, ...GEMINI_FALLBACKS.filter((m) => m !== model)];
  const now = Date.now();
  const ready = chain.filter((m) => (cooldownUntil.get(m) ?? 0) <= now);
  const cooling = chain.filter((m) => (cooldownUntil.get(m) ?? 0) > now);
  const busy: string[] = [];
  for (const m of [...ready, ...cooling]) {
    try {
      const text = await callGeminiModel(key, m, body);
      cooldownUntil.delete(m);
      return text;
    } catch (e) {
      if (!(e instanceof GeminiBusyError)) throw e;
      cooldownUntil.set(m, Date.now() + COOLDOWN_MS);
      busy.push(e.message);
    }
  }
  const quota = busy.some((b) => /RESOURCE_EXHAUSTED|quota/i.test(b));
  throw new Error(
    quota
      ? `Gemini 사용 한도를 넘었습니다 (모델 ${chain.length}개 모두). 무료 등급은 분당·하루 요청 수가 제한됩니다. 잠시 뒤 '실패한 항목 모두 다시 생성'을 누르거나, 하루 한도라면 내일 다시 시도하세요. (${busy.at(-1)})`
      : `Gemini 모델이 모두 혼잡합니다 (${chain.join(", ")}). 몇 분 뒤 '실패한 항목 모두 다시 생성'을 누르세요. (${busy.at(-1)})`,
  );
}

/** 설정된 키의 회사(Claude/Gemini)에 맞춰 호출 */
async function createMessage(body: CallArgs): Promise<string> {
  const key = getApiKey();
  if (!key) throw new ApiKeyError("API 키를 먼저 입력하세요 (화면 맨 위).");
  const provider = getProvider();
  const model = getModel(provider);
  return provider === "gemini" ? callGemini(key, model, body) : callAnthropic(key, model, body);
}

/** 응답 텍스트에서 JSON 객체 부분만 꺼낸다 */
export function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fenced ? fenced[1] : text;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start < 0 || end <= start) throw new OutputRuleError("JSON 객체를 찾을 수 없습니다. JSON만 출력하세요.");
  try {
    return JSON.parse(body.slice(start, end + 1));
  } catch (e) {
    throw new OutputRuleError(`JSON 파싱 실패: ${(e as Error).message}`);
  }
}

type GenerateOptions<Raw, Out> = {
  system: string;
  user: string | ContentBlock[];
  schema: ZodType<Raw, ZodTypeDef, unknown>;
  convert: (raw: Raw, isLastAttempt: boolean) => Out;
  maxRetries?: number;
  maxTokens?: number;
};

export async function generateJson<Raw, Out>(opts: GenerateOptions<Raw, Out>): Promise<Out> {
  const { system, user, schema, convert, maxRetries = 2, maxTokens = 8000 } = opts;
  const messages: MessageParam[] = [{ role: "user", content: user }];
  let lastError = "";

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    let text = "";
    try {
      text = await createMessage({ system, messages, max_tokens: maxTokens });
      const parsed = schema.safeParse(extractJson(text));
      if (!parsed.success) {
        const issues = parsed.error.issues.slice(0, 10).map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`);
        throw new OutputRuleError(`스키마 불일치\n${issues.join("\n")}`);
      }
      return convert(parsed.data, attempt === maxRetries);
    } catch (e) {
      if (e instanceof PassageUnsuitableError || !(e instanceof OutputRuleError)) throw e;
      lastError = e.message;
      messages.push({ role: "assistant", content: text || "(빈 응답)" });
      messages.push({
        role: "user",
        content: `위 출력은 다음 규칙을 어겼습니다:\n${e.message}\n\n규칙을 지켜 전체 JSON을 처음부터 다시 출력하세요. JSON 외의 글은 쓰지 마세요.`,
      });
    }
  }
  throw new OutputRuleError(`재시도 후에도 올바른 결과를 얻지 못했습니다: ${lastError}`);
}
