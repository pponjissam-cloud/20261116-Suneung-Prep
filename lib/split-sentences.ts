import type { Sentence } from "./types";

// 마침표 뒤에 대문자가 와도 문장이 끝나지 않는 약어
const ABBREVIATIONS = new Set([
  "mr", "mrs", "ms", "dr", "prof", "sr", "jr", "st", "vs", "etc", "e.g", "i.e",
  "u.s", "u.k", "u.n", "a.m", "p.m", "no", "fig", "inc", "ltd", "co", "corp", "mt",
  "jan", "feb", "mar", "apr", "jun", "jul", "aug", "sep", "sept", "oct", "nov", "dec",
]);

const CLOSERS = new Set(['"', "'", "”", "’", ")", "]"]);
const OPENERS = /["'“‘(\[]/;

/** 공백·줄바꿈을 정리한다. 이 정규화 결과가 모든 오프셋의 기준이 된다. */
export function normalizePassage(raw: string): string {
  return raw
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\s*\n\s*/g, " ")
    .trim();
}

function wordBefore(text: string, end: number): string {
  let i = end - 1;
  while (i >= 0 && /[A-Za-z.]/.test(text[i])) i--;
  return text.slice(i + 1, end).toLowerCase();
}

/** 영어 지문을 문장 단위로 나누고 s1, s2… ID를 붙인다. */
export function splitSentences(raw: string): Sentence[] {
  const text = normalizePassage(raw);
  const result: string[] = [];
  let start = 0;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch !== "." && ch !== "!" && ch !== "?") continue;

    // 연속 구두점(..., ?!)은 끝까지 묶는다
    let end = i + 1;
    while (end < text.length && /[.!?]/.test(text[end])) end++;
    while (end < text.length && CLOSERS.has(text[end])) end++;

    // 뒤에 공백이 없으면(소수점 3.14, 이메일 등) 문장 끝이 아니다
    if (end < text.length && text[end] !== " ") {
      i = end - 1;
      continue;
    }

    const next = text.slice(end + 1, end + 3);
    const nextStartsSentence = end >= text.length || /^[A-Z0-9]/.test(next) || OPENERS.test(next[0] ?? "");

    if (ch === "." && end - i === 1) {
      const w = wordBefore(text, i);
      // 약어 또는 이니셜(J. K. Rowling)
      if (ABBREVIATIONS.has(w.replace(/\.$/, "")) || /^[a-z]$/.test(w)) {
        if (!(end >= text.length)) {
          i = end - 1;
          continue;
        }
      }
    }

    if (!nextStartsSentence) {
      i = end - 1;
      continue;
    }

    result.push(text.slice(start, end).trim());
    start = end + 1;
    i = end - 1;
  }

  const tail = text.slice(start).trim();
  if (tail) result.push(tail);

  return result.filter(Boolean).map((t, idx) => ({ id: `s${idx + 1}`, text: t }));
}

/** 영어 단어 수 */
export function countWords(raw: string): number {
  const m = raw.match(/[A-Za-z]+(?:['’-][A-Za-z]+)*/g);
  return m ? m.length : 0;
}

/** 공백을 제외한 글자 중 영어(라틴 문자·숫자·구두점)가 아닌 비율 */
export function nonEnglishRatio(raw: string): number {
  const chars = raw.replace(/\s/g, "");
  if (!chars.length) return 0;
  const nonEn = chars.replace(/[\x20-\x7E“”‘’—–…]/g, "").length;
  return nonEn / chars.length;
}
