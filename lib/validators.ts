import { alignSequential, containsWord, findPhrase } from "./align";
import { OutputRuleError } from "./errors";
import type { RawGrammar, RawStructure, RawTranslation, RawVocab } from "./raw-types";
import {
  STRUCTURE_ROLES,
  type GrammarPoint,
  type Sentence,
  type SentenceStructure,
  type StructureRole,
  type Translation,
  type VocabItem,
} from "./types";

function sentenceMap(sentences: Sentence[]) {
  return new Map(sentences.map((s) => [s.id, s]));
}

/** 참조한 문장 ID가 모두 존재하는지 */
export function validateSentenceRefs(sentences: Sentence[], ids: string[]): void {
  const map = sentenceMap(sentences);
  const missing = ids.filter((id) => !map.has(id));
  if (missing.length) throw new OutputRuleError(`존재하지 않는 문장 ID: ${missing.join(", ")}`);
}

/** 단어목록: 지문에 없는 단어는 버리고, 너무 적게 남으면 재생성 */
export function validateVocab(sentences: Sentence[], raw: RawVocab): VocabItem[] {
  validateSentenceRefs(sentences, raw.items.map((i) => i.sentenceId));
  const map = sentenceMap(sentences);
  const seen = new Set<string>();
  const kept = raw.items.filter((item) => {
    const key = item.lemma.toLowerCase();
    if (seen.has(key)) return false;
    const s = map.get(item.sentenceId)!;
    const ok = containsWord(s.text, item.word);
    if (ok) seen.add(key);
    return ok;
  });
  const dropped = raw.items.length - kept.length;
  if (kept.length < 10 || dropped > raw.items.length / 3)
    throw new OutputRuleError(
      `단어 ${dropped}개가 해당 문장에 그대로 나오지 않거나 중복입니다. word에는 지문에 나온 철자 그대로를 쓰고, sentenceId를 정확히 지정하세요.`,
    );
  const order = new Map(sentences.map((s, i) => [s.id, i]));
  return kept.sort((a, b) => order.get(a.sentenceId)! - order.get(b.sentenceId)!);
}

/** 해석: 모든 문장에 정확히 하나씩 */
export function validateTranslation(sentences: Sentence[], raw: RawTranslation): Translation[] {
  validateSentenceRefs(sentences, raw.items.map((i) => i.sentenceId));
  const byId = new Map(raw.items.map((i) => [i.sentenceId, i]));
  const missing = sentences.filter((s) => !byId.has(s.id)).map((s) => s.id);
  if (missing.length) throw new OutputRuleError(`해석이 빠진 문장: ${missing.join(", ")}`);
  return sentences.map((s) => byId.get(s.id)!);
}

/** 문법·구문: phrase 가 문장 안에 있어야 하고 오프셋은 코드가 계산 */
export function validateGrammar(sentences: Sentence[], raw: RawGrammar): GrammarPoint[] {
  validateSentenceRefs(sentences, raw.items.map((i) => i.sentenceId));
  const map = sentenceMap(sentences);
  const bad: string[] = [];
  const points: GrammarPoint[] = [];
  for (const item of raw.items) {
    const span = findPhrase(map.get(item.sentenceId)!.text, item.phrase);
    if (!span) {
      bad.push(`"${item.phrase}" (${item.sentenceId})`);
      continue;
    }
    points.push({ ...item, start: span.start, end: span.end });
  }
  if (bad.length > 1 || points.length < 3)
    throw new OutputRuleError(`다음 구간이 해당 문장에 그대로 없습니다: ${bad.join(", ")}. phrase는 원문을 한 글자도 바꾸지 말고 복사하세요.`);
  return points;
}

function toRole(r: string): StructureRole {
  const up = r.toUpperCase().trim() as StructureRole;
  if (!STRUCTURE_ROLES.includes(up)) throw new OutputRuleError(`알 수 없는 성분 role: ${r}`);
  return up;
}

/** 문장구조: 모든 문장에 대해, 토큰들이 문장을 앞에서부터 빠짐없이 덮어야 함 */
export function validateStructure(sentences: Sentence[], raw: RawStructure, lenient = false): SentenceStructure[] {
  validateSentenceRefs(sentences, raw.items.map((i) => i.sentenceId));
  const byId = new Map(raw.items.map((i) => [i.sentenceId, i]));
  const errors: string[] = [];
  const out: SentenceStructure[] = [];

  for (const s of sentences) {
    const item = byId.get(s.id);
    if (!item) {
      errors.push(`${s.id}: 분석 누락`);
      continue;
    }
    const spans = alignSequential(s.text, item.tokens.map((t) => t.text));
    if (!spans) {
      errors.push(`${s.id}: tokens의 text를 이어 붙이면 원문 문장이 되어야 합니다 (순서대로, 단어 생략 없이)`);
      continue;
    }
    if (![1, 2, 3, 4, 5].includes(item.pattern)) {
      errors.push(`${s.id}: pattern은 1~5`);
      continue;
    }
    out.push({
      sentenceId: s.id,
      pattern: item.pattern,
      note: item.note,
      tokens: item.tokens.map((t, i) => ({
        text: s.text.slice(spans[i].start, spans[i].end),
        start: spans[i].start,
        end: spans[i].end,
        role: toRole(t.role),
        clause: t.clause || undefined,
      })),
    });
  }
  // 마지막 시도에서는 일부 문장만 실패했으면 성공한 문장만이라도 보여준다
  if (errors.length && !(lenient && out.length >= sentences.length / 2)) throw new OutputRuleError(errors.join("\n"));
  return out;
}
