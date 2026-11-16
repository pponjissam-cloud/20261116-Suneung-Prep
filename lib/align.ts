/**
 * LLM은 글자 오프셋을 정확히 세지 못한다.
 * 그래서 LLM에게는 "원문에 있는 구절 그대로"를 받고, 오프셋은 코드가 계산한다.
 */

export type Span = { start: number; end: number };

const norm = (s: string) => s.replace(/[“”]/g, '"').replace(/[‘’]/g, "'").toLowerCase();

/** text 안에서 phrase 위치를 찾는다. 따옴표 종류와 대소문자 차이는 무시한다. */
export function findPhrase(text: string, phrase: string, from = 0): Span | null {
  const p = phrase.trim();
  if (!p) return null;
  let idx = text.indexOf(p, from);
  if (idx < 0) idx = norm(text).indexOf(norm(p), from);
  if (idx < 0) return null;
  return { start: idx, end: idx + p.length };
}

/**
 * 문장을 앞에서부터 순서대로 덮는 조각들의 오프셋을 계산한다.
 * 조각 하나라도 찾지 못하면 null.
 */
export function alignSequential(text: string, pieces: string[]): Span[] | null {
  const spans: Span[] = [];
  let cursor = 0;
  for (const piece of pieces) {
    const span = findPhrase(text, piece, cursor);
    if (!span) return null;
    // 앞 조각과 사이에 단어가 통째로 빠져 있으면 잘못 나눈 것으로 본다
    const gap = text.slice(cursor, span.start);
    if (/[A-Za-z]{2,}/.test(gap)) return null;
    spans.push(span);
    cursor = span.end;
  }
  return spans;
}

/** 단어가 지문에 (대소문자 무시, 단어 경계 기준으로) 등장하는지 */
export function containsWord(passage: string, word: string): boolean {
  const w = word.trim();
  if (!w) return false;
  const escaped = w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^A-Za-z])${escaped}([^A-Za-z]|$)`, "i").test(passage);
}
