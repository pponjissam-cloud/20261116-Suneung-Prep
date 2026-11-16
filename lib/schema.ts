import { z } from "zod";
import { QUESTION_TYPES } from "./types";

/** LLM 응답 스키마. 형태만 검사하고, 지문과의 일치 여부는 validators.ts / assemble.ts 가 검사한다. */

const str = z.string().trim().min(1);
const ids = z.array(z.string());

export const rawVocabSchema = z.object({
  items: z.array(
    z.object({
      word: str,
      lemma: str,
      pos: str,
      meaningKo: str,
      ipa: z.string().optional(),
      synonyms: z.array(z.string()).default([]),
      antonyms: z.array(z.string()).default([]),
      sentenceId: str,
    }),
  ),
});

export const rawTranslationSchema = z.object({
  items: z.array(z.object({ sentenceId: str, natural: str, chunked: str })),
});

export const rawGrammarSchema = z.object({
  items: z.array(
    z.object({
      title: str,
      sentenceId: str,
      phrase: str,
      explanation: str,
      example: z.object({ en: str, ko: str }),
    }),
  ),
});

const pattern = z.coerce
  .number()
  .int()
  .min(1)
  .max(5)
  .transform((n) => n as 1 | 2 | 3 | 4 | 5);

export const rawStructureSchema = z.object({
  items: z.array(
    z.object({
      sentenceId: str,
      pattern,
      tokens: z.array(z.object({ text: str, role: str, clause: z.string().optional() })).min(1),
      note: z.string().optional(),
    }),
  ),
});

const common = { explanation: str, evidenceSentenceIds: ids.default([]) };
const answerIndex = z.coerce.number().int();
const notes = z.array(z.string()).default([]);

export const rawChoiceSchema = z.object({ ...common, choices: z.array(str), answerIndex, choiceNotes: notes });

export const rawBlankSchema = rawChoiceSchema.extend({ sentenceId: str, phrase: str });

export const rawSummarySchema = z.object({
  ...common,
  summary: str,
  choices: z.array(z.object({ a: str, b: str })),
  answerIndex,
  choiceNotes: notes,
});

export const rawUnderlineSchema = z.object({
  ...common,
  targets: z.array(z.object({ sentenceId: str, phrase: str, shown: str })),
  choiceNotes: notes,
});

export const rawIrrelevantSchema = z.object({ ...common, insertAfterSentenceId: str, sentence: str });

export const rawOrderSchema = z.object({ ...common, part1StartId: str, part2StartId: str, part3StartId: str });

export const rawInsertionSchema = z.object({ ...common, removedSentenceId: str });

/** API 요청 본문 */
export const analyzeRequestSchema = z.object({
  passage: z.string().min(1).max(6000),
  difficulty: z.enum(["basic", "hard"]).default("basic"),
  questionType: z.enum(QUESTION_TYPES).optional(),
});
export type AnalyzeRequest = z.infer<typeof analyzeRequestSchema>;
