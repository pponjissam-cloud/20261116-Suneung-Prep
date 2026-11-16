import { findPhrase } from "@/lib/align";
import type { Sentence, VocabItem } from "@/lib/types";

/** 예문 속 단어를 굵게 */
function Example({ text, word }: { text: string; word: string }) {
  const span = findPhrase(text, word);
  if (!span) return <>{text}</>;
  return (
    <>
      {text.slice(0, span.start)}
      <b>{text.slice(span.start, span.end)}</b>
      {text.slice(span.end)}
    </>
  );
}

export default function VocabSection({ items, sentences }: { items: VocabItem[]; sentences: Sentence[] }) {
  const byId = new Map(sentences.map((s) => [s.id, s.text]));
  return (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr className="border-b-2 border-[var(--ink)] text-left">
          <th className="w-8 py-2">#</th>
          <th className="py-2">단어</th>
          <th className="py-2">뜻</th>
          <th className="hidden py-2 sm:table-cell print:table-cell">유의어 / 반의어</th>
        </tr>
      </thead>
      <tbody>
        {items.map((v, i) => (
          <tr key={`${v.lemma}-${i}`} className="avoid-break border-b border-[var(--line)] align-top">
            <td className="py-2 text-[var(--muted)]">{i + 1}</td>
            <td className="py-2">
              <div className="font-semibold">{v.lemma}</div>
              <div className="text-xs text-[var(--muted)]">
                {v.pos} {v.ipa}
              </div>
            </td>
            <td className="py-2">
              <div>{v.meaningKo}</div>
              <div className="passage mt-1 text-xs leading-relaxed text-[var(--muted)]">
                <Example text={byId.get(v.sentenceId) ?? ""} word={v.word} />
              </div>
            </td>
            <td className="hidden py-2 text-xs sm:table-cell print:table-cell">
              {v.synonyms.length > 0 && <div>≒ {v.synonyms.join(", ")}</div>}
              {v.antonyms.length > 0 && <div>↔ {v.antonyms.join(", ")}</div>}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
