/**
 * HTML 단독 실행판에서 lib/llm.ts 대신 쓰는 모듈.
 * 서버 없이 브라우저에서 Anthropic API를 직접 호출한다 (사용자 본인의 API 키 사용).
 * generateJson 의 동작(JSON 추출 → Zod 검증 → convert → 오류 피드백 재시도)은 서버판과 같다.
 */
import type { ZodType, ZodTypeDef } from "zod";
import { OutputRuleError, PassageUnsuitableError } from "@/lib/errors";
import { getApiKey, getModel } from "./settings";

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

/** Messages API 호출. 요청 한도(429)·과부하(529)·일시 오류(5xx)는 기다렸다가 최대 4번 다시 보낸다 */
async function createMessage(body: { system: string; messages: MessageParam[]; max_tokens: number }): Promise<string> {
  const key = getApiKey();
  if (!key) throw new ApiKeyError("Anthropic API 키를 먼저 입력하세요 (화면 맨 위).");

  for (let attempt = 0; ; attempt++) {
    let res: Response;
    try {
      res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": key,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true",
        },
        body: JSON.stringify({ model: getModel(), ...body }),
      });
    } catch {
      if (attempt < 2) {
        await sleep(2000 * (attempt + 1));
        continue;
      }
      throw new Error("Anthropic API에 연결하지 못했습니다. 인터넷 연결을 확인하세요.");
    }

    if (res.ok) {
      const json = (await res.json()) as { content: { type: string; text?: string }[] };
      return json.content
        .filter((b) => b.type === "text")
        .map((b) => b.text ?? "")
        .join("");
    }

    const err = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
    const msg = err?.error?.message ?? `HTTP ${res.status}`;
    if (res.status === 401 || res.status === 403) throw new ApiKeyError(`API 키가 올바르지 않거나 권한이 없습니다. (${msg})`);
    if ((res.status === 429 || res.status === 529 || res.status >= 500) && attempt < 4) {
      const retryAfter = Number(res.headers.get("retry-after"));
      await sleep((Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : 5 * (attempt + 1)) * 1000);
      continue;
    }
    if (res.status === 404 && /model/i.test(msg)) throw new ApiKeyError(`모델 이름을 확인하세요: ${getModel()} (${msg})`);
    throw new Error(`Anthropic API 오류: ${msg}`);
  }
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
    const text = await createMessage({ system, messages, max_tokens: maxTokens });
    try {
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
