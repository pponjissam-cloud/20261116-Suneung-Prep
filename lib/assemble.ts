import { findPhrase } from "./align";
import { OutputRuleError, PassageUnsuitableError } from "./errors";
import { CIRCLED, QUESTION_TYPE_INFO } from "./question-types";
import type {
  RawBlank,
  RawChoiceQuestion,
  RawInsertion,
  RawIrrelevant,
  RawOrder,
  RawSummary,
  RawUnderline,
} from "./raw-types";
import { randomInt, shuffleChoices, type Rng } from "./shuffle";
import type { Block, Question, QuestionType, Segment, Sentence } from "./types";

export type AssembledQuestion = Omit<Question, "id">;

/** 수능 순서배열 고정 선택지 (A-B-C 순서는 정답이 될 수 없음) */
export const ORDER_CHOICES = [
  "(A) - (C) - (B)",
  "(B) - (A) - (C)",
  "(B) - (C) - (A)",
  "(C) - (A) - (B)",
  "(C) - (B) - (A)",
] as const;

// ───────────────────────── 공통 도우미 ─────────────────────────

function indexOfId(sentences: Sentence[], id: string): number {
  const i = sentences.findIndex((s) => s.id === id);
  if (i < 0) throw new OutputRuleError(`존재하지 않는 문장 ID: ${id}`);
  return i;
}

function checkIds(sentences: Sentence[], ids: string[]) {
  for (const id of ids) indexOfId(sentences, id);
}

function plainBlock(sentences: Sentence[]): Block {
  return { segments: [{ text: sentences.map((s) => s.text).join(" ") }] };
}

function joinTexts(texts: string[]): Segment[] {
  return [{ text: texts.join(" ") }];
}

function checkFive<T>(arr: T[], name: string) {
  if (arr.length !== 5) throw new OutputRuleError(`${name}은(는) 정확히 5개여야 합니다 (현재 ${arr.length}개).`);
}

function checkDistinct(arr: string[], name: string) {
  const set = new Set(arr.map((s) => s.trim().toLowerCase()));
  if (set.size !== arr.length) throw new OutputRuleError(`${name}에 중복된 항목이 있습니다.`);
}

function checkAnswer(answerIndex: number) {
  if (!Number.isInteger(answerIndex) || answerIndex < 0 || answerIndex > 4)
    throw new OutputRuleError(`answerIndex는 0~4 사이 정수여야 합니다 (현재 ${answerIndex}).`);
}

function base(type: QuestionType, raw: { explanation: string; evidenceSentenceIds: string[] }) {
  return {
    type,
    stem: QUESTION_TYPE_INFO[type].stem,
    explanation: raw.explanation,
    evidenceSentenceIds: raw.evidenceSentenceIds,
  };
}

// ───────────────────────── 유형별 조립 ─────────────────────────

/** 목적·심경·주장·요지·주제·제목: 원문 + 선택지 섞기 */
export function assembleChoice(
  type: QuestionType,
  sentences: Sentence[],
  raw: RawChoiceQuestion,
  rng?: Rng,
): AssembledQuestion {
  checkFive(raw.choices, "choices");
  checkDistinct(raw.choices, "choices");
  checkAnswer(raw.answerIndex);
  checkIds(sentences, raw.evidenceSentenceIds);
  // 내용일치는 수능 관례상 선택지가 지문 순서를 따르므로 섞지 않는다 (정답 위치는 프롬프트에서 무작위 지정)
  const s =
    type === "detail"
      ? { choices: raw.choices, answerIndex: raw.answerIndex, notes: raw.choiceNotes }
      : shuffleChoices(raw.choices, raw.answerIndex, raw.choiceNotes, rng);
  return {
    ...base(type, raw),
    display: [plainBlock(sentences)],
    choices: s.choices,
    answerIndex: s.answerIndex,
    choiceNotes: s.notes,
  };
}

/** 빈칸추론: 원문 구간을 빈칸으로 */
export function assembleBlank(sentences: Sentence[], raw: RawBlank, rng?: Rng): AssembledQuestion {
  checkFive(raw.choices, "choices");
  checkDistinct(raw.choices, "choices");
  checkAnswer(raw.answerIndex);
  checkIds(sentences, raw.evidenceSentenceIds);
  const idx = indexOfId(sentences, raw.sentenceId);
  const target = sentences[idx];
  const span = findPhrase(target.text, raw.phrase);
  if (!span) throw new OutputRuleError(`빈칸 구간 "${raw.phrase}"이(가) ${raw.sentenceId} 문장에 없습니다.`);

  const before = sentences.slice(0, idx).map((s) => s.text);
  const after = sentences.slice(idx + 1).map((s) => s.text);
  const head = [...before, target.text.slice(0, span.start)].join(" ");
  const tail = [target.text.slice(span.end), ...after].join(" ");

  const s = shuffleChoices(raw.choices, raw.answerIndex, raw.choiceNotes, rng);
  return {
    ...base("blank", raw),
    display: [{ segments: [{ text: head }, { text: "", style: "blank" }, { text: tail }] }],
    choices: s.choices,
    answerIndex: s.answerIndex,
    choiceNotes: s.notes,
  };
}

/** 요약문완성 */
export function assembleSummary(sentences: Sentence[], raw: RawSummary, rng?: Rng): AssembledQuestion {
  checkFive(raw.choices, "choices");
  checkAnswer(raw.answerIndex);
  checkIds(sentences, raw.evidenceSentenceIds);
  const labels = raw.choices.map((c) => `${c.a} …… ${c.b}`);
  checkDistinct(labels, "choices");

  const parts = raw.summary.split(/(\(A\)|\(B\))/);
  if (!raw.summary.includes("(A)") || !raw.summary.includes("(B)"))
    throw new OutputRuleError('summary에는 "(A)"와 "(B)" 자리 표시가 하나씩 있어야 합니다.');
  const summarySegs: Segment[] = parts
    .filter((p) => p !== "")
    .map((p) => (p === "(A)" || p === "(B)" ? { text: "", style: "blank", marker: p } : { text: p }));

  const s = shuffleChoices(labels, raw.answerIndex, raw.choiceNotes, rng);
  return {
    ...base("summary", raw),
    display: [plainBlock(sentences), { boxed: true, segments: summarySegs }],
    choices: s.choices,
    answerIndex: s.answerIndex,
    choiceNotes: s.notes,
  };
}

/** 어법·어휘: 밑줄 5곳, 정답 번호는 지문 속 위치로 결정 */
export function assembleUnderline(
  type: "grammar" | "vocabulary",
  sentences: Sentence[],
  raw: RawUnderline,
): AssembledQuestion {
  checkFive(raw.targets, "targets");
  checkIds(sentences, raw.evidenceSentenceIds);

  const located = raw.targets.map((t, origIdx) => {
    const si = indexOfId(sentences, t.sentenceId);
    const span = findPhrase(sentences[si].text, t.phrase);
    if (!span) throw new OutputRuleError(`밑줄 구간 "${t.phrase}"이(가) ${t.sentenceId} 문장에 없습니다.`);
    return { ...t, si, span, origIdx, changed: t.shown.trim() !== t.phrase.trim() };
  });

  const changedCount = located.filter((t) => t.changed).length;
  if (changedCount !== 1)
    throw new OutputRuleError(
      `targets 중 정확히 1곳만 shown이 phrase와 달라야 합니다 (현재 ${changedCount}곳). 나머지 4곳은 shown을 phrase와 똑같이 쓰세요.`,
    );

  located.sort((a, b) => a.si - b.si || a.span.start - b.span.start);
  for (let i = 1; i < located.length; i++) {
    const p = located[i - 1];
    const c = located[i];
    if (p.si === c.si && c.span.start < p.span.end) throw new OutputRuleError("밑줄 구간이 서로 겹칩니다.");
  }

  const segments: Segment[] = [];
  let buf: string[] = [];
  const flush = () => {
    if (buf.length) segments.push({ text: buf.join("") });
    buf = [];
  };
  sentences.forEach((s, si) => {
    if (si > 0) buf.push(" ");
    let cursor = 0;
    for (const [n, t] of located.entries()) {
      if (t.si !== si) continue;
      buf.push(s.text.slice(cursor, t.span.start));
      flush();
      segments.push({ text: t.shown, style: "underline", marker: CIRCLED[n] });
      cursor = t.span.end;
    }
    buf.push(s.text.slice(cursor));
  });
  flush();

  const answerIndex = located.findIndex((t) => t.changed);
  const notes = located.map((t) => raw.choiceNotes[t.origIdx] ?? "");
  notes[answerIndex] = "";

  return {
    ...base(type, raw),
    display: [{ segments }],
    choices: [...CIRCLED],
    answerIndex,
    choiceNotes: notes,
  };
}

/** 무관한 문장: LLM이 쓴 문장을 끼워 넣고, 번호 붙일 5문장은 코드가 고른다 */
export function assembleIrrelevant(sentences: Sentence[], raw: RawIrrelevant, rng: Rng = Math.random): AssembledQuestion {
  if (sentences.length < 5) throw new PassageUnsuitableError("무관한 문장 유형은 5문장 이상의 지문이 필요합니다.");
  checkIds(sentences, raw.evidenceSentenceIds);
  const after = indexOfId(sentences, raw.insertAfterSentenceId);

  const list = sentences.map((s) => ({ text: s.text, inserted: false }));
  list.splice(after + 1, 0, { text: raw.sentence.trim(), inserted: true });
  const insPos = after + 1;

  // 첫 문장은 번호 없이 두고, 끼운 문장을 포함하는 연속 5문장에 번호를 붙인다
  const minStart = Math.max(1, insPos - 4);
  const maxStart = Math.min(insPos, list.length - 5);
  if (maxStart < minStart) throw new OutputRuleError("insertAfterSentenceId 위치로는 번호 5개를 붙일 수 없습니다. 지문 중간 위치를 고르세요.");
  const start = minStart + randomInt(maxStart - minStart + 1, rng);

  const segments: Segment[] = [];
  const pre = list.slice(0, start).map((x) => x.text);
  if (pre.length) segments.push({ text: pre.join(" ") + " " });
  for (let k = 0; k < 5; k++) {
    segments.push({ text: list[start + k].text + " ", marker: CIRCLED[k] });
  }
  const post = list.slice(start + 5).map((x) => x.text);
  if (post.length) segments.push({ text: post.join(" ") });

  return {
    ...base("irrelevant", raw),
    display: [{ segments }],
    choices: [...CIRCLED],
    answerIndex: insPos - start,
    choiceNotes: ["", "", "", "", ""],
  };
}

/** 순서배열: 세 파트에 (A)(B)(C) 라벨을 무작위로 붙인다 */
export function assembleOrder(sentences: Sentence[], raw: RawOrder, rng: Rng = Math.random): AssembledQuestion {
  if (sentences.length < 4) throw new PassageUnsuitableError("순서배열 유형은 4문장 이상의 지문이 필요합니다.");
  checkIds(sentences, raw.evidenceSentenceIds);
  const p1 = indexOfId(sentences, raw.part1StartId);
  const p2 = indexOfId(sentences, raw.part2StartId);
  const p3 = indexOfId(sentences, raw.part3StartId);
  if (!(p1 >= 1 && p1 < p2 && p2 < p3 && p3 < sentences.length))
    throw new OutputRuleError("part1StartId < part2StartId < part3StartId 순서여야 하고, part1 앞에 주어진 글이 최소 1문장 있어야 합니다.");

  const given = sentences.slice(0, p1).map((s) => s.text);
  const parts = [sentences.slice(p1, p2), sentences.slice(p2, p3), sentences.slice(p3)].map((p) => p.map((s) => s.text));

  // 정답 순서 = 원문 순서 (part1, part2, part3). 각 파트에 붙일 라벨을 고른다 (A-B-C 제외)
  const answerIndex = randomInt(ORDER_CHOICES.length, rng);
  const labelsInCorrectOrder = ORDER_CHOICES[answerIndex].split(" - "); // 예: ["(B)", "(A)", "(C)"]
  const byLabel = ["(A)", "(B)", "(C)"].map((label) => {
    const partIdx = labelsInCorrectOrder.indexOf(label);
    return { label, texts: parts[partIdx] };
  });

  const explanation = raw.explanation
    .replaceAll("{P1}", labelsInCorrectOrder[0])
    .replaceAll("{P2}", labelsInCorrectOrder[1])
    .replaceAll("{P3}", labelsInCorrectOrder[2]);

  return {
    ...base("order", { ...raw, explanation }),
    display: [
      { boxed: true, segments: joinTexts(given) },
      ...byLabel.map((b) => ({ label: b.label, segments: joinTexts(b.texts) })),
    ],
    choices: [...ORDER_CHOICES],
    answerIndex,
    choiceNotes: ["", "", "", "", ""],
  };
}

/** 문장삽입: 뺀 문장 자리를 포함하는 연속 5개 틈에 번호 */
export function assembleInsertion(sentences: Sentence[], raw: RawInsertion, rng: Rng = Math.random): AssembledQuestion {
  if (sentences.length < 6) throw new PassageUnsuitableError("문장삽입 유형은 6문장 이상의 지문이 필요합니다.");
  checkIds(sentences, raw.evidenceSentenceIds);
  const k = indexOfId(sentences, raw.removedSentenceId);
  if (k === 0) throw new OutputRuleError("첫 문장은 삽입 문장으로 고를 수 없습니다.");

  const removed = sentences[k];
  const rest = sentences.filter((_, i) => i !== k);
  // 틈 g = rest[g] 바로 뒤. 정답 틈 = k-1
  const gapCount = rest.length; // 마지막 문장 뒤 포함
  const correct = k - 1;
  const minStart = Math.max(0, correct - 4);
  const maxStart = Math.min(correct, gapCount - 5);
  const start = minStart + randomInt(maxStart - minStart + 1, rng);

  const segments: Segment[] = [];
  rest.forEach((s, g) => {
    segments.push({ text: s.text + " " });
    if (g >= start && g < start + 5) segments.push({ text: " ", marker: `( ${CIRCLED[g - start]} )` });
  });

  return {
    ...base("insertion", raw),
    display: [{ boxed: true, segments: [{ text: removed.text }] }, { segments }],
    choices: [...CIRCLED],
    answerIndex: correct - start,
    choiceNotes: ["", "", "", "", ""],
  };
}
