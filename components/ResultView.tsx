"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { callAnalyze, runPool } from "@/lib/client-api";
import { getHistory, loadJob, saveHistory, type JobRequest } from "@/lib/history";
import { splitSentences } from "@/lib/split-sentences";
import type { AnalysisResult, Question, QuestionType, SectionKey } from "@/lib/types";
import PrintDialog, { PRINT_SECTIONS, type PrintKey } from "./PrintDialog";
import AnswerSection from "./sections/AnswerSection";
import CoverSection from "./sections/CoverSection";
import GrammarSection from "./sections/GrammarSection";
import QuestionsSection from "./sections/QuestionsSection";
import StructureSection from "./sections/StructureSection";
import TranslationSection from "./sections/TranslationSection";
import VocabSection from "./sections/VocabSection";
import SectionShell, { type TaskStatus } from "./SectionShell";

type TaskKey = SectionKey | `q:${QuestionType}`;
type TabKey = SectionKey | "questions" | "answers";

const SECTION_KEYS: SectionKey[] = ["vocabulary", "translation", "grammar", "structure"];
const TABS: { key: TabKey; label: string }[] = [
  { key: "vocabulary", label: "① 단어목록" },
  { key: "translation", label: "② 문장별 해석" },
  { key: "grammar", label: "③ 중요 문법·구문" },
  { key: "structure", label: "④ 문장구조분석" },
  { key: "questions", label: "⑤ 유형별 문제" },
  { key: "answers", label: "⑥ 정답지" },
];

const RESULT_FIELD = {
  vocabulary: "vocabulary",
  translation: "translations",
  grammar: "grammar",
  structure: "structures",
} as const satisfies Record<SectionKey, keyof AnalysisResult>;

export default function ResultView() {
  const id = useSearchParams().get("id") ?? "";
  const [request, setRequest] = useState<JobRequest | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [statuses, setStatuses] = useState<Partial<Record<TaskKey, TaskStatus>>>({});
  const [tab, setTab] = useState<TabKey>("vocabulary");
  const [notFound, setNotFound] = useState(false);
  const [printOpen, setPrintOpen] = useState(false);
  const [printKeys, setPrintKeys] = useState<PrintKey[]>(PRINT_SECTIONS.map((p) => p.key));
  const started = useRef(false);
  const createdAt = useRef<string | undefined>(undefined);

  const setStatus = (key: TaskKey, s: TaskStatus) => setStatuses((prev) => ({ ...prev, [key]: s }));

  const runTask = useCallback(async (req: JobRequest, key: TaskKey) => {
    setStatus(key, { state: "loading" });
    const body = { passage: req.passage, difficulty: req.difficulty };

    if (key.startsWith("q:")) {
      const type = key.slice(2) as QuestionType;
      const res = await callAnalyze<Omit<Question, "id">>("question", { ...body, questionType: type });
      if (!res.ok) return setStatus(key, { state: "error", error: res.error, retryable: res.retryable });
      const q: Question = { ...res.data, id: `q-${type}` };
      setResult((prev) => {
        if (!prev) return prev;
        const others = prev.questions.filter((x) => x.type !== type);
        const order = (t: QuestionType) => req.questionTypes.indexOf(t);
        return { ...prev, questions: [...others, q].sort((a, b) => order(a.type) - order(b.type)) };
      });
    } else {
      const section = key as SectionKey;
      const res = await callAnalyze<unknown>(section, body);
      if (!res.ok) return setStatus(key, { state: "error", error: res.error, retryable: res.retryable });
      setResult((prev) => (prev ? { ...prev, [RESULT_FIELD[section]]: res.data } : prev));
    }
    setStatus(key, { state: "success" });
  }, []);

  // 최초 진입: 기록이 있으면 불러오고, 없으면 생성 시작
  useEffect(() => {
    if (started.current || !id) return;
    started.current = true;

    const saved = getHistory(id);
    if (saved) {
      createdAt.current = saved.createdAt;
      setRequest(saved.request);
      setResult(saved.result);
      return;
    }
    const job = loadJob(id);
    if (!job) {
      setNotFound(true);
      return;
    }
    setRequest(job);
    setResult({ sentences: splitSentences(job.passage), questions: [] });
    const keys: TaskKey[] = [...SECTION_KEYS, ...job.questionTypes.map((t) => `q:${t}` as const)];
    void runPool(keys.map((k) => () => runTask(job, k)), 4);
  }, [id, runTask]);

  // 진행 중인 작업이 없으면 기록에 저장
  const busy = Object.values(statuses).some((s) => s?.state === "loading");
  const anyRan = Object.keys(statuses).length > 0;
  useEffect(() => {
    if (!busy && anyRan && request && result) saveHistory({ id, request, result, createdAt: createdAt.current });
  }, [busy, anyRan, id, request, result]);

  const dateText = new Date(createdAt.current ?? Date.now()).toLocaleDateString("ko-KR");

  /** 고른 섹션만 남기고 인쇄 창을 연다. 파일 이름이 되는 문서 제목도 잠시 바꾼다 */
  const doPrint = (keys: PrintKey[], label: string) => {
    setPrintKeys(keys);
    setPrintOpen(false);
    window.setTimeout(() => {
      const prevTitle = document.title;
      const ymd = new Date(createdAt.current ?? Date.now()).toLocaleDateString("sv-SE");
      document.title = `수능지문분석_${ymd}_${label.replace(/[^0-9A-Za-z가-힣+]+/g, "")}`;
      const reset = () => {
        document.title = prevTitle;
        window.removeEventListener("afterprint", reset);
      };
      window.addEventListener("afterprint", reset);
      window.print();
    }, 100);
  };

  /** 고른 섹션을 Word 파일로 내려받는다. docx 라이브러리는 이때만 불러온다 */
  const doWord = async (keys: PrintKey[], label: string) => {
    if (!request || !result) return;
    const [{ Packer }, { buildDocx }] = await Promise.all([import("docx"), import("@/lib/docx-export")]);
    const doc = buildDocx({ result, questionTypes: request.questionTypes, dateText, keys });
    const blob = await Packer.toBlob(doc);
    const ymd = new Date(createdAt.current ?? Date.now()).toLocaleDateString("sv-SE");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `수능지문분석_${ymd}_${label.replace(/[^0-9A-Za-z가-힣+]+/g, "")}.docx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
  };

  if (!id || notFound)
    return (
      <main className="p-10 text-center">
        <p>요청 정보를 찾을 수 없습니다. 새 탭에서 열었거나 기록이 삭제되었을 수 있습니다.</p>
        <Link href="/" className="mt-4 inline-block text-[var(--accent)] underline">
          처음으로
        </Link>
      </main>
    );
  if (!request || !result) return <p className="p-10 text-center">불러오는 중…</p>;

  const s = result.sentences;
  const retry = (key: TaskKey) => () => void runTask(request, key);
  const total = SECTION_KEYS.length + request.questionTypes.length;
  const done = Object.values(statuses).filter((x) => x && x.state !== "loading").length;

  const firstPrinted = PRINT_SECTIONS.find((p) => printKeys.includes(p.key))?.key;
  const labelOf = (key: PrintKey) => PRINT_SECTIONS.find((p) => p.key === key)?.label ?? "";

  /** 섹션 하나 = 인쇄 시 새 페이지 하나에서 시작 */
  const panel = (key: PrintKey, children: React.ReactNode) => {
    const included = printKeys.includes(key);
    const onScreen = key !== "cover" && tab === key;
    return (
      <div
        className={["print-panel", onScreen ? "" : "hidden", included ? "" : "print-exclude", included && key !== firstPrinted ? "page-start" : ""].join(" ")}
      >
        {key !== "cover" && (
          <div className="mb-3 hidden justify-between border-b border-[var(--line)] pb-1 text-[0.7rem] text-[var(--muted)] print:flex">
            <span>수능 영어 지문 분석 · {labelOf(key)}</span>
            <span>{dateText}</span>
          </div>
        )}
        {children}
      </div>
    );
  };

  const currentTabLabel = TABS.find((t) => t.key === tab)?.label ?? "";

  return (
    <main className="mx-auto max-w-4xl px-4 py-6 print:max-w-none print:p-0">
      <header className="no-print flex flex-wrap items-center justify-between gap-3">
        <Link href="/" className="text-sm text-[var(--accent)] underline">
          ← 새 지문
        </Link>
        <div className="flex gap-2 text-sm">
          <button
            type="button"
            onClick={() => doPrint([tab], currentTabLabel)}
            className="rounded-lg border border-[var(--line)] bg-white px-3 py-1.5"
          >
            이 탭만 인쇄
          </button>
          <button type="button" onClick={() => setPrintOpen(true)} className="rounded-lg bg-[var(--accent)] px-3 py-1.5 font-semibold text-white">
            🖨️ 인쇄 · PDF · Word
          </button>
        </div>
      </header>

      <PrintDialog open={printOpen} onClose={() => setPrintOpen(false)} onPrint={doPrint} onWord={doWord} />

      {busy && (
        <div className="no-print mt-4 rounded-lg bg-blue-50 px-4 py-2 text-sm">
          생성 중… {done}/{total} 완료. 완료된 섹션부터 볼 수 있습니다. 인쇄는 생성이 끝난 뒤에 하세요.
        </div>
      )}

      <nav className="no-print mt-4 flex flex-wrap gap-1 border-b border-[var(--line)]">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`-mb-px rounded-t-lg border px-3 py-2 text-sm ${
              tab === t.key ? "border-[var(--line)] border-b-white bg-white font-semibold" : "border-transparent text-[var(--muted)]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <div className="rounded-b-xl border border-t-0 border-[var(--line)] bg-white p-5 print:rounded-none print:border-0 print:p-0">
        {panel(
          "cover",
          <CoverSection
            sentences={s}
            questionTypes={request.questionTypes}
            dateText={dateText}
            contents={PRINT_SECTIONS.filter((p) => p.key !== "cover" && printKeys.includes(p.key)).map((p) => p.label)}
          />,
        )}
        {panel(
          "vocabulary",
          <SectionShell title="단어목록" status={statuses.vocabulary} onRetry={retry("vocabulary")}>
            {result.vocabulary && <VocabSection items={result.vocabulary} sentences={s} />}
          </SectionShell>,
        )}
        {panel(
          "translation",
          <SectionShell title="문장별 해석" status={statuses.translation} onRetry={retry("translation")}>
            {result.translations && <TranslationSection sentences={s} translations={result.translations} />}
          </SectionShell>,
        )}
        {panel(
          "grammar",
          <SectionShell title="중요 문법·구문" status={statuses.grammar} onRetry={retry("grammar")}>
            {result.grammar && <GrammarSection sentences={s} points={result.grammar} />}
          </SectionShell>,
        )}
        {panel(
          "structure",
          <SectionShell title="문장구조분석" status={statuses.structure} onRetry={retry("structure")}>
            {result.structures && <StructureSection sentences={s} structures={result.structures} />}
          </SectionShell>,
        )}
        {panel(
          "questions",
          <QuestionsSection
            types={request.questionTypes}
            questions={result.questions}
            statusOf={(t) => statuses[`q:${t}`]}
            onRetry={(t) => retry(`q:${t}`)()}
          />,
        )}
        {panel("answers", <AnswerSection types={request.questionTypes} questions={result.questions} />)}
      </div>
    </main>
  );
}
