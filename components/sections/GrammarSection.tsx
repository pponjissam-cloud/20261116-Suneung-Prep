import type { GrammarPoint, Sentence } from "@/lib/types";

export default function GrammarSection({ sentences, points }: { sentences: Sentence[]; points: GrammarPoint[] }) {
  const index = new Map(sentences.map((s, i) => [s.id, i]));
  const sorted = [...points].sort((a, b) => (index.get(a.sentenceId) ?? 0) - (index.get(b.sentenceId) ?? 0) || a.start - b.start);

  return (
    <ol className="space-y-6">
      {sorted.map((p, i) => {
        const text = sentences[index.get(p.sentenceId) ?? 0]?.text ?? "";
        return (
          <li key={i} className="avoid-break rounded-lg border border-[var(--line)] p-4">
            <h3 className="font-semibold">
              {i + 1}. {p.title}
              <span className="ml-2 text-xs font-normal text-[var(--muted)]">문장 {(index.get(p.sentenceId) ?? 0) + 1}</span>
            </h3>
            <p className="passage mt-2">
              {text.slice(0, p.start)}
              <mark className="rounded bg-yellow-200 px-0.5 underline decoration-2 underline-offset-4 print:bg-transparent">
                {text.slice(p.start, p.end)}
              </mark>
              {text.slice(p.end)}
            </p>
            <p className="mt-2 text-sm leading-relaxed">{p.explanation}</p>
            <div className="mt-2 rounded bg-gray-50 px-3 py-2 text-sm">
              <span className="mr-2 text-xs font-semibold text-[var(--muted)]">예문</span>
              <span className="passage">{p.example.en}</span>
              <div className="text-[var(--muted)]">{p.example.ko}</div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
