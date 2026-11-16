import { describe, expect, it } from "vitest";
import {
  ORDER_CHOICES,
  assembleBlank,
  assembleChoice,
  assembleInsertion,
  assembleIrrelevant,
  assembleOrder,
  assembleUnderline,
} from "../lib/assemble";
import { OutputRuleError, PassageUnsuitableError } from "../lib/errors";
import { seededRng, shuffleChoices } from "../lib/shuffle";
import { splitSentences } from "../lib/split-sentences";
import type { Question } from "../lib/types";

const PASSAGE =
  "Many people believe that talent decides success. However, research shows otherwise. " +
  "In one study, students who practiced daily improved the most. " +
  "Their natural ability mattered less than their habits. " +
  "This suggests that effort can be learned. " +
  "Teachers should therefore praise process rather than results. " +
  "Doing so helps students keep going when tasks get hard.";
const S = splitSentences(PASSAGE); // 7문장
const common = { explanation: "근거 {P1} {P2} {P3}", evidenceSentenceIds: ["s2"] };

const displayText = (q: Pick<Question, "display">) =>
  q.display.map((b) => b.segments.map((s) => (s.marker ?? "") + s.text).join("")).join("\n");

describe("shuffleChoices", () => {
  it("섞은 뒤에도 정답 인덱스가 원래 정답을 가리킨다", () => {
    const choices = ["a", "b", "c", "d", "e"];
    for (let seed = 1; seed < 50; seed++) {
      const r = shuffleChoices(choices, 2, ["na", "nb", "", "nd", "ne"], seededRng(seed));
      expect(r.choices[r.answerIndex]).toBe("c");
      expect(r.notes[r.answerIndex]).toBe("");
      expect([...r.choices].sort()).toEqual(choices);
    }
  });
});

describe("assembleChoice", () => {
  it("선택지 5개가 아니면 규칙 오류", () => {
    expect(() =>
      assembleChoice("topic", S, { ...common, choices: ["a", "b"], answerIndex: 0, choiceNotes: [] }),
    ).toThrow(OutputRuleError);
  });
  it("내용일치는 순서를 섞지 않는다", () => {
    const q = assembleChoice("detail", S, {
      ...common,
      choices: ["1", "2", "3", "4", "5"],
      answerIndex: 3,
      choiceNotes: ["", "", "", "", ""],
    });
    expect(q.choices).toEqual(["1", "2", "3", "4", "5"]);
    expect(q.answerIndex).toBe(3);
  });
});

describe("assembleBlank", () => {
  it("구간을 빈칸으로 바꾼다", () => {
    const q = assembleBlank(
      S,
      { ...common, sentenceId: "s5", phrase: "effort can be learned", choices: ["a", "b", "c", "d", "e"], answerIndex: 0, choiceNotes: ["", "", "", "", ""] },
      seededRng(3),
    );
    const segs = q.display[0].segments;
    expect(segs[1].style).toBe("blank");
    expect(segs[0].text.endsWith("This suggests that ")).toBe(true);
    expect(segs[2].text.startsWith(". Teachers")).toBe(true);
  });
  it("없는 구간이면 규칙 오류", () => {
    expect(() =>
      assembleBlank(S, { ...common, sentenceId: "s5", phrase: "not here", choices: ["a", "b", "c", "d", "e"], answerIndex: 0, choiceNotes: [] }),
    ).toThrow(OutputRuleError);
  });
});

describe("assembleUnderline", () => {
  const targets = [
    { sentenceId: "s3", phrase: "practiced", shown: "practiced" },
    { sentenceId: "s1", phrase: "decides", shown: "deciding" }, // 틀린 곳 (원문 순서상 첫 번째)
    { sentenceId: "s4", phrase: "mattered", shown: "mattered" },
    { sentenceId: "s6", phrase: "rather than", shown: "rather than" },
    { sentenceId: "s7", phrase: "keep going", shown: "keep going" },
  ];
  it("밑줄을 지문 순서로 번호 매기고 정답 위치를 계산한다", () => {
    const q = assembleUnderline("grammar", S, { ...common, targets, choiceNotes: ["n1", "n2", "n3", "n4", "n5"] });
    expect(q.answerIndex).toBe(0);
    const ul = q.display[0].segments.filter((s) => s.style === "underline");
    expect(ul.map((s) => s.text)).toEqual(["deciding", "practiced", "mattered", "rather than", "keep going"]);
    expect(ul.map((s) => s.marker)).toEqual(["①", "②", "③", "④", "⑤"]);
    expect(q.choiceNotes).toEqual(["", "n1", "n3", "n4", "n5"]);
    expect(displayText(q)).toContain("talent ①deciding success.");
  });
  it("바뀐 곳이 1개가 아니면 규칙 오류", () => {
    const t = targets.map((x) => ({ ...x, shown: x.phrase }));
    expect(() => assembleUnderline("grammar", S, { ...common, targets: t, choiceNotes: [] })).toThrow(OutputRuleError);
  });
});

describe("assembleOrder", () => {
  it("정답 순서가 원문 순서와 일치하고 A-B-C 는 나오지 않는다", () => {
    for (let seed = 1; seed < 30; seed++) {
      const q = assembleOrder(S, { ...common, part1StartId: "s2", part2StartId: "s4", part3StartId: "s6" }, seededRng(seed));
      expect(q.choices).toEqual([...ORDER_CHOICES]);
      const labels = q.choices[q.answerIndex].split(" - ");
      const byLabel = Object.fromEntries(q.display.slice(1).map((b) => [b.label, b.segments[0].text]));
      const rebuilt = [q.display[0].segments[0].text, ...labels.map((l) => byLabel[l])].join(" ");
      expect(rebuilt).toBe(S.map((s) => s.text).join(" "));
      expect(q.explanation).toBe(`근거 ${labels[0]} ${labels[1]} ${labels[2]}`);
    }
  });
  it("파트 순서가 잘못되면 규칙 오류", () => {
    expect(() => assembleOrder(S, { ...common, part1StartId: "s4", part2StartId: "s2", part3StartId: "s6" })).toThrow(OutputRuleError);
  });
});

describe("assembleInsertion", () => {
  it("정답 틈에 뺀 문장을 넣으면 원문이 된다", () => {
    for (let seed = 1; seed < 30; seed++) {
      const q = assembleInsertion(S, { ...common, removedSentenceId: "s4" }, seededRng(seed));
      const removed = q.display[0].segments[0].text;
      expect(removed).toBe(S[3].text);
      const markers = q.display[1].segments.filter((s) => s.marker);
      expect(markers).toHaveLength(5);
      const rebuilt = q.display[1].segments
        .map((s) => (s.marker === `( ${"①②③④⑤"[q.answerIndex]} )` ? removed + " " : s.marker ? "" : s.text))
        .join("")
        .replace(/\s+/g, " ")
        .trim();
      expect(rebuilt).toBe(S.map((s) => s.text).join(" "));
    }
  });
  it("짧은 지문은 부적합", () => {
    expect(() => assembleInsertion(S.slice(0, 4), { ...common, removedSentenceId: "s2" })).toThrow(PassageUnsuitableError);
  });
});

describe("assembleIrrelevant", () => {
  it("끼운 문장이 정답 번호에 있다", () => {
    for (let seed = 1; seed < 30; seed++) {
      const q = assembleIrrelevant(S, { ...common, insertAfterSentenceId: "s3", sentence: "Bananas are yellow." }, seededRng(seed));
      const numbered = q.display[0].segments.filter((s) => s.marker);
      expect(numbered).toHaveLength(5);
      expect(numbered[q.answerIndex].text.trim()).toBe("Bananas are yellow.");
      expect(q.display[0].segments[0].marker).toBeUndefined(); // 첫 문장은 번호 없음
    }
  });
});
