import { describe, expect, it } from "vitest";
import { alignSequential, containsWord, findPhrase } from "../lib/align";
import { OutputRuleError } from "../lib/errors";
import { splitSentences } from "../lib/split-sentences";
import { validateGrammar, validateSentenceRefs, validateStructure, validateTranslation, validateVocab } from "../lib/validators";

const S = splitSentences("What matters most is how you respond. People often forget this simple rule.");

describe("align", () => {
  it("findPhrase: 따옴표·대소문자 무시", () => {
    expect(findPhrase("He said “no” loudly.", '"No"')).toEqual({ start: 8, end: 12 });
  });
  it("alignSequential: 순서대로 덮어야 한다", () => {
    expect(alignSequential(S[0].text, ["What matters most", "is", "how you respond"])).not.toBeNull();
    expect(alignSequential(S[0].text, ["What matters most", "how you respond"])).toBeNull(); // is 생략
  });
  it("containsWord: 단어 경계", () => {
    expect(containsWord("The cat sat.", "cat")).toBe(true);
    expect(containsWord("The category.", "cat")).toBe(false);
  });
});

describe("validateSentenceRefs", () => {
  it("없는 ID", () => {
    expect(() => validateSentenceRefs(S, ["s1", "s9"])).toThrow(OutputRuleError);
  });
});

describe("validateVocab", () => {
  const item = (word: string, sentenceId = "s2") => ({
    word, lemma: word, pos: "n.", meaningKo: "뜻", synonyms: [], antonyms: [], sentenceId,
  });
  it("지문에 없는 단어가 많으면 규칙 오류", () => {
    expect(() => validateVocab(S, { items: [item("rule"), item("banana"), item("kiwi")] })).toThrow(OutputRuleError);
  });
  it("통과 시 지문 순서로 정렬", () => {
    const words = ["People", "often", "forget", "this", "simple", "rule"];
    const items = [...words.map((w) => item(w)), item("What", "s1"), item("matters", "s1"), item("most", "s1"), item("respond", "s1")];
    const r = validateVocab(S, { items });
    expect(r[0].sentenceId).toBe("s1");
    expect(r).toHaveLength(10);
  });
});

describe("validateTranslation", () => {
  it("빠진 문장이 있으면 규칙 오류", () => {
    expect(() => validateTranslation(S, { items: [{ sentenceId: "s1", natural: "a", chunked: "b" }] })).toThrow(OutputRuleError);
  });
});

describe("validateGrammar", () => {
  it("오프셋을 계산한다", () => {
    const ex = { en: "x", ko: "y" };
    const r = validateGrammar(S, {
      items: [
        { title: "관계대명사 what", sentenceId: "s1", phrase: "What matters most", explanation: "", example: ex },
        { title: "의문사절", sentenceId: "s1", phrase: "how you respond", explanation: "", example: ex },
        { title: "빈도부사", sentenceId: "s2", phrase: "often forget", explanation: "", example: ex },
      ],
    });
    expect(r[1].start).toBe(S[0].text.indexOf("how"));
  });
});

describe("validateStructure", () => {
  const good = {
    sentenceId: "s1", pattern: 2 as const,
    tokens: [
      { text: "What matters most", role: "S", clause: "명사절" },
      { text: "is", role: "V" },
      { text: "how you respond", role: "C", clause: "명사절" },
    ],
  };
  const bad = { sentenceId: "s2", pattern: 3 as const, tokens: [{ text: "People", role: "S" }, { text: "this simple rule", role: "O" }] };
  it("엄격 모드에서는 하나라도 틀리면 오류", () => {
    expect(() => validateStructure(S, { items: [good, bad] })).toThrow(OutputRuleError);
  });
  it("관대 모드에서는 성공한 문장만 반환", () => {
    const r = validateStructure(S, { items: [good, bad] }, true);
    expect(r).toHaveLength(1);
    expect(r[0].tokens[1]).toMatchObject({ role: "V", text: "is" });
  });
});
