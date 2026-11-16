"use client";

import { useState } from "react";
import { PRINT_SECTIONS, type PrintKey } from "@/lib/print-sections";

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
  onPrint: (keys: PrintKey[], label: string) => void;
  onWord: (keys: PrintKey[], label: string) => Promise<void>;
};

/** 인쇄·PDF 저장할 섹션 고르기 */
export default function PrintDialog({ open, onClose, onPrint, onWord }: Props) {
  const [keys, setKeys] = useState<PrintKey[]>(ALL);
  const [presetLabel, setPresetLabel] = useState(PRESETS[0].label);
  const [saving, setSaving] = useState(false);
  const [wordError, setWordError] = useState<string | null>(null);
  if (!open) return null;

  const toggle = (k: PrintKey) => {
    setPresetLabel("선택 섹션");
    setKeys((prev) => (prev.includes(k) ? prev.filter((x) => x !== k) : ALL.filter((x) => prev.includes(x) || x === k)));
  };

  return (
    <div className="no-print fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <h2 className="text-lg font-bold">인쇄 · PDF · Word 저장</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">고른 섹션마다 새 페이지에서 시작합니다.</p>

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
                await onWord(keys, presetLabel);
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
            onClick={() => onPrint(keys, presetLabel)}
            className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
          >
            인쇄 / PDF 저장 ({keys.length}개 섹션)
          </button>
        </div>
      </div>
    </div>
  );
}
