import type { Block, Segment } from "@/lib/types";

function Seg({ s }: { s: Segment }) {
  const marker = s.marker ? <span className="font-sans font-semibold">{s.marker}</span> : null;
  if (s.style === "blank")
    return (
      <>
        {marker}
        <span className="blank" />
      </>
    );
  if (s.style === "underline")
    return (
      <>
        {marker}
        <u className="decoration-1 underline-offset-4">{s.text}</u>
      </>
    );
  if (s.style === "bold")
    return (
      <>
        {marker}
        <b>{s.text}</b>
      </>
    );
  return (
    <>
      {marker && <> {marker} </>}
      {s.text}
    </>
  );
}

/** 문제 지문(변형 포함) 렌더링 */
export default function PassageBlocks({ blocks }: { blocks: Block[] }) {
  return (
    <div className="space-y-2">
      {blocks.map((b, i) => (
        <div key={i} className={`passage ${b.boxed ? "rounded border border-[var(--ink)] px-4 py-3" : ""}`}>
          {b.label && <span className="mr-2 font-sans font-semibold">{b.label}</span>}
          {b.segments.map((s, k) => (
            <Seg key={k} s={s} />
          ))}
        </div>
      ))}
    </div>
  );
}
