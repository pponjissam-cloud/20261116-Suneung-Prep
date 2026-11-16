"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { deleteHistory, listHistory, saveJob, type HistoryEntry } from "@/lib/history";
import { MAX_WORDS, MIN_WORDS, NON_ENGLISH_WARN_RATIO } from "@/lib/limits";
import { QUESTION_TYPE_INFO } from "@/lib/question-types";
import { SAMPLE_PASSAGE } from "@/lib/sample";
import { countWords, nonEnglishRatio } from "@/lib/split-sentences";
import { QUESTION_TYPES, type Difficulty, type QuestionType } from "@/lib/types";

export default function HomePage() {
  const router = useRouter();
  const [passage, setPassage] = useState("");
  const [types, setTypes] = useState<QuestionType[]>([...QUESTION_TYPES]);
  const [difficulty, setDifficulty] = useState<Difficulty>("basic");
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => setHistory(listHistory()), []);

  const words = useMemo(() => countWords(passage), [passage]);
  const ratio = useMemo(() => nonEnglishRatio(passage), [passage]);
  const lengthOk = words >= MIN_WORDS && words <= MAX_WORDS;
  const canSubmit = lengthOk && types.length > 0;

  const toggle = (t: QuestionType) =>
    setTypes((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : QUESTION_TYPES.filter((x) => prev.includes(x) || x === t)));

  const submit = () => {
    if (!canSubmit) return;
    const id = crypto.randomUUID();
    saveJob(id, { passage, questionTypes: types, difficulty });
    router.push(`/result?id=${id}`);
  };

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-2xl font-bold">수능 지문 분석기</h1>
      <p className="mt-1 text-sm text-[var(--muted)]">
        영어 지문을 넣으면 단어목록 · 문장별 해석 · 중요 문법·구문 · 문장구조분석 · 유형별 문제 · 정답지를 만들어 줍니다.
      </p>

      <section className="mt-6 rounded-xl border border-[var(--line)] bg-white p-5">
        <div className="flex items-center justify-between">
          <label htmlFor="passage" className="font-semibold">
            영어 지문
          </label>
          <button type="button" className="text-sm text-[var(--accent)] underline" onClick={() => setPassage(SAMPLE_PASSAGE)}>
            예시 지문 넣기
          </button>
        </div>
        <textarea
          id="passage"
          value={passage}
          onChange={(e) => setPassage(e.target.value)}
          rows={12}
          placeholder="여기에 영어 지문을 붙여 넣으세요."
          className="passage mt-2 w-full rounded-lg border border-[var(--line)] p-3 focus:outline-2 focus:outline-[var(--accent)]"
        />
        <div className="mt-1 flex flex-wrap gap-x-4 text-sm">
          <span className={lengthOk || words === 0 ? "text-[var(--muted)]" : "font-semibold text-red-600"}>
            {words}단어 (권장 {MIN_WORDS}~{MAX_WORDS})
          </span>
          {ratio >= NON_ENGLISH_WARN_RATIO && (
            <span className="font-semibold text-amber-700">영어가 아닌 글자가 많습니다. 영어 지문인지 확인하세요.</span>
          )}
        </div>
      </section>

      <section className="mt-4 rounded-xl border border-[var(--line)] bg-white p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">문제 유형 ({types.length}개 선택)</h2>
          <div className="space-x-3 text-sm">
            <button type="button" className="underline" onClick={() => setTypes([...QUESTION_TYPES])}>
              전체 선택
            </button>
            <button type="button" className="underline" onClick={() => setTypes([])}>
              전체 해제
            </button>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {QUESTION_TYPES.map((t) => (
            <label key={t} className="flex cursor-pointer items-center gap-2 rounded-md border border-[var(--line)] px-3 py-2 text-sm has-[:checked]:border-[var(--accent)] has-[:checked]:bg-blue-50">
              <input type="checkbox" checked={types.includes(t)} onChange={() => toggle(t)} />
              {QUESTION_TYPE_INFO[t].label}
            </label>
          ))}
        </div>

        <h2 className="mt-5 font-semibold">난이도</h2>
        <div className="mt-2 flex gap-4 text-sm">
          {(["basic", "hard"] as const).map((d) => (
            <label key={d} className="flex items-center gap-2">
              <input type="radio" name="difficulty" checked={difficulty === d} onChange={() => setDifficulty(d)} />
              {d === "basic" ? "기본" : "고난도"}
            </label>
          ))}
        </div>
      </section>

      <button
        type="button"
        disabled={!canSubmit}
        onClick={submit}
        className="mt-5 w-full rounded-xl bg-[var(--accent)] py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
      >
        생성하기
      </button>
      {!lengthOk && words > 0 && (
        <p className="mt-2 text-center text-sm text-red-600">
          지문 길이가 {MIN_WORDS}~{MAX_WORDS}단어일 때 생성할 수 있습니다.
        </p>
      )}

      {history.length > 0 && (
        <section className="mt-10">
          <h2 className="font-semibold">최근 생성 기록</h2>
          <ul className="mt-2 divide-y divide-[var(--line)] rounded-xl border border-[var(--line)] bg-white">
            {history.map((h) => (
              <li key={h.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                <Link href={`/result?id=${h.id}`} className="min-w-0 flex-1 truncate hover:underline">
                  <span className="mr-2 text-[var(--muted)]">{new Date(h.createdAt).toLocaleString("ko-KR")}</span>
                  {h.preview}…
                </Link>
                <button
                  type="button"
                  className="text-[var(--muted)] hover:text-red-600"
                  onClick={() => {
                    deleteHistory(h.id);
                    setHistory(listHistory());
                  }}
                >
                  삭제
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
