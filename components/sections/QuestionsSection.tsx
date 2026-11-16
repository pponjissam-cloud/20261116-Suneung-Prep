import { CIRCLED, QUESTION_TYPE_INFO } from "@/lib/question-types";
import type { Question, QuestionType } from "@/lib/types";
import PassageBlocks from "../PassageBlocks";
import { ErrorBox, Loading, type TaskStatus } from "../SectionShell";

type Props = {
  types: QuestionType[];
  questions: Question[];
  statusOf: (t: QuestionType) => TaskStatus | undefined;
  onRetry: (t: QuestionType) => void;
};

export default function QuestionsSection({ types, questions, statusOf, onRetry }: Props) {
  const byType = new Map(questions.map((q) => [q.type, q]));
  return (
    <section>
      <h2 className="mb-4 text-lg font-bold">수능 유형별 문제</h2>
      <ol className="space-y-10">
        {types.map((t, i) => {
          const q = byType.get(t);
          const st = statusOf(t);
          if (!q && st?.state !== "loading" && st?.state !== "error") return null;
          return (
            <li key={t} className="avoid-break">
              <div className="flex items-start justify-between gap-3">
                <h3 className="font-semibold">
                  {i + 1}. {q?.stem ?? QUESTION_TYPE_INFO[t].stem}
                  <span className="no-print ml-2 rounded bg-gray-100 px-1.5 text-xs font-normal">{QUESTION_TYPE_INFO[t].label}</span>
                </h3>
                {st?.state !== "loading" && (
                  <button type="button" onClick={() => onRetry(t)} className="no-print shrink-0 text-xs text-[var(--muted)] underline">
                    다시 생성
                  </button>
                )}
              </div>
              {st?.state === "loading" && <Loading label="문제를 만들고 있습니다…" />}
              {st?.state === "error" && <ErrorBox message={st.error} onRetry={st.retryable === false ? undefined : () => onRetry(t)} />}
              {q && st?.state !== "loading" && (
                <>
                  <div className="mt-3">
                    <PassageBlocks blocks={q.display} />
                  </div>
                  <ul className="mt-3 space-y-1">
                    {q.choices.map((c, k) => (
                      <li key={k} className={`flex gap-2 ${t === "grammar" || t === "vocabulary" || t === "irrelevant" || t === "insertion" ? "inline-flex pr-6" : ""}`}>
                        <span>{CIRCLED[k]}</span>
                        {/* 번호만 고르는 유형은 선택지 텍스트가 곧 번호라 생략 */}
                        {c !== CIRCLED[k] && <span className={/[가-힣]/.test(c) ? "" : "passage"}>{c}</span>}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
