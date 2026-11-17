/** 인쇄·PDF·Word 내보내기에 쓰는 섹션 목록 (순서 = 출력 순서) */
export type PrintKey = "cover" | "vocabulary" | "translation" | "grammar" | "structure" | "questions" | "answers";

export const PRINT_SECTIONS: { key: PrintKey; label: string }[] = [
  { key: "cover", label: "표지 (원문 지문)" },
  { key: "vocabulary", label: "① 단어목록" },
  { key: "translation", label: "② 문장별 해석" },
  { key: "grammar", label: "③ 중요 문법·구문" },
  { key: "structure", label: "④ 문장구조분석" },
  { key: "questions", label: "⑤ 유형별 문제" },
  { key: "answers", label: "⑥ 정답지" },
];

/** 인쇄·PDF·Word 내보내기 옵션 */
export type ExportOptions = {
  keys: PrintKey[];
  /** 내보낼 지문 ID (입력 순서와 무관하게 지문 순서는 원래 순서를 따른다) */
  passageIds: string[];
  /** 정답지를 각 지문 뒤가 아니라 맨 뒤에 모은다 */
  answersAtEnd: boolean;
};

export type PrintItem = { passageId: string; key: PrintKey };

/**
 * 출력 순서: 지문1의 고른 섹션들 → 지문2의 고른 섹션들 → …
 * answersAtEnd 이면 정답지만 빼서 맨 뒤에 지문 순서대로 모은다.
 */
export function orderedPrintItems(allPassageIds: string[], opts: ExportOptions): PrintItem[] {
  const pids = allPassageIds.filter((id) => opts.passageIds.includes(id));
  const keys = PRINT_SECTIONS.map((s) => s.key).filter((k) => opts.keys.includes(k));
  const main = pids.flatMap((pid) => keys.filter((k) => !(opts.answersAtEnd && k === "answers")).map((key) => ({ passageId: pid, key })));
  const tail = opts.answersAtEnd && keys.includes("answers") ? pids.map((pid) => ({ passageId: pid, key: "answers" as const })) : [];
  return [...main, ...tail];
}
