"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { callAnalyze, runPool } from "@/lib/client-api";
import { getHistory, loadJob, saveHistory, type JobRequest } from "@/lib/history";
import type { PassageInput } from "@/lib/passages";
import { orderedPrintItems, type ExportOptions } from "@/lib/print-sections";
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
type TabKey = Exclude<PrintKey, "cover">;

const SECTION_KEYS: SectionKey[] = ["vocabulary", "translation", "grammar", "structure"];
const TABS = PRINT_SECTIONS.filter((p): p is { key: TabKey; label: string } => p.key !== "cover");

const RESULT_FIELD = {
  vocabulary: "vocabulary",
  translation: "translations",
  grammar: "grammar",
  structure: "structures",
} as const satisfies Record<SectionKey, keyof AnalysisResult>;

/** 상태 맵 키: 지문 ID + 작업 */
const sk = (pid: string, key: TaskKey) => `${pid}::${key}`;

export default function ResultView() {
  const id = useSearchParams().get("id") ?? "";
  const [request, setRequest] = useState<JobRequest | null>(null);
  const [results, setResults] = useState<Record<string, AnalysisResult>>({});
  const [statuses, setStatuses] = useState<Record<string, TaskStatus>>({});
  const [active, setActive] = useState<string>("");
  const [tab, setTab] = useState<TabKey>("vocabulary");
  const [notFound, setNotFound] = useState(false);
  const [printOpen, setPrintOpen] = useState(false);
  const [exportOpts, setExportOpts] = useState<ExportOptions>({
    keys: PRINT_SECTIONS.map((p) => p.key),
    passageIds: [],
    answersAtEnd: false,
  });
  const started = useRef(false);
  const createdAt = useRef<string | undefined>(undefined);

  const setStatus = (pid: string, key: TaskKey, s: TaskStatus) => setStatuses((prev) => ({ ...prev, [sk(pid, key)]: s }));

  const runTask = useCallback(async (req: JobRequest, passage: PassageInput, key: TaskKey) => {
    const pid = passage.id;
    setStatus(pid, key, { state: "loading" });
    const body = { passage: passage.text, difficulty: req.difficulty };
    const patch = (fn: (r: AnalysisResult) => AnalysisResult) => setResults((prev) => (prev[pid] ? { ...prev, [pid]: fn(prev[pid]) } : prev));

    if (key.startsWith("q:")) {
      const type = key.slice(2) as QuestionType;
      const res = await callAnalyze<Omit<Question, "id">>("question", { ...body, questionType: type });
      if (!res.ok) return setStatus(pid, key, { state: "error", error: res.error, retryable: res.retryable });
      const q: Question = { ...res.data, id: `${pid}-q-${type}` };
      const order = (t: QuestionType) => req.questionTypes.indexOf(t);
      patch((r) => ({ ...r, questions: [...r.questions.filter((x) => x.type !== type), q].sort((a, b) => order(a.type) - order(b.type)) }));
    } else {
      const section = key as SectionKey;
      const res = await callAnalyze<unknown>(section, body);
      if (!res.ok) return setStatus(pid, key, { state: "error", error: res.error, retryable: res.retryable });
      patch((r) => ({ ...r, [RESULT_FIELD[section]]: res.data }));
    }
    setStatus(pid, key, { state: "success" });
  }, []);

  // 최초 진입: 기록이 있으면 불러오고, 없으면 생성 시작
  useEffect(() => {
    if (started.current || !id) return;
    started.current = true;

    const saved = getHistory(id);
    if (saved) {
      createdAt.current = saved.createdAt;
      setRequest(saved.request);
      setResults(saved.results);
      setActive(saved.request.passages[0]?.id ?? "");
      return;
    }
    const job = loadJob(id);
    if (!job || job.passages.length === 0) {
      setNotFound(true);
      return;
    }
    setRequest(job);
    setActive(job.passages[0].id);
    setResults(Object.fromEntries(job.passages.map((p) => [p.id, { sentences: splitSentences(p.text), questions: [] }])));
    // 지문 순서대로 실행 → 첫 지문 결과부터 볼 수 있다
    const keys: TaskKey[] = [...SECTION_KEYS, ...job.questionTypes.map((t) => `q:${t}` as const)];
    const tasks = job.passages.flatMap((p) => keys.map((k) => () => runTask(job, p, k)));
    void runPool(tasks, 4);
  }, [id, runTask]);

  // 진행 중인 작업이 없으면 기록에 저장
  const busy = Object.values(statuses).some((s) => s.state === "loading");
  const anyRan = Object.keys(statuses).length > 0;
  useEffect(() => {
    if (!busy && anyRan && request) saveHistory({ id, request, results, createdAt: createdAt.current });
  }, [busy, anyRan, id, request, results]);

  const dateText = new Date(createdAt.current ?? Date.now()).toLocaleDateString("ko-KR");
  const ymd = new Date(createdAt.current ?? Date.now()).toLocaleDateString("sv-SE");
  const fileBase = (label: string) => `수능지문분석_${ymd}_${label.replace(/[^0-9A-Za-z가-힣+]+/g, "")}`;

  /** 고른 지문·섹션만 남기고 인쇄 창을 연다. 파일 이름이 되는 문서 제목도 잠시 바꾼다 */
  const doPrint = (opts: ExportOptions, label: string) => {
    setExportOpts(opts);
    setPrintOpen(false);
    window.setTimeout(() => {
      const prevTitle = document.title;
      document.title = fileBase(label);
      const reset = () => {
        document.title = prevTitle;
        window.removeEventListener("afterprint", reset);
      };
      window.addEventListener("afterprint", reset);
      window.print();
    }, 100);
  };

  /** 고른 지문·섹션을 Word 파일로 내려받는다. docx 라이브러리는 이때만 불러온다 */
  const doWord = async (opts: ExportOptions, label: string) => {
    if (!request) return;
    const [{ Packer }, { buildDocx }] = await Promise.all([import("docx"), import("@/lib/docx-export")]);
    const passages = request.passages
      .filter((p) => opts.passageIds.includes(p.id) && results[p.id])
      .map((p) => ({ id: p.id, label: p.label, result: results[p.id] }));
    const doc = buildDocx({ passages, questionTypes: request.questionTypes, dateText, keys: opts.keys, answersAtEnd: opts.answersAtEnd });
    const blob = await Packer.toBlob(doc);
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${fileBase(label)}.docx`;
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
  if (!request || !results[active]) return <p className="p-10 text-center">불러오는 중…</p>;

  const passages = request.passages;
  const multi = passages.length > 1;
  const taskKeys: TaskKey[] = [...SECTION_KEYS, ...request.questionTypes.map((t) => `q:${t}` as const)];
  const progressOf = (pid: string) => {
    const st = taskKeys.map((k) => statuses[sk(pid, k)]).filter(Boolean);
    return {
      done: st.filter((s) => s.state !== "loading").length,
      loading: st.some((s) => s.state === "loading"),
      error: st.some((s) => s.state === "error"),
      started: st.length > 0,
    };
  };
  const total = passages.length * taskKeys.length;
  const done = Object.values(statuses).filter((s) => s.state !== "loading").length;

  // 인쇄 순서: 지문마다 고른 섹션을 차례로 (정답지 모으기면 정답지만 맨 뒤)
  // (인쇄 창을 거치지 않고 Ctrl+P 로 인쇄하면 모든 지문·섹션)
  const effective = exportOpts.passageIds.length ? exportOpts : { ...exportOpts, passageIds: passages.map((p) => p.id) };
  const printItems = orderedPrintItems(
    passages.map((p) => p.id),
    effective,
  );
  const printIndex = new Map(printItems.map((it, i) => [`${it.passageId}::${it.key}`, i]));

  const renderSection = (p: PassageInput, key: PrintKey) => {
    const r = results[p.id];
    const st = (k: TaskKey) => statuses[sk(p.id, k)];
    const retry = (k: TaskKey) => () => void runTask(request, p, k);
    switch (key) {
      case "cover":
        return (
          <CoverSection
            sentences={r.sentences}
            questionTypes={request.questionTypes}
            dateText={dateText}
            passageLabel={multi ? p.label : undefined}
            contents={PRINT_SECTIONS.filter((s) => s.key !== "cover" && exportOpts.keys.includes(s.key)).map((s) => s.label)}
          />
        );
      case "vocabulary":
        return (
          <SectionShell title="단어목록" status={st("vocabulary")} onRetry={retry("vocabulary")}>
            {r.vocabulary && <VocabSection items={r.vocabulary} sentences={r.sentences} />}
          </SectionShell>
        );
      case "translation":
        return (
          <SectionShell title="문장별 해석" status={st("translation")} onRetry={retry("translation")}>
            {r.translations && <TranslationSection sentences={r.sentences} translations={r.translations} />}
          </SectionShell>
        );
      case "grammar":
        return (
          <SectionShell title="중요 문법·구문" status={st("grammar")} onRetry={retry("grammar")}>
            {r.grammar && <GrammarSection sentences={r.sentences} points={r.grammar} />}
          </SectionShell>
        );
      case "structure":
        return (
          <SectionShell title="문장구조분석" status={st("structure")} onRetry={retry("structure")}>
            {r.structures && <StructureSection sentences={r.sentences} structures={r.structures} />}
          </SectionShell>
        );
      case "questions":
        return (
          <QuestionsSection
            types={request.questionTypes}
            questions={r.questions}
            statusOf={(t) => st(`q:${t}`)}
            onRetry={(t) => retry(`q:${t}`)()}
          />
        );
      case "answers":
        return <AnswerSection types={request.questionTypes} questions={r.questions} title={multi ? `${p.label} 정답 및 해설` : undefined} />;
    }
  };

  /** 지문 하나의 섹션 하나 = 인쇄 시 새 페이지 하나에서 시작 */
  const panel = (p: PassageInput, key: PrintKey) => {
    const idx = printIndex.get(`${p.id}::${key}`);
    const included = idx !== undefined;
    const onScreen = key !== "cover" && tab === key && active === p.id;
    return (
      <div
        key={`${p.id}::${key}`}
        className={["print-panel", onScreen ? "" : "hidden", included ? "" : "print-exclude", included && idx > 0 ? "page-start" : ""].join(" ")}
      >
        {key !== "cover" && (
          <div className="mb-3 hidden justify-between border-b border-[var(--line)] pb-1 text-[0.7rem] text-[var(--muted)] print:flex">
            <span>
              수능 영어 지문 분석 · {multi ? `${p.label} · ` : ""}
              {PRINT_SECTIONS.find((s) => s.key === key)?.label}
            </span>
            <span>{dateText}</span>
          </div>
        )}
        {renderSection(p, key)}
      </div>
    );
  };

  // DOM 순서 = 인쇄 순서 (인쇄에 포함된 것 먼저, 나머지는 화면용)
  const byId = new Map(passages.map((p) => [p.id, p]));
  const renderOrder = [
    ...printItems.map((it) => ({ p: byId.get(it.passageId)!, key: it.key })),
    ...passages.flatMap((p) => PRINT_SECTIONS.map((s) => ({ p, key: s.key }))).filter((x) => !printIndex.has(`${x.p.id}::${x.key}`)),
  ];

  const activePassage = passages.find((p) => p.id === active) ?? passages[0];
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
            onClick={() => doPrint({ keys: [tab], passageIds: [activePassage.id], answersAtEnd: false }, `${multi ? activePassage.label : ""}${currentTabLabel}`)}
            className="rounded-lg border border-[var(--line)] bg-white px-3 py-1.5"
          >
            이 탭만 인쇄
          </button>
          <button type="button" onClick={() => setPrintOpen(true)} className="rounded-lg bg-[var(--accent)] px-3 py-1.5 font-semibold text-white">
            🖨️ 인쇄 · PDF · Word
          </button>
        </div>
      </header>

      <PrintDialog
        open={printOpen}
        onClose={() => setPrintOpen(false)}
        passages={passages}
        currentPassageId={activePassage.id}
        onPrint={doPrint}
        onWord={doWord}
      />

      {busy && (
        <div className="no-print mt-4 rounded-lg bg-blue-50 px-4 py-2 text-sm">
          생성 중… {done}/{total} 완료. 완료된 섹션부터 볼 수 있습니다. 인쇄·저장은 생성이 끝난 뒤에 하세요.
        </div>
      )}

      {multi && (
        <nav className="no-print mt-4 flex flex-wrap gap-2" aria-label="지문 선택">
          {passages.map((p, i) => {
            const pr = progressOf(p.id);
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setActive(p.id)}
                className={`rounded-full border px-3 py-1 text-sm ${
                  active === p.id ? "border-[var(--accent)] bg-[var(--accent)] text-white" : "border-[var(--line)] bg-white"
                }`}
              >
                {i + 1}. {p.label}
                <span className="ml-1.5 text-xs opacity-80">
                  {pr.loading ? `${pr.done}/${taskKeys.length}` : pr.error ? "⚠" : pr.started ? "✓" : ""}
                </span>
              </button>
            );
          })}
        </nav>
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
        {multi && <h2 className="no-print mb-3 text-sm font-semibold text-[var(--accent)]">{activePassage.label}</h2>}
        {renderOrder.map(({ p, key }) => panel(p, key))}
      </div>
    </main>
  );
}
