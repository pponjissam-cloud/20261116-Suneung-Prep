import type { Sentence, SentenceStructure, StructureRole } from "@/lib/types";

const ROLE_LABEL: Record<StructureRole, string> = {
  S: "주어",
  V: "동사",
  O: "목적어",
  IO: "간접목적어",
  DO: "직접목적어",
  C: "주격보어",
  OC: "목적격보어",
  M: "수식어",
  CONJ: "접속사",
};

function Legend() {
  return (
    <div className="mb-4 flex flex-wrap gap-x-4 gap-y-1 rounded-lg bg-gray-50 px-3 py-2 text-xs">
      {(["S", "V", "O", "C", "OC", "M", "CONJ"] as const).map((r) => (
        <span key={r}>
          <span className={`role role-${r} font-semibold`}>{r}</span> {ROLE_LABEL[r]}
        </span>
      ))}
      <span>[ ] 절</span>
    </div>
  );
}

export default function StructureSection({ sentences, structures }: { sentences: Sentence[]; structures: SentenceStructure[] }) {
  const byId = new Map(structures.map((s) => [s.sentenceId, s]));
  return (
    <>
      <Legend />
      <ol className="space-y-5">
        {sentences.map((s, i) => {
          const st = byId.get(s.id);
          return (
            <li key={s.id} className="avoid-break border-b border-[var(--line)] pb-4">
              <div className="mb-1 flex items-center gap-2 text-sm">
                <span className="font-bold text-[var(--accent)]">{i + 1}</span>
                {st && <span className="rounded bg-gray-100 px-1.5 text-xs">{st.pattern}형식</span>}
              </div>
              {st ? (
                <p className="passage leading-[2.4]">
                  {st.tokens.map((t, k) => {
                    const prevEnd = k === 0 ? 0 : st.tokens[k - 1].end;
                    return (
                      <span key={k}>
                        {s.text.slice(prevEnd, t.start)}
                        {t.clause && <span className="font-sans text-[var(--muted)]">[</span>}
                        <span className={`role role-${t.role}`}>{t.text}</span>
                        {t.clause && <span className="font-sans text-[var(--muted)]">]</span>}
                        <span className={`role-tag role-${t.role}`} style={{ textDecoration: "none" }}>
                          {t.role}
                          {t.clause ? `·${t.clause}` : ""}
                        </span>
                      </span>
                    );
                  })}
                  {s.text.slice(st.tokens.at(-1)?.end ?? 0)}
                </p>
              ) : (
                <p className="passage text-[var(--muted)]">
                  {s.text} <span className="font-sans text-xs">(분석 실패 — 다시 생성해 보세요)</span>
                </p>
              )}
              {st?.note && <p className="mt-1 text-sm text-[var(--muted)]">※ {st.note}</p>}
            </li>
          );
        })}
      </ol>
    </>
  );
}
