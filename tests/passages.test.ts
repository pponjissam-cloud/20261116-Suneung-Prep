import { describe, expect, it } from "vitest";
import { migrateEntry } from "../lib/history";
import { normalizeLabel, splitBySeparators, tidyExtracted } from "../lib/passages";
import { orderedPrintItems } from "../lib/print-sections";

const words = (n: number) => Array.from({ length: n }, (_, i) => `word${i}`).join(" ") + ".";

describe("splitBySeparators", () => {
  it("구분선으로 나눈다", () => {
    expect(splitBySeparators("First passage.\n===\nSecond passage.\n\n-----\nThird.")).toEqual(["First passage.", "Second passage.", "Third."]);
  });
  it("구분선이 없으면 하나", () => {
    expect(splitBySeparators("Only one.\n\nStill one.")).toHaveLength(1);
  });
  it("문장 안의 하이픈·대시는 구분선이 아니다", () => {
    expect(splitBySeparators("A well-known fact --- really.\nMore.")).toHaveLength(1);
  });
});

describe("normalizeLabel / tidyExtracted", () => {
  it("숫자만 있으면 '번'을 붙이고, 없으면 지문 n", () => {
    expect(normalizeLabel("18", 0)).toBe("18번");
    expect(normalizeLabel("", 2)).toBe("지문 3");
    expect(normalizeLabel(undefined, 0)).toBe("지문 1");
    expect(normalizeLabel("41~42번", 0)).toBe("41~42번");
  });
  it("짧은 조각은 버리고 빈칸 경고를 붙인다", () => {
    const r = tidyExtracted([
      { label: "18", passage: words(30) },
      { label: "x", passage: "Too short." },
      { passage: words(25) + " It is _____ to learn." },
    ]);
    expect(r.map((x) => x.label)).toEqual(["18번", "지문 2"]);
    expect(r[1].warnings.some((w) => w.includes("빈칸"))).toBe(true);
  });
  it("최대 10개까지", () => {
    expect(tidyExtracted(Array.from({ length: 14 }, () => ({ passage: words(30) })))).toHaveLength(10);
  });
});

describe("orderedPrintItems", () => {
  const ids = ["a", "b"];
  it("지문별로 섹션을 차례로", () => {
    const r = orderedPrintItems(ids, { keys: ["answers", "questions"], passageIds: ids, answersAtEnd: false });
    expect(r.map((x) => `${x.passageId}:${x.key}`)).toEqual(["a:questions", "a:answers", "b:questions", "b:answers"]);
  });
  it("정답지 맨 뒤로", () => {
    const r = orderedPrintItems(ids, { keys: ["cover", "questions", "answers"], passageIds: ids, answersAtEnd: true });
    expect(r.map((x) => `${x.passageId}:${x.key}`)).toEqual(["a:cover", "a:questions", "b:cover", "b:questions", "a:answers", "b:answers"]);
  });
  it("고른 지문만, 원래 순서대로", () => {
    const r = orderedPrintItems(["a", "b", "c"], { keys: ["questions"], passageIds: ["c", "a"], answersAtEnd: false });
    expect(r.map((x) => x.passageId)).toEqual(["a", "c"]);
  });
});

describe("migrateEntry", () => {
  it("지문 1개짜리 예전 기록을 새 형식으로", () => {
    const legacy = {
      id: "x",
      createdAt: "2026-11-16T00:00:00Z",
      preview: "Many",
      request: { passage: "Many people...", questionTypes: ["topic" as const], difficulty: "basic" as const },
      result: { sentences: [], questions: [] },
    };
    const m = migrateEntry(legacy);
    expect(m.request.passages).toEqual([{ id: "p1", label: "지문 1", text: "Many people..." }]);
    expect(m.results.p1).toEqual({ sentences: [], questions: [] });
  });
});
