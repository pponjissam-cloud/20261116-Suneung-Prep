import { describe, expect, it } from "vitest";
import { Packer } from "docx";
import { assembleOrder } from "../lib/assemble";
import { buildDocx } from "../lib/docx-export";
import { seededRng } from "../lib/shuffle";
import { splitSentences } from "../lib/split-sentences";
import { SAMPLE_PASSAGE } from "../lib/sample";
import type { AnalysisResult } from "../lib/types";

const S = splitSentences(SAMPLE_PASSAGE);
const result: AnalysisResult = {
  sentences: S,
  translations: S.map((s) => ({ sentenceId: s.id, natural: "해석", chunked: "직독 / 직해" })),
  questions: [
    {
      id: "q-order",
      ...assembleOrder(S, { explanation: "{P1}→{P2}→{P3}", evidenceSentenceIds: ["s2"], part1StartId: "s2", part2StartId: "s5", part3StartId: "s7" }, seededRng(1)),
    },
  ],
};

async function documentXml(keys: Parameters<typeof buildDocx>[0]["keys"]): Promise<string> {
  const buf = await Packer.toBuffer(buildDocx({ result, questionTypes: ["order"], dateText: "2026. 11. 16.", keys }));
  // .docx 는 zip. document.xml 은 압축되어 있으므로 Packer.toString 대신 섹션 수만 세기 위해 다시 만든다
  expect(buf.subarray(0, 2).toString()).toBe("PK");
  const { default: JSZip } = await import("jszip");
  const zip = await JSZip.loadAsync(buf);
  return zip.file("word/document.xml")!.async("string");
}

describe("buildDocx", () => {
  it("고른 섹션마다 구역(새 페이지)이 하나씩 생긴다", async () => {
    const xml = await documentXml(["cover", "translation", "questions", "answers"]);
    expect((xml.match(/<w:sectPr/g) ?? []).length).toBe(4);
    expect(xml).toContain("수능 영어 지문 분석 자료");
    expect(xml).toContain("정답 및 해설");
    expect(xml).not.toContain("단어목록");
  });

  it("생성되지 않은 섹션은 안내 문구로 채운다", async () => {
    const xml = await documentXml(["vocabulary"]);
    expect(xml).toContain("생성되지 않았습니다");
  });
});
