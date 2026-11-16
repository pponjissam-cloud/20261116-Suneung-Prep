import "server-only";
import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { PassageUnsuitableError } from "./errors";
import { generateJson } from "./llm";
import { EXTRACT_PROMPT } from "./prompts/extract";
import { countWords } from "./split-sentences";
import { cleanExtractedText, hasBlank, type ServerImageType } from "./upload";

export type ExtractInput =
  | { kind: "image"; mediaType: ServerImageType; base64: string }
  | { kind: "pdf"; base64: string };

export type ExtractResult = { passage: string; warnings: string[] };

const extractSchema = z.object({
  passage: z.string().default(""),
  warnings: z.array(z.string()).default([]),
});

const SYSTEM = "당신은 시험지 사진에서 영어 지문을 정확하게 옮겨 적는 OCR 전문가입니다. 요청한 JSON 객체 하나만 출력합니다.";

/** 사진·PDF에서 영어 지문 텍스트를 뽑는다 */
export async function extractPassage(files: ExtractInput[]): Promise<ExtractResult> {
  const blocks: Anthropic.ContentBlockParam[] = files.map((f) =>
    f.kind === "pdf"
      ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: f.base64 } }
      : { type: "image", source: { type: "base64", media_type: f.mediaType, data: f.base64 } },
  );
  blocks.push({ type: "text", text: EXTRACT_PROMPT });

  return generateJson({
    system: SYSTEM,
    user: blocks,
    schema: extractSchema,
    maxRetries: 1,
    convert: (raw) => {
      const passage = cleanExtractedText(raw.passage);
      if (countWords(passage) < 5)
        throw new PassageUnsuitableError("사진에서 영어 지문을 찾지 못했습니다. 지문이 잘 보이게 다시 찍어 주세요.");
      const warnings = [...raw.warnings];
      if (hasBlank(passage)) warnings.push("빈칸(____)이 있는 지문입니다. 빈칸에 들어갈 원래 표현을 채워 넣어야 분석이 정확합니다.");
      return { passage, warnings };
    },
  });
}
