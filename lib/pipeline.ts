import "server-only";
import {
  assembleBlank,
  assembleChoice,
  assembleInsertion,
  assembleIrrelevant,
  assembleOrder,
  assembleSummary,
  assembleUnderline,
  type AssembledQuestion,
} from "./assemble";
import { PassageUnsuitableError } from "./errors";
import { generateJson } from "./llm";
import { SYSTEM_PROMPT } from "./prompts/common";
import { questionPrompt } from "./prompts/questions";
import { grammarPrompt, structurePrompt, translationPrompt, vocabularyPrompt } from "./prompts/sections";
import {
  rawBlankSchema,
  rawChoiceSchema,
  rawGrammarSchema,
  rawInsertionSchema,
  rawIrrelevantSchema,
  rawOrderSchema,
  rawStructureSchema,
  rawSummarySchema,
  rawTranslationSchema,
  rawUnderlineSchema,
  rawVocabSchema,
} from "./schema";
import { randomInt } from "./shuffle";
import type { Difficulty, QuestionType, SectionKey, Sentence } from "./types";
import { validateGrammar, validateStructure, validateTranslation, validateVocab } from "./validators";

export async function runSection(section: SectionKey, sentences: Sentence[]) {
  const system = SYSTEM_PROMPT;
  switch (section) {
    case "vocabulary":
      return generateJson({ system, user: vocabularyPrompt(sentences), schema: rawVocabSchema, convert: (r) => validateVocab(sentences, r) });
    case "translation":
      return generateJson({ system, user: translationPrompt(sentences), schema: rawTranslationSchema, convert: (r) => validateTranslation(sentences, r) });
    case "grammar":
      return generateJson({ system, user: grammarPrompt(sentences), schema: rawGrammarSchema, convert: (r) => validateGrammar(sentences, r) });
    case "structure":
      return generateJson({
        system,
        user: structurePrompt(sentences),
        schema: rawStructureSchema,
        convert: (r, last) => validateStructure(sentences, r, last),
        maxTokens: 16000,
      });
  }
}

/** 유형별 최소 문장 수 (LLM 호출 전에 걸러서 비용을 아낀다) */
const MIN_SENTENCES: Partial<Record<QuestionType, number>> = { insertion: 6, irrelevant: 5, order: 4, grammar: 3, vocabulary: 3 };

export async function runQuestion(type: QuestionType, sentences: Sentence[], difficulty: Difficulty): Promise<AssembledQuestion> {
  const min = MIN_SENTENCES[type];
  if (min && sentences.length < min)
    throw new PassageUnsuitableError(`이 유형은 ${min}문장 이상의 지문이 필요합니다 (현재 ${sentences.length}문장).`);

  // 정답 위치를 코드가 무작위로 정해 LLM에 알려준다 (정답 번호 쏠림 방지)
  const targetIndex = randomInt(5);
  const user = questionPrompt(type, sentences, difficulty, targetIndex);
  const system = SYSTEM_PROMPT;

  switch (type) {
    case "purpose":
    case "mood":
    case "claim":
    case "gist":
    case "topic":
    case "title":
    case "detail":
      return generateJson({ system, user, schema: rawChoiceSchema, convert: (r) => assembleChoice(type, sentences, r) });
    case "blank":
      return generateJson({ system, user, schema: rawBlankSchema, convert: (r) => assembleBlank(sentences, r) });
    case "summary":
      return generateJson({ system, user, schema: rawSummarySchema, convert: (r) => assembleSummary(sentences, r) });
    case "grammar":
    case "vocabulary":
      return generateJson({ system, user, schema: rawUnderlineSchema, convert: (r) => assembleUnderline(type, sentences, r) });
    case "irrelevant":
      return generateJson({ system, user, schema: rawIrrelevantSchema, convert: (r) => assembleIrrelevant(sentences, r) });
    case "order":
      return generateJson({ system, user, schema: rawOrderSchema, convert: (r) => assembleOrder(sentences, r) });
    case "insertion":
      return generateJson({ system, user, schema: rawInsertionSchema, convert: (r) => assembleInsertion(sentences, r) });
  }
}
