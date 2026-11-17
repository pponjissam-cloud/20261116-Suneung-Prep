"use client";

import { useRef, useState } from "react";
import { callExtract } from "@/lib/client-api";
import { compressImage } from "@/lib/image";
import { MAX_WORDS } from "@/lib/limits";
import { MAX_PASSAGES, splitBySeparators, tidyExtracted, type ExtractedPassage } from "@/lib/passages";
import { countWords } from "@/lib/split-sentences";
import { ACCEPT_ATTR, MAX_IMAGES, MAX_UPLOAD_BYTES, classifyFile } from "@/lib/upload";

export type UploadSource = "photo" | "file";

type Props = {
  /** 추출한 지문 목록(1개 이상)과 전체 경고 */
  onPassages: (passages: ExtractedPassage[], warnings: string[], source: UploadSource) => void;
};

/** 긴 텍스트를 AI로 지문별로 나눈다 (구분선이 없을 때) */
export async function splitTextWithAI(text: string): Promise<{ passages: ExtractedPassage[]; warnings: string[] }> {
  const form = new FormData();
  form.append("text", text);
  const res = await callExtract(form);
  if (!res.ok) throw new Error(res.error);
  return res.data;
}

/** TXT: 구분선이 있으면 그대로 나누고, 없고 길면 AI로 나눈다 */
async function passagesFromText(text: string): Promise<{ passages: ExtractedPassage[]; warnings: string[] }> {
  const parts = splitBySeparators(text);
  if (parts.length > 1) return { passages: tidyExtracted(parts.map((p) => ({ passage: p }))), warnings: [] };
  if (countWords(text) > MAX_WORDS) return splitTextWithAI(text);
  return { passages: tidyExtracted([{ passage: text }]), warnings: [] };
}

/** 사진 촬영 / 파일 업로드 / 끌어다 놓기로 지문 입력 (지문 여러 개 지원) */
export default function PassageUpload({ onPassages }: Props) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  async function handle(list: FileList | File[] | null, source: UploadSource) {
    const files = Array.from(list ?? []);
    if (files.length === 0) return;
    setError(null);

    const kinds = files.map((f) => classifyFile(f.name, f.type));
    if (kinds.some((k) => k === null)) return setError("사진, PDF, TXT 파일만 올릴 수 있습니다.");
    if (new Set(kinds).size > 1) return setError("사진·PDF·TXT를 섞지 말고 한 종류만 올려 주세요.");
    const kind = kinds[0];
    if (kind === "pdf" && files.length > 1) return setError("PDF는 한 번에 1개만 올릴 수 있습니다.");
    if (kind === "image" && files.length > MAX_IMAGES) return setError(`사진은 한 번에 최대 ${MAX_IMAGES}장까지 올릴 수 있습니다.`);

    setBusy(true);
    try {
      let out: { passages: ExtractedPassage[]; warnings: string[] };
      if (kind === "text") {
        out = await passagesFromText((await Promise.all(files.map((f) => f.text()))).join("\n\n===\n\n"));
      } else {
        const prepared = kind === "image" ? await Promise.all(files.map((f) => compressImage(f))) : files;
        const size = prepared.reduce((n, f) => n + f.size, 0);
        if (size > MAX_UPLOAD_BYTES)
          throw new Error(`파일이 너무 큽니다 (최대 ${MAX_UPLOAD_BYTES / 1024 / 1024}MB). 사진 수를 줄이거나 지문이 있는 쪽만 올려 주세요.`);
        const form = new FormData();
        prepared.forEach((f) => form.append("files", f));
        const res = await callExtract(form);
        if (!res.ok) throw new Error(res.error);
        out = res.data;
      }
      if (out.passages.length === 0) throw new Error("영어 지문을 찾지 못했습니다.");
      onPassages(out.passages, out.warnings, source);
    } catch (e) {
      setError(e instanceof Error ? e.message : "파일을 처리하지 못했습니다.");
    } finally {
      setBusy(false);
      if (cameraRef.current) cameraRef.current.value = "";
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        void handle(e.dataTransfer.files, "file");
      }}
      className={`rounded-lg border-2 border-dashed px-4 py-3 text-sm transition ${
        dragging ? "border-[var(--accent)] bg-blue-50" : "border-[var(--line)]"
      }`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => cameraRef.current?.click()}
          className="rounded-lg border border-[var(--line)] bg-white px-3 py-1.5 font-medium disabled:opacity-40"
        >
          📷 사진 찍기
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => fileRef.current?.click()}
          className="rounded-lg border border-[var(--line)] bg-white px-3 py-1.5 font-medium disabled:opacity-40"
        >
          📁 파일 올리기
        </button>
        <span className="text-[var(--muted)]">
          {busy
            ? "지문을 찾아 읽고 있습니다… (지문이 많으면 1분 정도 걸립니다)"
            : `사진(최대 ${MAX_IMAGES}장)·PDF·TXT. 지문이 여러 개면 자동으로 나눕니다 (최대 ${MAX_PASSAGES}개)`}
        </span>
        {busy && <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-[var(--accent)] border-t-transparent" />}
      </div>
      {error && <p className="mt-2 font-semibold text-red-600">{error}</p>}

      {/* capture: 휴대폰에서 바로 카메라를 연다 (데스크톱에서는 파일 선택으로 동작) */}
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => void handle(e.target.files, "photo")} />
      <input ref={fileRef} type="file" accept={ACCEPT_ATTR} multiple hidden onChange={(e) => void handle(e.target.files, "file")} />
    </div>
  );
}
