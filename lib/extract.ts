import "server-only";
import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { PassageUnsuitableError } from "./errors";
import { generateJson } from "./llm";
import { tidyExtracted, type ExtractedPassage } from "./passages";
import { EXTRACT_PROMPT, splitTextPrompt } from "./prompts/extract";
import type { ServerImageType } from "./upload";

export type ExtractInput =
  | { kind: "image"; mediaType: ServerImageType; base64: string }
  | { kind: "pdf"; base64: string }
  | { kind: "text"; text: string };

export type ExtractResult = { passages: ExtractedPassage[]; warnings: string[] };

const extractSchema = z.object({
  passages: z
    .array(
      z.object({
        label: z
          .union([z.string(), z.number()])
          .nullish()
          .transform((v) => (v == null ? undefined : String(v))),
        passage: z.string().default(""),
        warnings: z.array(z.string()).default([]),
      }),
    )
    .default([]),
  warnings: z.array(z.string()).default([]),
});

const SYSTEM =
  "당신은 시험지·문서에서 영어 지문을 정확하게 옮겨 적고 지문 단위로 나누는 전문가입니다. 요청한 JSON 객체 하나만 출력합니다.";

/** 사진·PDF·텍스트에서 영어 지문들을 뽑는다 (지문 여러 개 지원) */
export async function extractPassages(inputs: ExtractInput[]): Promise<ExtractResult> {
  const blocks: Anthropic.ContentBlockParam[] = [];
  for (const f of inputs) {
    if (f.kind === "pdf") blocks.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: f.base64 } });
    else if (f.kind === "image") blocks.push({ type: "image", source: { type: "base64", media_type: f.mediaType, data: f.base64 } });
  }
  const texts = inputs.filter((f): f is Extract<ExtractInput, { kind: "text" }> => f.kind === "text").map((f) => f.text);
  blocks.push({ type: "text", text: texts.length ? splitTextPrompt(texts.join("\n\n")) : EXTRACT_PROMPT });

  return generateJson({
    system: SYSTEM,
    user: blocks,
    schema: extractSchema,
    maxRetries: 1,
    maxTokens: 16000,
    convert: (raw) => {
      const passages = tidyExtracted(raw.passages);
      if (passages.length === 0)
        throw new PassageUnsuitableError("영어 지문을 찾지 못했습니다. 지문이 잘 보이게 다시 찍거나 다른 파일을 올려 주세요.");
      return { passages, warnings: raw.warnings };
    },
  });
}
