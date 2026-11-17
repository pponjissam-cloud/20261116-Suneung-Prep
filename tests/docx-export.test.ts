import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import { Packer } from "docx";
import { assembleOrder } from "../lib/assemble";
import { buildDocx, type DocxExportInput } from "../lib/docx-export";
import { seededRng } from "../lib/shuffle";
import { splitSentences } from "../lib/split-sentences";
import { SAMPLE_PASSAGE } from "../lib/sample";
import type { AnalysisResult } from "../lib/types";

function resultFor(text: string): AnalysisResult {
  const S = splitSentences(text);
  return {
    sentences: S,
    translations: S.map((s) => ({ sentenceId: s.id, natural: "해석", chunked: "직독 / 직해" })),
    questions: [
      {
        id: "q-order",
        ...assembleOrder(S, { explanation: "{P1}→{P2}→{P3}", evidenceSentenceIds: ["s2"], part1StartId: "s2", part2StartId: "s5", part3StartId: "s7" }, seededRng(1)),
      },
    ],
  };
}

const A = { id: "pa", label: "18번", result: resultFor(SAMPLE_PASSAGE) };
const B = { id: "pb", label: "19번", result: resultFor(SAMPLE_PASSAGE.replace("Many people", "Most people")) };

async function documentXml(input: Omit<DocxExportInput, "questionTypes" | "dateText">): Promise<string> {
  const buf = await Packer.toBuffer(buildDocx({ ...input, questionTypes: ["order"], dateText: "2026. 11. 17." }));
  expect(buf.subarray(0, 2).toString()).toBe("PK"); // .docx = zip
  const zip = await JSZip.loadAsync(buf);
  return zip.file("word/document.xml")!.async("string");
}

const sectionCount = (xml: string) => (xml.match(/<w:sectPr/g) ?? []).length;
const positions = (xml: string, words: string[]) => words.map((w) => xml.indexOf(w));

describe("buildDocx (지문 1개)", () => {
  it("고른 섹션마다 구역(새 페이지)이 하나씩 생긴다", async () => {
    const xml = await documentXml({ passages: [A], keys: ["cover", "translation", "questions", "answers"] });
    expect(sectionCount(xml)).toBe(4);
    expect(xml).toContain("수능 영어 지문 분석 자료");
    expect(xml).toContain("정답 및 해설");
    expect(xml).not.toContain("단어목록");
    expect(xml).not.toContain("18번"); // 지문이 하나면 지문 이름을 붙이지 않는다
  });

  it("생성되지 않은 섹션은 안내 문구로 채운다", async () => {
    const xml = await documentXml({ passages: [A], keys: ["vocabulary"] });
    expect(xml).toContain("생성되지 않았습니다");
  });
});

describe("buildDocx (지문 여러 개)", () => {
  it("지문마다 고른 섹션이 차례로 들어간다", async () => {
    const xml = await documentXml({ passages: [A, B], keys: ["translation", "questions", "answers"] });
    expect(sectionCount(xml)).toBe(6);
    const [a1, a2, a3, b1, b2, b3] = positions(xml, [
      "18번 문장별 해석",
      "18번 수능 유형별 문제",
      "18번 정답 및 해설",
      "19번 문장별 해석",
      "19번 수능 유형별 문제",
      "19번 정답 및 해설",
    ]);
    expect([a1, a2, a3, b1, b2, b3].every((x) => x >= 0)).toBe(true);
    expect(a1 < a2 && a2 < a3 && a3 < b1 && b1 < b2 && b2 < b3).toBe(true);
  });

  it("정답지 모으기: 문제는 지문별로, 정답지는 맨 뒤에", async () => {
    const xml = await documentXml({ passages: [A, B], keys: ["questions", "answers"], answersAtEnd: true });
    expect(sectionCount(xml)).toBe(4);
    const [aq, bq, aa, ba] = positions(xml, ["18번 수능 유형별 문제", "19번 수능 유형별 문제", "18번 정답 및 해설", "19번 정답 및 해설"]);
    expect(aq < bq && bq < aa && aa < ba).toBe(true);
  });
});
