"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import PassageUpload, { splitTextWithAI, type UploadSource } from "@/components/PassageUpload";
import { deleteHistory, listHistory, saveJob, type HistoryEntry } from "@/lib/history";
import { MAX_WORDS, MIN_WORDS, NON_ENGLISH_WARN_RATIO } from "@/lib/limits";
import { MAX_PASSAGES, newPassageId, type ExtractedPassage, type PassageInput } from "@/lib/passages";
import { QUESTION_TYPE_INFO } from "@/lib/question-types";
import { SAMPLE_PASSAGE } from "@/lib/sample";
import { countWords, nonEnglishRatio } from "@/lib/split-sentences";
import { QUESTION_TYPES, type Difficulty, type QuestionType } from "@/lib/types";

type Card = PassageInput & { warnings: string[] };

const emptyCard = (n: number): Card => ({ id: newPassageId(), label: `지문 ${n}`, text: "", warnings: [] });
const fromExtracted = (p: ExtractedPassage): Card => ({ id: newPassageId(), label: p.label, text: p.text, warnings: p.warnings });

function swap<T>(arr: T[], i: number, j: number): T[] {
  const n = [...arr];
  [n[i], n[j]] = [n[j], n[i]];
  return n;
}

export default function HomePage() {
  const router = useRouter();
  const [cards, setCards] = useState<Card[]>(() => [emptyCard(1)]);
  const [types, setTypes] = useState<QuestionType[]>([...QUESTION_TYPES]);
  const [difficulty, setDifficulty] = useState<Difficulty>("basic");
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [notice, setNotice] = useState<{ message: string; warnings: string[]; prev: Card[] } | null>(null);
  const [splitting, setSplitting] = useState<string | null>(null);
  const [splitError, setSplitError] = useState<string | null>(null);

  useEffect(() => setHistory(listHistory()), []);

  const filled = cards.filter((c) => c.text.trim());
  const wordsOf = (c: Card) => countWords(c.text);
  const invalid = filled.filter((c) => wordsOf(c) < MIN_WORDS || wordsOf(c) > MAX_WORDS);
  const canSubmit = filled.length > 0 && invalid.length === 0 && types.length > 0;

  const update = (id: string, patch: Partial<Card>) => setCards((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  const remove = (id: string) => setCards((prev) => (prev.length === 1 ? [emptyCard(1)] : prev.filter((c) => c.id !== id)));
  const add = () => setCards((prev) => (prev.length >= MAX_PASSAGES ? prev : [...prev, emptyCard(prev.length + 1)]));

  const toggle = (t: QuestionType) =>
    setTypes((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : QUESTION_TYPES.filter((x) => prev.includes(x) || x === t)));

  /** 가져온 지문으로 채운다. 빈 카드만 있으면 바꾸고, 이미 입력한 지문이 있으면 뒤에 덧붙인다 */
  const onPassages = (passages: ExtractedPassage[], warnings: string[], source: UploadSource) => {
    const prev = cards;
    const kept = prev.filter((c) => c.text.trim());
    const incoming = passages.slice(0, Math.max(0, MAX_PASSAGES - kept.length)).map(fromExtracted);
    const dropped = passages.length - incoming.length;
    setCards(kept.length ? [...kept, ...incoming] : incoming);
    setNotice({
      message: `${source === "photo" ? "사진" : "파일"}에서 지문 ${incoming.length}개를 가져왔습니다${kept.length ? " (기존 지문 뒤에 추가)" : ""}. 잘못 읽은 글자가 없는지 꼭 확인하세요.`,
      warnings: [...warnings, ...(dropped > 0 ? [`지문은 최대 ${MAX_PASSAGES}개까지라 ${dropped}개는 넣지 못했습니다.`] : [])],
      prev,
    });
  };

  /** 한 카드에 지문이 여러 개 붙어 있을 때 AI로 나누기 */
  const splitCard = async (card: Card) => {
    setSplitting(card.id);
    setSplitError(null);
    try {
      const { passages, warnings } = await splitTextWithAI(card.text);
      const prev = cards;
      setCards((cur) => {
        const i = cur.findIndex((c) => c.id === card.id);
        return [...cur.slice(0, i), ...passages.map(fromExtracted), ...cur.slice(i + 1)].slice(0, MAX_PASSAGES);
      });
      setNotice({ message: `지문 ${passages.length}개로 나눴습니다. 나뉜 곳이 맞는지 확인하세요.`, warnings, prev });
    } catch (e) {
      setSplitError(e instanceof Error ? e.message : "나누지 못했습니다.");
    } finally {
      setSplitting(null);
    }
  };

  const submit = () => {
    if (!canSubmit) return;
    const id = crypto.randomUUID();
    const passages = filled.map((c, i) => ({ id: c.id, label: c.label.trim() || `지문 ${i + 1}`, text: c.text }));
    saveJob(id, { passages, questionTypes: types, difficulty });
    router.push(`/result?id=${id}`);
  };

  const totalRequests = filled.length * (4 + types.length);

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-2xl font-bold">수능 지문 분석기</h1>
      <p className="mt-1 text-sm text-[var(--muted)]">
        영어 지문을 넣으면 단어목록 · 문장별 해석 · 중요 문법·구문 · 문장구조분석 · 유형별 문제 · 정답지를 만들어 줍니다. 지문 여러 개를 한꺼번에 넣을 수 있습니다.
      </p>

      <section className="mt-6 space-y-3 rounded-xl border border-[var(--line)] bg-white p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">
            영어 지문 <span className="text-sm font-normal text-[var(--muted)]">({filled.length}개 입력됨, 최대 {MAX_PASSAGES}개)</span>
          </h2>
          <button
            type="button"
            className="text-sm text-[var(--accent)] underline"
            onClick={() => setCards([{ ...emptyCard(1), label: "예시 지문", text: SAMPLE_PASSAGE }])}
          >
            예시 지문 넣기
          </button>
        </div>

        <PassageUpload onPassages={onPassages} />

        {notice && (
          <div className="rounded-lg bg-amber-50 px-4 py-3 text-sm">
            <p className="font-semibold">{notice.message}</p>
            {notice.warnings.length > 0 && (
              <ul className="mt-1 list-disc pl-5 text-amber-800">
                {notice.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            )}
            <div className="mt-2 flex gap-3">
              <button
                type="button"
                className="underline"
                onClick={() => {
                  setCards(notice.prev);
                  setNotice(null);
                }}
              >
                되돌리기
              </button>
              <button type="button" className="text-[var(--muted)] underline" onClick={() => setNotice(null)}>
                닫기
              </button>
            </div>
          </div>
        )}
        {splitError && <p className="text-sm font-semibold text-red-600">{splitError}</p>}

        {cards.map((c, i) => {
          const words = wordsOf(c);
          const tooShort = Boolean(c.text.trim()) && words < MIN_WORDS;
          const tooLong = words > MAX_WORDS;
          return (
            <div key={c.id} className="rounded-lg border border-[var(--line)] p-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-[var(--accent)]">{i + 1}</span>
                <input
                  value={c.label}
                  onChange={(e) => update(c.id, { label: e.target.value })}
                  placeholder={`지문 ${i + 1}`}
                  aria-label="지문 이름"
                  className="w-40 rounded border border-[var(--line)] px-2 py-1 text-sm"
                />
                <span className={`text-sm ${tooShort || tooLong ? "font-semibold text-red-600" : "text-[var(--muted)]"}`}>{words}단어</span>
                <div className="ml-auto flex gap-1">
                  <button
                    type="button"
                    disabled={i === 0}
                    onClick={() => setCards((prev) => swap(prev, i, i - 1))}
                    className="rounded px-2 text-sm text-[var(--muted)] disabled:opacity-30"
                    aria-label="위로"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    disabled={i === cards.length - 1}
                    onClick={() => setCards((prev) => swap(prev, i, i + 1))}
                    className="rounded px-2 text-sm text-[var(--muted)] disabled:opacity-30"
                    aria-label="아래로"
                  >
                    ↓
                  </button>
                  <button type="button" onClick={() => remove(c.id)} className="rounded px-2 text-sm text-[var(--muted)] hover:text-red-600">
                    삭제
                  </button>
                </div>
              </div>
              <textarea
                value={c.text}
                onChange={(e) => update(c.id, { text: e.target.value, warnings: [] })}
                rows={cards.length > 1 ? 7 : 12}
                placeholder="여기에 영어 지문을 붙여 넣으세요. 지문 여러 개를 한 번에 붙여 넣어도 됩니다."
                className="passage mt-2 w-full rounded-lg border border-[var(--line)] p-3 focus:outline-2 focus:outline-[var(--accent)]"
              />
              {c.warnings.length > 0 && <p className="text-xs text-amber-700">⚠ {c.warnings.join(" / ")}</p>}
              {nonEnglishRatio(c.text) >= NON_ENGLISH_WARN_RATIO && (
                <p className="text-xs font-semibold text-amber-700">영어가 아닌 글자가 많습니다. 발문·선택지가 섞여 있지 않은지 확인하세요.</p>
              )}
              {tooShort && <p className="text-xs text-red-600">{MIN_WORDS}단어 이상이어야 합니다.</p>}
              {tooLong && (
                <p className="mt-1 text-xs text-red-600">
                  {MAX_WORDS}단어를 넘습니다. 지문이 여러 개 붙어 있다면{" "}
                  <button
                    type="button"
                    disabled={splitting !== null}
                    onClick={() => void splitCard(c)}
                    className="font-semibold text-[var(--accent)] underline disabled:opacity-40"
                  >
                    {splitting === c.id ? "나누는 중…" : "AI로 지문별 나누기"}
                  </button>
                </p>
              )}
            </div>
          );
        })}

        <button
          type="button"
          onClick={add}
          disabled={cards.length >= MAX_PASSAGES}
          className="w-full rounded-lg border border-dashed border-[var(--line)] py-2 text-sm text-[var(--muted)] hover:border-[var(--accent)] disabled:opacity-40"
        >
          + 지문 추가
        </button>
      </section>

      <section className="mt-4 rounded-xl border border-[var(--line)] bg-white p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">
            문제 유형 ({types.length}개 선택) <span className="text-sm font-normal text-[var(--muted)]">· 모든 지문에 똑같이 적용</span>
          </h2>
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
            <label
              key={t}
              className="flex cursor-pointer items-center gap-2 rounded-md border border-[var(--line)] px-3 py-2 text-sm has-[:checked]:border-[var(--accent)] has-[:checked]:bg-blue-50"
            >
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
        {filled.length > 1 ? `지문 ${filled.length}개 생성하기` : "생성하기"}
      </button>
      <p className="mt-2 text-center text-xs text-[var(--muted)]">
        {invalid.length > 0
          ? `길이가 ${MIN_WORDS}~${MAX_WORDS}단어가 아닌 지문이 ${invalid.length}개 있습니다.`
          : filled.length > 1
            ? `AI 요청 약 ${totalRequests}건 · 지문 1개당 1~2분 정도 걸립니다.`
            : ""}
      </p>

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
