"use client";

import { useState } from "react";
import type { PassageInput } from "@/lib/passages";
import { PRINT_SECTIONS, type ExportOptions, type PrintKey } from "@/lib/print-sections";

export { PRINT_SECTIONS, type PrintKey };

const ALL = PRINT_SECTIONS.map((s) => s.key);
const PRESETS: { label: string; keys: PrintKey[] }[] = [
  { label: "전체 (교사용)", keys: ALL },
  { label: "학생용 (정답지 제외)", keys: ALL.filter((k) => k !== "answers") },
  { label: "문제지만", keys: ["questions"] },
  { label: "문제 + 정답지", keys: ["questions", "answers"] },
];

type Props = {
  open: boolean;
  onClose: () => void;
  passages: PassageInput[];
  currentPassageId: string;
  onPrint: (opts: ExportOptions, label: string) => void;
  onWord: (opts: ExportOptions, label: string) => Promise<void>;
};

/** 인쇄·PDF·Word로 내보낼 지문과 섹션 고르기 */
export default function PrintDialog({ open, onClose, passages, currentPassageId, onPrint, onWord }: Props) {
  const [keys, setKeys] = useState<PrintKey[]>(ALL);
  const [presetLabel, setPresetLabel] = useState(PRESETS[0].label);
  const [scope, setScope] = useState<"all" | "current">("all");
  const [answersAtEnd, setAnswersAtEnd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [wordError, setWordError] = useState<string | null>(null);
  if (!open) return null;

  const multi = passages.length > 1;
  const current = passages.find((p) => p.id === currentPassageId);
  const passageIds = scope === "all" || !multi ? passages.map((p) => p.id) : [currentPassageId];
  const opts: ExportOptions = { keys, passageIds, answersAtEnd: multi && scope === "all" && answersAtEnd };
  const label = `${multi ? (scope === "all" ? `지문${passages.length}개_` : `${current?.label ?? ""}_`) : ""}${presetLabel}`;

  const toggle = (k: PrintKey) => {
    setPresetLabel("선택섹션");
    setKeys((prev) => (prev.includes(k) ? prev.filter((x) => x !== k) : ALL.filter((x) => prev.includes(x) || x === k)));
  };

  return (
    <div className="no-print fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <h2 className="text-lg font-bold">인쇄 · PDF · Word 저장</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          {multi ? "지문마다 고른 섹션이 차례로 들어가고, 섹션마다 새 페이지에서 시작합니다." : "고른 섹션마다 새 페이지에서 시작합니다."}
        </p>

        {multi && (
          <fieldset className="mt-4 text-sm">
            <legend className="font-semibold">지문</legend>
            <label className="mt-1 flex items-center gap-2">
              <input type="radio" name="scope" checked={scope === "all"} onChange={() => setScope("all")} />
              모든 지문 ({passages.length}개: {passages.map((p) => p.label).join(" → ")})
            </label>
            <label className="mt-1 flex items-center gap-2">
              <input type="radio" name="scope" checked={scope === "current"} onChange={() => setScope("current")} />
              지금 보고 있는 지문만 ({current?.label})
            </label>
          </fieldset>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => {
                setKeys(p.keys);
                setPresetLabel(p.label);
              }}
              className={`rounded-full border px-3 py-1 text-xs ${
                presetLabel === p.label ? "border-[var(--accent)] bg-blue-50 font-semibold" : "border-[var(--line)]"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        <ul className="mt-4 space-y-1.5">
          {PRINT_SECTIONS.map((s) => (
            <li key={s.key}>
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input type="checkbox" checked={keys.includes(s.key)} onChange={() => toggle(s.key)} />
                {s.label}
              </label>
            </li>
          ))}
        </ul>

        {multi && scope === "all" && keys.includes("answers") && (
          <label className="mt-3 flex items-center gap-2 rounded-lg bg-blue-50 px-3 py-2 text-sm">
            <input type="checkbox" checked={answersAtEnd} onChange={(e) => setAnswersAtEnd(e.target.checked)} />
            정답지는 맨 뒤에 모으기 (문제지와 정답지를 따로 나눠 줄 때)
          </label>
        )}

        <div className="mt-4 rounded-lg bg-gray-50 px-3 py-2 text-xs leading-relaxed text-[var(--muted)]">
          <b>PDF로 저장하려면</b> 인쇄 창의 &lsquo;대상(프린터)&rsquo;에서 <b>&lsquo;PDF로 저장&rsquo;</b>을 고르세요.
          <br />
          <b>Word로 저장</b>하면 .docx 파일을 받아 한글·Word에서 고칠 수 있습니다.
          <br />
          색이 안 나오면 인쇄 창의 &lsquo;설정 더보기 → 배경 그래픽&rsquo;을 켜세요.
        </div>

        {wordError && <p className="mt-3 text-sm font-semibold text-red-600">{wordError}</p>}

        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-[var(--line)] px-4 py-2 text-sm">
            취소
          </button>
          <button
            type="button"
            disabled={keys.length === 0 || saving}
            onClick={async () => {
              setSaving(true);
              setWordError(null);
              try {
                await onWord(opts, label);
              } catch {
                setWordError("Word 파일을 만들지 못했습니다. 다시 시도해 주세요.");
              } finally {
                setSaving(false);
              }
            }}
            className="rounded-lg border border-[var(--accent)] px-4 py-2 text-sm font-semibold text-[var(--accent)] disabled:opacity-40"
          >
            {saving ? "만드는 중…" : "Word로 저장 (.docx)"}
          </button>
          <button
            type="button"
            disabled={keys.length === 0}
            onClick={() => onPrint(opts, label)}
            className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
          >
            인쇄 / PDF 저장
          </button>
        </div>
      </div>
    </div>
  );
}
