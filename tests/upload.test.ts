import { describe, expect, it } from "vitest";
import { classifyFile, cleanExtractedText, hasBlank } from "../lib/upload";

describe("classifyFile", () => {
  it("MIME 타입과 확장자로 판별", () => {
    expect(classifyFile("a.jpg", "image/jpeg")).toBe("image");
    expect(classifyFile("IMG_0001.HEIC", "")).toBe("image");
    expect(classifyFile("exam.pdf", "application/pdf")).toBe("pdf");
    expect(classifyFile("exam.PDF", "")).toBe("pdf");
    expect(classifyFile("p.txt", "text/plain")).toBe("text");
    expect(classifyFile("doc.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document")).toBe(null);
  });
});

describe("cleanExtractedText", () => {
  it("줄바꿈 하이픈 잇기와 공백 정리", () => {
    expect(cleanExtractedText("This experi-\nment was\nsuccessful .")).toBe("This experiment was successful.");
  });
  it("밑줄 번호와 삽입 자리 표시 제거", () => {
    expect(cleanExtractedText("He ①decides it. ( ② ) Then ③ she left.")).toBe("He decides it. Then she left.");
  });
  it("복합어 하이픈은 줄바꿈이 아니면 유지", () => {
    expect(cleanExtractedText("a well-known fact")).toBe("a well-known fact");
  });
});

describe("hasBlank", () => {
  it("빈칸 감지", () => {
    expect(hasBlank("It is _____ to learn.")).toBe(true);
    expect(hasBlank("No blank here.")).toBe(false);
  });
});
