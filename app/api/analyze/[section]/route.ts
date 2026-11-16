import { NextResponse, type NextRequest } from "next/server";
import { OutputRuleError, PassageUnsuitableError } from "@/lib/errors";
import { MAX_WORDS, MIN_WORDS } from "@/lib/limits";
import { runQuestion, runSection } from "@/lib/pipeline";
import { checkRateLimit } from "@/lib/rate-limit";
import { analyzeRequestSchema } from "@/lib/schema";
import { countWords, splitSentences } from "@/lib/split-sentences";
import type { SectionKey } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 120;

const SECTIONS = ["vocabulary", "translation", "grammar", "structure", "question"] as const;
type Section = (typeof SECTIONS)[number];

function fail(status: number, error: string, retryable: boolean) {
  return NextResponse.json({ ok: false, error, retryable }, { status });
}

/** POST /api/analyze/{vocabulary|translation|grammar|structure|question} */
export async function POST(req: NextRequest, { params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  if (!SECTIONS.includes(section as Section)) return fail(404, "알 수 없는 섹션입니다.", false);

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const rl = checkRateLimit(ip);
  if (!rl.ok) return fail(429, `요청이 너무 많습니다. ${rl.retryAfterSec}초 후 다시 시도하세요.`, true);

  const body = analyzeRequestSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) return fail(400, "요청 형식이 올바르지 않습니다.", false);
  const { passage, difficulty, questionType } = body.data;

  const words = countWords(passage);
  if (words < MIN_WORDS || words > MAX_WORDS)
    return fail(400, `지문은 영어 ${MIN_WORDS}~${MAX_WORDS}단어여야 합니다 (현재 ${words}단어).`, false);

  const sentences = splitSentences(passage);

  try {
    if (section === "question") {
      if (!questionType) return fail(400, "questionType이 필요합니다.", false);
      const q = await runQuestion(questionType, sentences, difficulty);
      return NextResponse.json({ ok: true, data: q });
    }
    const data = await runSection(section as SectionKey, sentences);
    return NextResponse.json({ ok: true, data });
  } catch (e) {
    if (e instanceof PassageUnsuitableError) return fail(422, e.message, false);
    if (e instanceof OutputRuleError) return fail(502, "AI 출력 검증에 실패했습니다. 다시 생성해 보세요.", true);
    console.error(`[analyze/${section}]`, e);
    const msg = e instanceof Error && e.message.includes("ANTHROPIC_API_KEY") ? e.message : "생성 중 오류가 발생했습니다.";
    return fail(500, msg, true);
  }
}
