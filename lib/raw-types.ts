/**
 * LLM이 돌려주는 "원재료" 형태.
 * 지문 조립·오프셋 계산·정답 번호 재계산은 코드(assemble.ts)가 맡는다.
 */

export type RawVocab = {
  items: {
    word: string; // 지문에 나온 형태 그대로
    lemma: string;
    pos: string;
    meaningKo: string;
    ipa?: string;
    synonyms: string[];
    antonyms: string[];
    sentenceId: string;
  }[];
};

export type RawTranslation = {
  items: { sentenceId: string; natural: string; chunked: string }[];
};

export type RawGrammar = {
  items: {
    title: string;
    sentenceId: string;
    phrase: string; // 원문 그대로의 구간
    explanation: string;
    example: { en: string; ko: string };
  }[];
};

export type RawStructure = {
  items: {
    sentenceId: string;
    pattern: 1 | 2 | 3 | 4 | 5;
    tokens: { text: string; role: string; clause?: string }[];
    note?: string;
  }[];
};

type RawCommon = { explanation: string; evidenceSentenceIds: string[] };

/** 목적·심경·주장·요지·주제·제목·내용일치 */
export type RawChoiceQuestion = RawCommon & {
  choices: string[];
  answerIndex: number;
  choiceNotes: string[];
};

export type RawBlank = RawChoiceQuestion & { sentenceId: string; phrase: string };

export type RawSummary = RawCommon & {
  summary: string; // "(A)" 와 "(B)" 자리 표시 포함
  choices: { a: string; b: string }[];
  answerIndex: number;
  choiceNotes: string[];
};

/** 어법·어휘: 밑줄 5곳. 정답 1곳만 shown 이 phrase 와 다르다 */
export type RawUnderline = RawCommon & {
  targets: { sentenceId: string; phrase: string; shown: string }[];
  choiceNotes: string[];
};

export type RawIrrelevant = RawCommon & { insertAfterSentenceId: string; sentence: string };

/** 각 파트가 시작하는 문장 ID. 주어진 글 = part1 앞의 문장들 */
export type RawOrder = RawCommon & {
  part1StartId: string;
  part2StartId: string;
  part3StartId: string;
};

export type RawInsertion = RawCommon & { removedSentenceId: string };
