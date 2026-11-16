import type { Difficulty, Sentence } from "../types";

export const SYSTEM_PROMPT = `당신은 한국 대학수학능력시험(수능) 영어 영역 출제·해설 전문가입니다.
- 학습자는 한국 고등학생입니다. 설명과 해석은 자연스러운 한국어로 씁니다.
- 반드시 요청한 JSON 객체 하나만 출력합니다. 코드펜스, 머리말, 맺음말을 쓰지 않습니다.
- 지문 인용(phrase, word, text 등)은 원문을 한 글자도 바꾸지 않고 그대로 복사합니다.
- 문장은 [s1], [s2]… 형식의 ID로 가리킵니다. 주어지지 않은 ID를 만들지 않습니다.`;

/** LLM 입력용: 문장마다 ID를 붙여 나열 */
export function formatSentences(sentences: Sentence[]): string {
  return sentences.map((s) => `[${s.id}] ${s.text}`).join("\n");
}

export function difficultyNote(d: Difficulty): string {
  return d === "hard"
    ? "난이도: 고난도(1등급 변별용). 오답 선택지를 정답과 매우 그럴듯하게 만들고, 추상적인 표현을 사용하세요."
    : "난이도: 기본(수능 평균 수준).";
}

export function passageBlock(sentences: Sentence[]): string {
  return `<passage>\n${formatSentences(sentences)}\n</passage>`;
}
