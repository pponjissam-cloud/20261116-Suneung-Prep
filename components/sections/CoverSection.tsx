import { QUESTION_TYPE_INFO } from "@/lib/question-types";
import type { QuestionType, Sentence } from "@/lib/types";

type Props = {
  sentences: Sentence[];
  questionTypes: QuestionType[];
  dateText: string;
  contents: string[];
};

/** 인쇄 표지: 제목, 날짜, 목차, 원문 지문(문장 번호 포함) */
export default function CoverSection({ sentences, questionTypes, dateText, contents }: Props) {
  return (
    <section>
      <div className="border-b-2 border-[var(--ink)] pb-3">
        <h1 className="text-2xl font-bold">수능 영어 지문 분석 자료</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          {dateText} · {sentences.length}문장
        </p>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
        <div>
          <h2 className="font-semibold">목차</h2>
          <ol className="mt-1 space-y-0.5">
            {contents.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ol>
        </div>
        <div>
          <h2 className="font-semibold">문제 유형</h2>
          <p className="mt-1">{questionTypes.map((t) => QUESTION_TYPE_INFO[t].label).join(" · ")}</p>
        </div>
      </div>

      <h2 className="mt-6 font-semibold">원문</h2>
      <div className="passage mt-2 rounded border border-[var(--ink)] px-5 py-4">
        {sentences.map((s, i) => (
          <span key={s.id}>
            <sup className="mr-0.5 font-sans text-[0.65rem] font-bold text-[var(--accent)]">{i + 1}</sup>
            {s.text}{" "}
          </span>
        ))}
      </div>

      <div className="mt-6 grid grid-cols-3 gap-3 text-sm">
        {["학년/반", "이름", "점수"].map((l) => (
          <div key={l} className="border-b border-[var(--ink)] pb-5">
            {l}
          </div>
        ))}
      </div>
    </section>
  );
}
