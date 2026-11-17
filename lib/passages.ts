/** 여러 지문 다루기 (클라이언트·서버 공통, 런타임 의존성 없음) */
import { countWords } from "./split-sentences";
import { cleanExtractedText, hasBlank } from "./upload";

/** 한 번에 처리할 수 있는 최대 지문 수 */
export const MAX_PASSAGES = 10;

export type PassageInput = {
  id: string;
  /** "18번", "지문 2" 처럼 화면·인쇄물에 보일 이름 */
  label: string;
  text: string;
};

export type ExtractedPassage = { label: string; text: string; warnings: string[] };

/** 구분선(===, ---, ***, ### 등 3자 이상만 있는 줄)으로 지문을 나눈다 */
export function splitBySeparators(text: string): string[] {
  return text
    .split(/^\s*(?:={3,}|-{3,}|\*{3,}|#{3,}|~{3,})\s*$/m)
    .map((t) => t.trim())
    .filter(Boolean);
}

/** 문항 번호처럼 보이는 라벨이면 "18번" 형태로 맞춘다 */
export function normalizeLabel(label: string | undefined, index: number): string {
  const l = (label ?? "").trim();
  if (!l) return `지문 ${index + 1}`;
  if (/^\d{1,3}$/.test(l)) return `${l}번`;
  return l.slice(0, 30);
}

/** LLM이 돌려준 지문 목록을 정리: 글자 정리, 너무 짧은 것 제거, 빈칸 경고 */
export function tidyExtracted(raw: { label?: string; passage: string; warnings?: string[] }[]): ExtractedPassage[] {
  return raw
    .map((r) => ({ label: r.label, text: cleanExtractedText(r.passage), warnings: [...(r.warnings ?? [])] }))
    .filter((r) => countWords(r.text) >= 20)
    .slice(0, MAX_PASSAGES)
    .map((r, i) => {
      if (hasBlank(r.text)) r.warnings.push("빈칸(____)이 있습니다. 빈칸에 들어갈 원래 표현을 채워 넣어야 분석이 정확합니다.");
      return { label: normalizeLabel(r.label, i), text: r.text, warnings: r.warnings };
    });
}

let seq = 0;
/** 화면용 고유 ID */
export function newPassageId(): string {
  seq += 1;
  return `p${Date.now().toString(36)}${seq}`;
}
