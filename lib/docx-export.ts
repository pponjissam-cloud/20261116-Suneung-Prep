/**
 * 분석 결과 → Word(.docx) 문서.
 * 고른 섹션마다 Word "구역"을 하나씩 만들어 각 섹션이 새 페이지에서 시작한다.
 * 브라우저·Node 모두에서 동작 (런타임 의존성: docx)
 */
import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
  HeadingLevel,
  PageNumber,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  UnderlineType,
  WidthType,
  type IParagraphOptions,
  type IRunOptions,
  type ISectionOptions,
  type ParagraphChild,
} from "docx";
import { PRINT_SECTIONS, orderedPrintItems, type PrintKey } from "./print-sections";
import { CIRCLED, QUESTION_TYPE_INFO } from "./question-types";
import type { AnalysisResult, Block, QuestionType, Segment, Sentence, StructureRole } from "./types";

/** 지문 하나를 그릴 때 쓰는 정보 */
type DocxInput = {
  result: AnalysisResult;
  questionTypes: QuestionType[];
  dateText: string;
  keys: PrintKey[];
  /** 지문이 여러 개일 때만 (예: "18번") */
  passageLabel?: string;
};

export type DocxPassage = { id: string; label: string; result: AnalysisResult };

export type DocxExportInput = {
  passages: DocxPassage[];
  questionTypes: QuestionType[];
  dateText: string;
  keys: PrintKey[];
  /** 정답지를 지문마다 넣지 않고 맨 뒤에 모은다 */
  answersAtEnd?: boolean;
};

// ───────── 서식 상수 ─────────
const KO_FONT = "맑은 고딕";
const EN_FONT = "Times New Roman";
const MUTED = "59636E";
const ACCENT = "1F4E8C";
const A4 = { width: 11906, height: 16838 }; // twip
const MARGIN = 850; // 약 15mm

const ROLE_STYLE: Record<StructureRole, { color: string; underline?: (typeof UnderlineType)[keyof typeof UnderlineType]; bold?: boolean; italics?: boolean }> = {
  S: { color: "1D4ED8", underline: UnderlineType.SINGLE },
  V: { color: "B91C1C", underline: UnderlineType.DOUBLE, bold: true },
  O: { color: "047857", underline: UnderlineType.DASH },
  IO: { color: "047857", underline: UnderlineType.DASH },
  DO: { color: "047857", underline: UnderlineType.DASH },
  C: { color: "7C3AED", underline: UnderlineType.DOTTED },
  OC: { color: "7C3AED", underline: UnderlineType.DOTTED },
  M: { color: "6B7280", underline: UnderlineType.WAVE },
  CONJ: { color: "B45309", italics: true },
};
const ROLE_LABEL: Record<StructureRole, string> = {
  S: "주어", V: "동사", O: "목적어", IO: "간접목적어", DO: "직접목적어", C: "주격보어", OC: "목적격보어", M: "수식어", CONJ: "접속사",
};

// ───────── 작은 도우미 ─────────
type RunOpts = Omit<IRunOptions, "text" | "children">;
const en = (text: string, opts: RunOpts = {}) => new TextRun({ text, font: EN_FONT, size: 23, ...opts });
const ko = (text: string, opts: RunOpts = {}) => new TextRun({ text, font: KO_FONT, ...opts });

const p = (children: ParagraphChild[], opts: Omit<IParagraphOptions, "children"> = {}) =>
  new Paragraph({ children, spacing: { after: 120, line: 320 }, ...opts });

const heading = (text: string) =>
  new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { after: 240 }, children: [ko(text, { bold: true, size: 30, color: "1F2328" })] });

const subheading = (text: string) =>
  new Paragraph({ keepNext: true, spacing: { before: 240, after: 100 }, children: [ko(text, { bold: true, size: 23 })] });

const boxBorder = {
  top: { style: BorderStyle.SINGLE, size: 6, color: "1F2328", space: 6 },
  bottom: { style: BorderStyle.SINGLE, size: 6, color: "1F2328", space: 6 },
  left: { style: BorderStyle.SINGLE, size: 6, color: "1F2328", space: 6 },
  right: { style: BorderStyle.SINGLE, size: 6, color: "1F2328", space: 6 },
};

const cell = (children: Paragraph[], width: number, header = false) =>
  new TableCell({
    children,
    width: { size: width, type: WidthType.PERCENTAGE },
    shading: header ? { type: ShadingType.CLEAR, fill: "EEF1F4", color: "auto" } : undefined,
    margins: { top: 60, bottom: 60, left: 100, right: 100 },
  });

const noBorders = {
  top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
  bottom: { style: BorderStyle.SINGLE, size: 4, color: "D8DEE4" },
  left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
  right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
  insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: "D8DEE4" },
  insideVertical: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
};

/** text 안에서 [start,end) 구간만 서식을 달리한 run 들 */
function runsWithSpan(text: string, start: number, end: number, spanOpts: RunOpts): TextRun[] {
  return [en(text.slice(0, start)), en(text.slice(start, end), spanOpts), en(text.slice(end))];
}

// ───────── 섹션별 내용 ─────────
function cover(input: DocxInput): Paragraph[] {
  const s = input.result.sentences;
  const contents = PRINT_SECTIONS.filter((x) => x.key !== "cover" && input.keys.includes(x.key)).map((x) => x.label);
  return [
    new Paragraph({
      spacing: { after: 80 },
      children: [
        ko("수능 영어 지문 분석 자료", { bold: true, size: 40 }),
        ...(input.passageLabel ? [ko(`  · ${input.passageLabel}`, { bold: true, size: 40, color: ACCENT })] : []),
      ],
    }),
    p([ko(`${input.dateText} · ${s.length}문장`, { color: MUTED })], {
      border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: "1F2328", space: 4 } },
    }),
    subheading("목차"),
    ...contents.map((c) => p([ko(c)], { spacing: { after: 40 } })),
    subheading("문제 유형"),
    p([ko(input.questionTypes.map((t) => QUESTION_TYPE_INFO[t].label).join(" · "))]),
    subheading("원문"),
    new Paragraph({
      border: boxBorder,
      spacing: { line: 380 },
      children: s.flatMap((x, i) => [en(String(i + 1), { superScript: true, bold: true, color: ACCENT, font: KO_FONT }), en(x.text + " ")]),
    }),
    p([ko("")]),
    p([ko("학년/반: ______________    이름: ______________    점수: ________")], { spacing: { before: 400 } }),
  ];
}

function vocabulary(input: DocxInput): (Paragraph | Table)[] {
  const items = input.result.vocabulary;
  if (!items?.length) return [p([ko("생성되지 않았습니다.", { color: MUTED })])];
  const byId = new Map(input.result.sentences.map((s) => [s.id, s.text]));
  const header = new TableRow({
    tableHeader: true,
    children: [
      cell([p([ko("#", { bold: true })])], 6, true),
      cell([p([ko("단어", { bold: true })])], 24, true),
      cell([p([ko("뜻 · 지문 예문", { bold: true })])], 48, true),
      cell([p([ko("유의어 / 반의어", { bold: true })])], 22, true),
    ],
  });
  const rows = items.map((v, i) => {
    const sentence = byId.get(v.sentenceId) ?? "";
    const idx = sentence.toLowerCase().indexOf(v.word.toLowerCase());
    const example = idx >= 0 ? runsWithSpan(sentence, idx, idx + v.word.length, { bold: true }) : [en(sentence)];
    return new TableRow({
      cantSplit: true,
      children: [
        cell([p([ko(String(i + 1), { color: MUTED })])], 6),
        cell([p([en(v.lemma, { bold: true })], { spacing: { after: 0 } }), p([ko(`${v.pos} ${v.ipa ?? ""}`, { size: 17, color: MUTED })])], 24),
        cell([p([ko(v.meaningKo)], { spacing: { after: 40 } }), p(example.map((r) => r), { spacing: { after: 0 } })], 48),
        cell(
          [
            ...(v.synonyms.length ? [p([ko("≒ ", { size: 18 }), en(v.synonyms.join(", "), { size: 19 })], { spacing: { after: 0 } })] : []),
            ...(v.antonyms.length ? [p([ko("↔ ", { size: 18 }), en(v.antonyms.join(", "), { size: 19 })], { spacing: { after: 0 } })] : []),
            ...(!v.synonyms.length && !v.antonyms.length ? [p([ko("")])] : []),
          ],
          22,
        ),
      ],
    });
  });
  return [new Table({ rows: [header, ...rows], width: { size: 100, type: WidthType.PERCENTAGE }, borders: noBorders })];
}

function translation(input: DocxInput): Paragraph[] {
  const t = input.result.translations;
  if (!t?.length) return [p([ko("생성되지 않았습니다.", { color: MUTED })])];
  const byId = new Map(t.map((x) => [x.sentenceId, x]));
  return input.result.sentences.flatMap((s, i) => {
    const tr = byId.get(s.id);
    return [
      p([ko(`${i + 1}  `, { bold: true, color: ACCENT }), en(s.text)], { keepNext: true, spacing: { before: 200, after: 60 } }),
      ...(tr
        ? [
            p([ko(tr.natural)], { indent: { left: 360 }, keepNext: true, spacing: { after: 40 } }),
            p([ko("[직독직해] ", { size: 17, color: MUTED, bold: true }), ko(tr.chunked, { size: 19, color: MUTED })], { indent: { left: 360 } }),
          ]
        : []),
    ];
  });
}

function grammar(input: DocxInput): Paragraph[] {
  const points = input.result.grammar;
  if (!points?.length) return [p([ko("생성되지 않았습니다.", { color: MUTED })])];
  const index = new Map(input.result.sentences.map((s, i) => [s.id, i]));
  const sorted = [...points].sort((a, b) => (index.get(a.sentenceId) ?? 0) - (index.get(b.sentenceId) ?? 0) || a.start - b.start);
  return sorted.flatMap((g, i) => {
    const si = index.get(g.sentenceId) ?? 0;
    const text = input.result.sentences[si]?.text ?? "";
    return [
      subheading(`${i + 1}. ${g.title}   (문장 ${si + 1})`),
      p(runsWithSpan(text, g.start, g.end, { bold: true, underline: { type: UnderlineType.SINGLE }, highlight: "yellow" }), { keepNext: true }),
      p([ko(g.explanation)], { keepNext: true }),
      p([ko("예문  ", { bold: true, size: 18, color: MUTED }), en(g.example.en, { size: 21 }), ko(`  ${g.example.ko}`, { size: 19, color: MUTED })], {
        shading: { type: ShadingType.CLEAR, fill: "F6F7F9", color: "auto" },
      }),
    ];
  });
}

function structure(input: DocxInput): Paragraph[] {
  const st = input.result.structures;
  if (!st?.length) return [p([ko("생성되지 않았습니다.", { color: MUTED })])];
  const byId = new Map(st.map((x) => [x.sentenceId, x]));
  const legend = p(
    (["S", "V", "O", "C", "OC", "M", "CONJ"] as const).flatMap((r) => [
      new TextRun({ text: r, font: KO_FONT, size: 18, bold: true, color: ROLE_STYLE[r].color, underline: ROLE_STYLE[r].underline ? { type: ROLE_STYLE[r].underline } : undefined }),
      ko(` ${ROLE_LABEL[r]}   `, { size: 18 }),
    ]).concat([ko("[ ] 절", { size: 18 })]),
    { shading: { type: ShadingType.CLEAR, fill: "F6F7F9", color: "auto" }, spacing: { after: 200 } },
  );

  const body = input.result.sentences.flatMap((s, i) => {
    const x = byId.get(s.id);
    const head = p([ko(`${i + 1}  `, { bold: true, color: ACCENT }), ...(x ? [ko(`${x.pattern}형식`, { size: 17, color: MUTED })] : [])], {
      keepNext: true,
      spacing: { before: 200, after: 40 },
    });
    if (!x) return [head, p([en(s.text, { color: MUTED }), ko("  (분석 없음)", { size: 17, color: MUTED })])];

    const runs: TextRun[] = [];
    let cursor = 0;
    for (const t of x.tokens) {
      if (t.start > cursor) runs.push(en(s.text.slice(cursor, t.start)));
      const r = ROLE_STYLE[t.role];
      if (t.clause) runs.push(en("[", { color: MUTED }));
      runs.push(en(t.text, { color: r.color, bold: r.bold, italics: r.italics, underline: r.underline ? { type: r.underline, color: r.color } : undefined }));
      if (t.clause) runs.push(en("]", { color: MUTED }));
      runs.push(new TextRun({ text: t.role + (t.clause ? `·${t.clause}` : ""), font: KO_FONT, size: 14, bold: true, color: r.color, superScript: true }));
      cursor = t.end;
    }
    if (cursor < s.text.length) runs.push(en(s.text.slice(cursor)));
    return [head, p(runs, { spacing: { line: 420, after: 60 } }), ...(x.note ? [p([ko(`※ ${x.note}`, { size: 19, color: MUTED })])] : [])];
  });
  return [legend, ...body];
}

function segmentRuns(seg: Segment): TextRun[] {
  const marker = seg.marker ? [ko(seg.marker, { bold: true })] : [];
  if (seg.style === "blank") return [...marker, en("                    ", { underline: { type: UnderlineType.SINGLE } })];
  if (seg.style === "underline") return [...marker, en(seg.text, { underline: { type: UnderlineType.SINGLE } })];
  if (seg.style === "bold") return [...marker, en(seg.text, { bold: true })];
  return seg.marker ? [ko(" "), ...marker, ko(" "), en(seg.text)] : [en(seg.text)];
}

function blockParagraph(b: Block): Paragraph {
  const label = b.label ? [ko(`${b.label}  `, { bold: true })] : [];
  return new Paragraph({
    children: [...label, ...b.segments.flatMap(segmentRuns)],
    border: b.boxed ? boxBorder : undefined,
    spacing: { before: 80, after: 120, line: 360 },
    keepNext: true,
  });
}

function questions(input: DocxInput): Paragraph[] {
  const byType = new Map(input.result.questions.map((q) => [q.type, q]));
  const out: Paragraph[] = [];
  input.questionTypes.forEach((t, i) => {
    const q = byType.get(t);
    if (!q) return;
    out.push(
      new Paragraph({ keepNext: true, spacing: { before: i === 0 ? 0 : 360, after: 120 }, children: [ko(`${i + 1}. ${q.stem}`, { bold: true })] }),
      ...q.display.map(blockParagraph),
    );
    const numberOnly = q.choices.every((c, k) => c === CIRCLED[k]);
    if (numberOnly) out.push(p([ko(CIRCLED.join("        "))]));
    else
      q.choices.forEach((c, k) =>
        out.push(p([ko(`${CIRCLED[k]} `), /[가-힣]/.test(c) ? ko(c) : en(c)], { spacing: { after: 40 }, keepNext: k < 4, indent: { left: 200 } })),
      );
  });
  return out.length ? out : [p([ko("생성된 문제가 없습니다.", { color: MUTED })])];
}

const readable = (text: string) => text.replace(/\[s(\d+)\]/g, "(문장 $1)");

function answers(input: DocxInput): Paragraph[] {
  const byType = new Map(input.result.questions.map((q) => [q.type, q]));
  const list = input.questionTypes.map((t, i) => ({ n: i + 1, q: byType.get(t) })).filter((x) => x.q);
  if (!list.length) return [p([ko("생성된 문제가 없습니다.", { color: MUTED })])];

  const summary = p(
    list.flatMap(({ n, q }) => [ko(`${n}. `), ko(CIRCLED[q!.answerIndex], { bold: true }), ko("     ")]),
    { shading: { type: ShadingType.CLEAR, fill: "F6F7F9", color: "auto" }, spacing: { after: 240 } },
  );
  const detail = list.flatMap(({ n, q }) => {
    const qq = q!;
    const answerText = qq.choices[qq.answerIndex] !== CIRCLED[qq.answerIndex] ? `  ${qq.choices[qq.answerIndex]}` : "";
    return [
      subheading(`${n}. [${QUESTION_TYPE_INFO[qq.type].label}] 정답 ${CIRCLED[qq.answerIndex]}${answerText}`),
      p([ko(readable(qq.explanation))]),
      ...qq.choiceNotes
        .map((note, k) => (note && k !== qq.answerIndex ? p([ko(`${CIRCLED[k]} ${readable(note)}`, { size: 19, color: MUTED })], { spacing: { after: 40 } }) : null))
        .filter((x): x is Paragraph => x !== null),
    ];
  });
  return [summary, ...detail];
}

const BUILDERS: Record<PrintKey, (i: DocxInput) => (Paragraph | Table)[]> = {
  cover,
  vocabulary,
  translation,
  grammar,
  structure,
  questions,
  answers,
};

const TITLES: Record<Exclude<PrintKey, "cover">, string> = {
  vocabulary: "단어목록",
  translation: "문장별 해석",
  grammar: "중요 문법·구문",
  structure: "문장구조분석",
  questions: "수능 유형별 문제",
  answers: "정답 및 해설",
};

/**
 * Word 문서를 만든다.
 * 지문1의 고른 섹션들 → 지문2의 고른 섹션들 → … 순서이고, 섹션마다 Word 구역(새 페이지)이 하나씩 생긴다.
 * answersAtEnd 이면 정답지만 맨 뒤에 지문 순서대로 모은다.
 */
export function buildDocx(input: DocxExportInput): Document {
  const multi = input.passages.length > 1;
  const byId = new Map(input.passages.map((p) => [p.id, p]));
  const items = orderedPrintItems(
    input.passages.map((p) => p.id),
    { keys: input.keys, passageIds: input.passages.map((p) => p.id), answersAtEnd: Boolean(input.answersAtEnd && multi) },
  );

  const footer = new Footer({
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ children: [PageNumber.CURRENT, " / ", PageNumber.TOTAL_PAGES], size: 18, color: MUTED })],
      }),
    ],
  });

  const sections: ISectionOptions[] = items.map(({ passageId, key }) => {
    const passage = byId.get(passageId)!;
    const ctx: DocxInput = {
      result: passage.result,
      questionTypes: input.questionTypes,
      dateText: input.dateText,
      keys: input.keys,
      passageLabel: multi ? passage.label : undefined,
    };
    const sectionLabel = PRINT_SECTIONS.find((s) => s.key === key)!.label;
    const headerText = `수능 영어 지문 분석 · ${multi ? `${passage.label} · ` : ""}${sectionLabel}`;
    const title = multi && key !== "cover" ? `${passage.label} ${TITLES[key]}` : key === "cover" ? "" : TITLES[key];
    return {
      properties: { page: { size: A4, margin: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN } } },
      // Word 는 머리글을 비워 두면 앞 구역 것을 물려받으므로 표지에는 빈 머리글을 명시한다
      headers:
        key === "cover"
          ? { default: new Header({ children: [new Paragraph({ children: [] })] }) }
          : {
              default: new Header({
                children: [
                  new Paragraph({
                    border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: "D8DEE4", space: 2 } },
                    children: [ko(headerText, { size: 16, color: MUTED }), ko(`    ${input.dateText}`, { size: 16, color: MUTED })],
                  }),
                ],
              }),
            },
      footers: { default: footer },
      children: key === "cover" ? BUILDERS.cover(ctx) : [heading(title), ...BUILDERS[key](ctx)],
    };
  });

  return new Document({
    creator: "수능 지문 분석기",
    title: "수능 영어 지문 분석 자료",
    styles: {
      default: {
        document: { run: { font: { ascii: EN_FONT, hAnsi: EN_FONT, eastAsia: KO_FONT, cs: KO_FONT }, size: 21, color: "1F2328" } },
      },
    },
    sections,
  });
}
