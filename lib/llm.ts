import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { ZodType, ZodTypeDef } from "zod";
import { OutputRuleError, PassageUnsuitableError } from "./errors";

const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5-5";

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("서버에 ANTHROPIC_API_KEY 환경변수가 설정되지 않았습니다.");
  client ??= new Anthropic();
  return client;
}

/** 응답 텍스트에서 JSON 객체 부분만 꺼낸다 (```json 펜스, 앞뒤 설명문 대비) */
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
  /** 문자열 또는 이미지·PDF를 포함한 content 블록 */
  user: string | Anthropic.ContentBlockParam[];
  schema: ZodType<Raw, ZodTypeDef, unknown>;
  /** 지문과 대조 검증 + 변환. OutputRuleError 를 던지면 그 메시지로 재시도한다 */
  convert: (raw: Raw, isLastAttempt: boolean) => Out;
  maxRetries?: number;
  maxTokens?: number;
};

/** LLM 호출 → JSON 추출 → Zod 검증 → convert. 실패 시 오류 내용을 알려주며 최대 maxRetries 번 재시도 */
export async function generateJson<Raw, Out>(opts: GenerateOptions<Raw, Out>): Promise<Out> {
  const { system, user, schema, convert, maxRetries = 2, maxTokens = 8000 } = opts;
  const messages: Anthropic.MessageParam[] = [{ role: "user", content: user }];
  let lastError = "";

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const res = await getClient().messages.create({ model: MODEL, max_tokens: maxTokens, system, messages });
    const text = res.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");

    try {
      const json = extractJson(text);
      const parsed = schema.safeParse(json);
      if (!parsed.success) {
        const issues = parsed.error.issues.slice(0, 10).map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`);
        throw new OutputRuleError(`스키마 불일치\n${issues.join("\n")}`);
      }
      return convert(parsed.data, attempt === maxRetries);
    } catch (e) {
      if (e instanceof PassageUnsuitableError) throw e;
      if (!(e instanceof OutputRuleError)) throw e;
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
