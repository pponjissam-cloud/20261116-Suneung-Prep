import { CIRCLED, QUESTION_TYPE_INFO } from "@/lib/question-types";
import type { Question, QuestionType } from "@/lib/types";

/** [s3] 같은 문장 ID 인용을 "문장 3" 으로 바꿔 읽기 쉽게 */
const readable = (text: string) => text.replace(/\[s(\d+)\]/g, "(문장 $1)");

export default function AnswerSection({ types, questions, title = "정답 및 해설" }: { types: QuestionType[]; questions: Question[]; title?: string }) {
  const byType = new Map(questions.map((q) => [q.type, q]));
  const list = types.map((t, i) => ({ n: i + 1, q: byType.get(t) })).filter((x): x is { n: number; q: Question } => !!x.q);

  if (list.length === 0)
    return (
      <section>
        <h2 className="mb-4 text-lg font-bold">{title}</h2>
        <p className="text-sm text-[var(--muted)]">생성된 문제가 없습니다.</p>
      </section>
    );

  return (
    <section>
      <h2 className="mb-4 text-lg font-bold">{title}</h2>

      <div className="mb-6 flex flex-wrap gap-2 rounded-lg bg-gray-50 p-3 text-sm">
        {list.map(({ n, q }) => (
          <span key={q.id} className="rounded border border-[var(--line)] bg-white px-2 py-1">
            {n}. <b>{CIRCLED[q.answerIndex]}</b>
          </span>
        ))}
      </div>

      <ol className="space-y-6">
        {list.map(({ n, q }) => (
          <li key={q.id} className="avoid-break border-b border-[var(--line)] pb-4">
            <h3 className="font-semibold">
              {n}. [{QUESTION_TYPE_INFO[q.type].label}] 정답 {CIRCLED[q.answerIndex]}
              {q.choices[q.answerIndex] !== CIRCLED[q.answerIndex] && (
                <span className="ml-2 font-normal text-[var(--muted)]">{q.choices[q.answerIndex]}</span>
              )}
            </h3>
            <p className="mt-2 text-sm leading-relaxed">{readable(q.explanation)}</p>
            {q.choiceNotes.some((x) => x) && (
              <ul className="mt-2 space-y-0.5 text-sm text-[var(--muted)]">
                {q.choiceNotes.map((note, k) =>
                  note && k !== q.answerIndex ? (
                    <li key={k}>
                      {CIRCLED[k]} {readable(note)}
                    </li>
                  ) : null,
                )}
              </ul>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
