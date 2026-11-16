import { describe, expect, it } from "vitest";
import { countWords, nonEnglishRatio, splitSentences } from "../lib/split-sentences";

const texts = (raw: string) => splitSentences(raw).map((s) => s.text);

describe("splitSentences", () => {
  it("기본 문장 분리와 ID", () => {
    const r = splitSentences("I like apples. Do you? Yes!");
    expect(r).toEqual([
      { id: "s1", text: "I like apples." },
      { id: "s2", text: "Do you?" },
      { id: "s3", text: "Yes!" },
    ]);
  });

  it("약어에서 끊지 않는다", () => {
    expect(texts("Dr. Kim met Mr. Lee. They talked.")).toEqual(["Dr. Kim met Mr. Lee.", "They talked."]);
    expect(texts("The U.S. Army arrived. It rained.")).toEqual(["The U.S. Army arrived.", "It rained."]);
    expect(texts("Prices rose, e.g. food and fuel. Wages did not.")).toEqual([
      "Prices rose, e.g. food and fuel.",
      "Wages did not.",
    ]);
  });

  it("소수점에서 끊지 않는다", () => {
    expect(texts("It grew 3.5 percent. That is fast.")).toEqual(["It grew 3.5 percent.", "That is fast."]);
  });

  it("따옴표로 끝나는 문장", () => {
    expect(texts('She said, "I am ready." He nodded.')).toEqual(['She said, "I am ready."', "He nodded."]);
    expect(texts("“Why?” he asked. Nobody knew.")).toEqual(["“Why?” he asked.", "Nobody knew."]);
  });

  it("말줄임표: 소문자가 이어지면 같은 문장", () => {
    expect(texts("I waited... and waited. Finally, it came.")).toEqual([
      "I waited... and waited.",
      "Finally, it came.",
    ]);
  });

  it("이니셜", () => {
    expect(texts("J. K. Rowling wrote it. It sold well.")).toEqual(["J. K. Rowling wrote it.", "It sold well."]);
  });

  it("줄바꿈 정리", () => {
    expect(texts("First line.\n\nSecond   line.")).toEqual(["First line.", "Second line."]);
  });
});

describe("countWords / nonEnglishRatio", () => {
  it("단어 수", () => {
    expect(countWords("It's a well-known fact, isn't it?")).toBe(6);
  });
  it("비영어 비율", () => {
    expect(nonEnglishRatio("hello")).toBe(0);
    expect(nonEnglishRatio("안녕하세요")).toBe(1);
  });
});
