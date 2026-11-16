import type { Sentence, Translation } from "@/lib/types";

export default function TranslationSection({ sentences, translations }: { sentences: Sentence[]; translations: Translation[] }) {
  const byId = new Map(translations.map((t) => [t.sentenceId, t]));
  return (
    <ol className="space-y-5">
      {sentences.map((s, i) => {
        const t = byId.get(s.id);
        return (
          <li key={s.id} className="avoid-break">
            <p className="passage">
              <span className="mr-2 font-sans text-sm font-bold text-[var(--accent)]">{i + 1}</span>
              {s.text}
            </p>
            {t && (
              <>
                <p className="mt-1 pl-6">{t.natural}</p>
                <p className="mt-1 pl-6 text-sm text-[var(--muted)]">
                  <span className="mr-1 rounded bg-gray-100 px-1 text-xs">직독직해</span>
                  {t.chunked}
                </p>
              </>
            )}
          </li>
        );
      })}
    </ol>
  );
}
