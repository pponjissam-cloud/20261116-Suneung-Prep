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
