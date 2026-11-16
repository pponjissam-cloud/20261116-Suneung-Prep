/** 앱 전체에서 공유하는 도메인 타입 (순수 TS, 런타임 의존성 없음) */

export type Sentence = { id: string; text: string };

export type VocabItem = {
  word: string;
  lemma: string;
  pos: string;
  meaningKo: string;
  ipa?: string;
  synonyms: string[];
  antonyms: string[];
  sentenceId: string;
};

export type Translation = { sentenceId: string; natural: string; chunked: string };

export type GrammarPoint = {
  title: string;
  sentenceId: string;
  phrase: string;
  start: number;
  end: number;
  explanation: string;
  example: { en: string; ko: string };
};

export const STRUCTURE_ROLES = ["S", "V", "O", "IO", "DO", "C", "OC", "M", "CONJ"] as const;
export type StructureRole = (typeof STRUCTURE_ROLES)[number];

export type StructureToken = {
  text: string;
  start: number;
  end: number;
  role: StructureRole;
  /** 이 성분이 절(clause)이면 종류 표시. 예: "명사절", "관계대명사절" */
  clause?: string;
};

export type SentenceStructure = {
  sentenceId: string;
  pattern: 1 | 2 | 3 | 4 | 5;
  tokens: StructureToken[];
  note?: string;
};

export const QUESTION_TYPES = [
  "purpose",
  "mood",
  "claim",
  "gist",
  "topic",
  "title",
  "detail",
  "grammar",
  "vocabulary",
  "blank",
  "irrelevant",
  "order",
  "insertion",
  "summary",
] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

export type Difficulty = "basic" | "hard";

/** 문제 지문 렌더링 단위 */
export type Segment = {
  text: string;
  style?: "underline" | "blank" | "bold";
  /** ①, ( A ) 같은 앞 표시 */
  marker?: string;
};

export type Block = {
  /** (A), (B), (C) 같은 단락 라벨 */
  label?: string;
  boxed?: boolean;
  segments: Segment[];
};

export type Question = {
  id: string;
  type: QuestionType;
  stem: string;
  /** 문제에 표시할 지문(변형 포함) */
  display: Block[];
  choices: string[];
  answerIndex: number;
  explanation: string;
  evidenceSentenceIds: string[];
  /** choices 와 같은 길이. 정답 자리는 빈 문자열 */
  choiceNotes: string[];
};

export type SectionKey = "vocabulary" | "translation" | "grammar" | "structure";

export type AnalysisResult = {
  sentences: Sentence[];
  vocabulary?: VocabItem[];
  translations?: Translation[];
  grammar?: GrammarPoint[];
  structures?: SentenceStructure[];
  questions: Question[];
};
