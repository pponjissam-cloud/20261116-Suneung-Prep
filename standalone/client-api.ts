/**
 * HTML 단독 실행판에서 lib/client-api.ts 대신 쓰는 모듈.
 * 서버 API(/api/analyze, /api/extract) 대신 같은 로직을 브라우저에서 바로 실행한다.
 * 함수 이름·반환 형식은 서버판과 같아서 화면 코드는 그대로 쓴다.
 */
import { OutputRuleError, PassageUnsuitableError } from "@/lib/errors";
import { extractPassages, type ExtractInput } from "@/lib/extract";
import { MAX_WORDS, MIN_WORDS } from "@/lib/limits";
import type { ExtractedPassage } from "@/lib/passages";
import { runQuestion, runSection } from "@/lib/pipeline";
import { countWords, splitSentences } from "@/lib/split-sentences";
import type { Difficulty, QuestionType, SectionKey } from "@/lib/types";
import { MAX_IMAGES, MAX_UPLOAD_BYTES, SERVER_IMAGE_TYPES, classifyFile, type ServerImageType } from "@/lib/upload";
import { ApiKeyError } from "./browser-llm";
import { getProvider, onSettingsChange } from "./settings";

export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: string; retryable: boolean; retryAfterSec?: number };

/**
 * 키 오류가 한 번 나면 키를 바꿀 때까지 남은 요청은 보내지 않고 바로 같은 오류를 돌려준다.
 * (지문이 많을 때 틀린 키로 수십 번 요청하지 않도록)
 */
let keyError: string | null = null;
onSettingsChange(() => {
  keyError = null;
});

function toError(e: unknown): { ok: false; error: string; retryable: boolean } {
  if (e instanceof PassageUnsuitableError) return { ok: false, error: e.message, retryable: false };
  if (e instanceof ApiKeyError) {
    keyError = e.message;
    return { ok: false, error: e.message, retryable: true };
  }
  if (e instanceof OutputRuleError) return { ok: false, error: "AI 출력 검증에 실패했습니다. 다시 생성해 보세요.", retryable: true };
  console.error(e);
  return { ok: false, error: e instanceof Error ? e.message : "생성 중 오류가 발생했습니다.", retryable: true };
}

/** 분석 실행 (서버판 /api/analyze/[section] 와 같은 검사·처리) */
export async function callAnalyze<T>(
  section: SectionKey | "question",
  body: { passage: string; difficulty: Difficulty; questionType?: QuestionType },
): Promise<ApiResult<T>> {
  if (keyError) return { ok: false, error: keyError, retryable: true };
  const words = countWords(body.passage);
  if (words < MIN_WORDS || words > MAX_WORDS)
    return { ok: false, error: `지문은 영어 ${MIN_WORDS}~${MAX_WORDS}단어여야 합니다 (현재 ${words}단어).`, retryable: false };
  const sentences = splitSentences(body.passage);
  try {
    if (section === "question") {
      if (!body.questionType) return { ok: false, error: "questionType이 필요합니다.", retryable: false };
      return { ok: true, data: (await runQuestion(body.questionType, sentences, body.difficulty)) as T };
    }
    return { ok: true, data: (await runSection(section, sentences)) as T };
  } catch (e) {
    return toError(e);
  }
}

export type ExtractResponse = { passages: ExtractedPassage[]; warnings: string[] };

async function toBase64(file: Blob): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

/** 사진·PDF(files) 또는 긴 텍스트(text)에서 지문 목록 추출 (서버판 /api/extract 와 같은 검사) */
export async function callExtract(form: FormData): Promise<ApiResult<ExtractResponse>> {
  if (keyError) return { ok: false, error: keyError, retryable: true };
  try {
    const text = form.get("text");
    if (typeof text === "string" && text.trim()) return { ok: true, data: await extractPassages([{ kind: "text", text }]) };

    const files = form.getAll("files").filter((f): f is File => f instanceof File);
    if (files.length === 0) return { ok: false, error: "파일이 없습니다.", retryable: false };
    if (files.reduce((n, f) => n + f.size, 0) > MAX_UPLOAD_BYTES)
      return { ok: false, error: `파일이 너무 큽니다 (최대 ${MAX_UPLOAD_BYTES / 1024 / 1024}MB).`, retryable: false };
    const kinds = files.map((f) => classifyFile(f.name, f.type));
    if (kinds.some((k) => k !== "image" && k !== "pdf")) return { ok: false, error: "사진 또는 PDF만 올릴 수 있습니다.", retryable: false };
    if (kinds.includes("pdf") && files.length > 1) return { ok: false, error: "PDF는 한 번에 1개만 올릴 수 있습니다.", retryable: false };
    if (files.length > MAX_IMAGES) return { ok: false, error: `사진은 한 번에 최대 ${MAX_IMAGES}장까지 올릴 수 있습니다.`, retryable: false };

    const inputs: ExtractInput[] = [];
    for (const [i, f] of files.entries()) {
      const base64 = await toBase64(f);
      if (kinds[i] === "pdf") inputs.push({ kind: "pdf", base64 });
      else if (SERVER_IMAGE_TYPES.includes(f.type as ServerImageType)) inputs.push({ kind: "image", mediaType: f.type as ServerImageType, base64 });
      else return { ok: false, error: "이 사진 형식은 지원하지 않습니다. JPG나 PNG로 바꿔 올려 주세요.", retryable: false };
    }
    return { ok: true, data: await extractPassages(inputs) };
  } catch (e) {
    return toError(e);
  }
}

/** 동시에 limit 개까지만 실행 (API 요청 한도 배려). Gemini 무료 등급은 분당 요청 수가 적어 2개로 줄인다 */
export async function runPool(tasks: (() => Promise<void>)[], limit = 3): Promise<void> {
  if (getProvider() === "gemini") limit = Math.min(limit, 2);
  let next = 0;
  const worker = async () => {
    while (next < tasks.length) {
      const i = next++;
      await tasks[i]();
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, worker));
}
