import type { QuestionType } from "./types";

/** 유형별 한국어 이름과 수능 발문 */
export const QUESTION_TYPE_INFO: Record<QuestionType, { label: string; stem: string }> = {
  purpose: { label: "목적", stem: "다음 글의 목적으로 가장 적절한 것은?" },
  mood: { label: "심경", stem: "다음 글에 드러난 'I'의 심경 변화로 가장 적절한 것은?" },
  claim: { label: "주장", stem: "다음 글에서 필자가 주장하는 바로 가장 적절한 것은?" },
  gist: { label: "요지", stem: "다음 글의 요지로 가장 적절한 것은?" },
  topic: { label: "주제", stem: "다음 글의 주제로 가장 적절한 것은?" },
  title: { label: "제목", stem: "다음 글의 제목으로 가장 적절한 것은?" },
  detail: { label: "내용일치", stem: "다음 글의 내용과 일치하지 않는 것은?" },
  grammar: { label: "어법", stem: "다음 글의 밑줄 친 부분 중, 어법상 틀린 것은?" },
  vocabulary: { label: "어휘", stem: "다음 글의 밑줄 친 부분 중, 문맥상 낱말의 쓰임이 적절하지 않은 것은?" },
  blank: { label: "빈칸추론", stem: "다음 빈칸에 들어갈 말로 가장 적절한 것은?" },
  irrelevant: { label: "무관한 문장", stem: "다음 글에서 전체 흐름과 관계 없는 문장은?" },
  order: { label: "순서배열", stem: "주어진 글 다음에 이어질 글의 순서로 가장 적절한 것은?" },
  insertion: { label: "문장삽입", stem: "글의 흐름으로 보아, 주어진 문장이 들어가기에 가장 적절한 곳은?" },
  summary: {
    label: "요약문완성",
    stem: "다음 글의 내용을 한 문장으로 요약하고자 한다. 빈칸 (A), (B)에 들어갈 말로 가장 적절한 것은?",
  },
};

export const CIRCLED = ["①", "②", "③", "④", "⑤"] as const;
