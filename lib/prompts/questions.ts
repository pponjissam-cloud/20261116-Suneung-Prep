import { CIRCLED, QUESTION_TYPE_INFO } from "../question-types";
import type { Difficulty, QuestionType, Sentence } from "../types";
import { difficultyNote, passageBlock } from "./common";

const CHOICE_COMMON = `- choices: 선택지 정확히 5개 (중복 금지)
- answerIndex: 정답 선택지의 0부터 시작하는 번호
- choiceNotes: choices 와 같은 순서로 5개. 오답은 왜 틀렸는지 한 문장, 정답 자리는 ""
- explanation: 정답 해설 (한국어 2~4문장, 근거 문장을 [s3]처럼 인용)
- evidenceSentenceIds: 정답 근거 문장 ID 목록`;

const CHOICE_EXAMPLE = `{"choices":["...","...","...","...","..."],"answerIndex":2,"choiceNotes":["...","...","","...","..."],"explanation":"...","evidenceSentenceIds":["s2","s5"]}`;

const COMMON_FIELDS = `- explanation: 정답 해설 (한국어 2~4문장, 근거 문장을 [s3]처럼 인용)
- evidenceSentenceIds: 정답 근거 문장 ID 목록`;

/** 유형별 지시문. targetIndex 는 코드가 무작위로 정한 정답 위치(어법·어휘·내용일치) */
function instruction(type: QuestionType, targetIndex: number): string {
  const mark = CIRCLED[targetIndex];
  switch (type) {
    case "purpose":
    case "claim":
    case "gist":
      return `선택지는 한국어 문장으로 씁니다. 오답은 지문 일부 내용만 반영하거나 과장·왜곡한 것으로 만듭니다.
${CHOICE_COMMON}
출력 형식: ${CHOICE_EXAMPLE}`;
    case "mood":
      return `글쓴이(또는 등장인물)의 심경 변화를 묻습니다. 선택지는 "nervous → relieved" 처럼 영어 형용사 두 개를 화살표로 연결합니다.
지문에 심경이 드러나지 않으면 등장인물의 감정이 가장 잘 드러나는 쪽으로 출제합니다.
${CHOICE_COMMON}
출력 형식: ${CHOICE_EXAMPLE}`;
    case "topic":
    case "title":
      return `선택지는 영어로 씁니다. ${type === "title" ? "제목은 수능처럼 비유적이거나 함축적인 표현도 섞습니다." : "주제는 명사구 형태로 씁니다 (예: the importance of ...)."}
오답은 너무 넓거나 좁은 것, 지문 소재만 같고 초점이 다른 것으로 만듭니다.
${CHOICE_COMMON}
출력 형식: ${CHOICE_EXAMPLE}`;
    case "detail":
      return `내용과 일치하지 않는 것 1개를 정답으로 합니다. 선택지는 한국어이며 지문에 나오는 순서대로 배열합니다.
정답(불일치 선택지)은 반드시 ${mark} (answerIndex=${targetIndex}) 자리에 두세요.
${CHOICE_COMMON}
출력 형식: ${CHOICE_EXAMPLE}`;
    case "grammar":
      return `지문에서 어법 출제 포인트 5곳을 고르세요 (수 일치, 관계사, 분사, 동명사/to부정사, 병렬, 대명사, 태 등).
- targets: 정확히 5개. 각각 {"sentenceId", "phrase": 원문 그대로의 1~3단어, "shown": 시험지에 보일 형태}
- 5곳 중 정확히 1곳만 shown 을 어법상 틀린 형태로 바꿉니다. 나머지 4곳은 shown 을 phrase 와 똑같이 씁니다.
- 지문 순서로 ${mark}번째에 해당하는 곳을 틀린 곳으로 정하세요.
- 서로 다른 문장에 고르게 분포시키고, 구간이 겹치지 않게 합니다.
- choiceNotes: targets 와 같은 순서로 5개. 각 밑줄이 왜 맞는지(정답 자리는 왜 틀렸는지) 한 문장
${COMMON_FIELDS}
출력 형식: {"targets":[{"sentenceId":"s1","phrase":"decides","shown":"deciding"},{"sentenceId":"s2","phrase":"which","shown":"which"}],"choiceNotes":["...","..."],"explanation":"...","evidenceSentenceIds":["s1"]}`;
    case "vocabulary":
      return `지문에서 문맥상 중요한 낱말 5곳을 고르세요.
- targets: 정확히 5개. 각각 {"sentenceId", "phrase": 원문 그대로의 한 단어, "shown": 시험지에 보일 단어}
- 5곳 중 정확히 1곳만 shown 을 문맥상 반대이거나 부적절한 단어로 바꿉니다 (예: increase → decrease). 나머지 4곳은 shown 을 phrase 와 똑같이 씁니다.
- 지문 순서로 ${mark}번째에 해당하는 곳을 바꾸세요.
- choiceNotes: targets 와 같은 순서로 5개, 각 낱말이 문맥상 왜 적절한지(정답 자리는 왜 부적절한지)
${COMMON_FIELDS}
출력 형식: {"targets":[{"sentenceId":"s2","phrase":"increase","shown":"decrease"}],"choiceNotes":["..."],"explanation":"...","evidenceSentenceIds":["s2"]}`;
    case "blank":
      return `지문의 주제와 직결되는 핵심 구·절(3~12단어)을 빈칸으로 만드세요.
- sentenceId: 빈칸이 들어갈 문장 ID
- phrase: 빈칸으로 만들 원문 구간 (원문 그대로)
- choices: 영어 선택지 5개, 길이를 비슷하게. 정답은 원문 표현을 그대로 쓰거나 같은 의미로 바꿔 씁니다.
${CHOICE_COMMON}
출력 형식: {"sentenceId":"s4","phrase":"...","choices":["...","...","...","...","..."],"answerIndex":0,"choiceNotes":["","...","...","...","..."],"explanation":"...","evidenceSentenceIds":["s4"]}`;
    case "summary":
      return `지문 전체를 영어 한 문장으로 요약하고, 핵심어 두 곳을 (A), (B) 빈칸으로 만드세요.
- summary: 요약문. "(A)" 와 "(B)" 를 각각 한 번씩 그대로 적습니다.
- choices: 5개, 각각 {"a": (A)에 들어갈 단어, "b": (B)에 들어갈 단어}
- answerIndex, choiceNotes(5개, 정답 자리는 ""), explanation, evidenceSentenceIds
출력 형식: {"summary":"Effort, rather than talent, is (A) to success, so teachers should (B) the process.","choices":[{"a":"key","b":"praise"},{"a":"...","b":"..."},{"a":"...","b":"..."},{"a":"...","b":"..."},{"a":"...","b":"..."}],"answerIndex":0,"choiceNotes":["","...","...","...","..."],"explanation":"...","evidenceSentenceIds":["s3"]}`;
    case "irrelevant":
      return `글의 흐름과 관계없는 영어 문장 1개를 새로 써서 끼워 넣을 위치를 정하세요.
- sentence: 새로 쓴 문장. 지문 소재(단어)는 공유하지만 글의 논지에서 벗어나야 합니다.
- insertAfterSentenceId: 이 문장 바로 뒤에 끼웁니다. 첫 문장 뒤부터 지문 중간 위치를 고르세요.
${COMMON_FIELDS}
출력 형식: {"sentence":"...","insertAfterSentenceId":"s3","explanation":"...","evidenceSentenceIds":["s1"]}`;
    case "order":
      return `지문을 "주어진 글" + 세 부분으로 나누세요. 각 부분은 연속된 문장들이며 원문 순서를 유지합니다.
- part1StartId: 첫째 부분이 시작하는 문장 ID (그 앞 문장들이 주어진 글. 최소 1문장)
- part2StartId, part3StartId: 둘째·셋째 부분 시작 문장 ID
- 각 부분의 첫 문장에 연결사·대명사·지시어 등 순서를 판단할 단서가 있게 나누세요.
- explanation: 첫째·둘째·셋째 부분을 각각 {P1}, {P2}, {P3} 로 가리키며 순서의 근거를 설명합니다. (코드가 (A)(B)(C)로 바꿉니다)
- evidenceSentenceIds: 단서가 있는 문장 ID
출력 형식: {"part1StartId":"s2","part2StartId":"s4","part3StartId":"s6","explanation":"{P1}의 However가 ... 이어서 {P2}는 ... 마지막으로 {P3}...","evidenceSentenceIds":["s2","s4"]}`;
    case "insertion":
      return `지문에서 한 문장을 빼서 "주어진 문장"으로 만드세요. 빠진 자리를 앞뒤 문장의 단서(연결사, 대명사, 논리 흐름)로 찾을 수 있는 문장이어야 합니다.
- removedSentenceId: 뺄 문장 ID (첫 문장 제외)
${COMMON_FIELDS}
출력 형식: {"removedSentenceId":"s4","explanation":"...","evidenceSentenceIds":["s3","s5"]}`;
  }
}

export function questionPrompt(type: QuestionType, sentences: Sentence[], difficulty: Difficulty, targetIndex: number): string {
  return `${passageBlock(sentences)}

위 지문으로 수능 영어 [${QUESTION_TYPE_INFO[type].label}] 유형 문제를 1개 만드세요.
발문: ${QUESTION_TYPE_INFO[type].stem}
${difficultyNote(difficulty)}

${instruction(type, targetIndex)}`;
}
