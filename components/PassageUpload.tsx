"use client";

import { useRef, useState } from "react";
import { compressImage } from "@/lib/image";
import { ACCEPT_ATTR, MAX_IMAGES, MAX_UPLOAD_BYTES, classifyFile, cleanExtractedText } from "@/lib/upload";

type Props = {
  /** 추출한 지문과 경고. source 는 안내 문구용 */
  onText: (text: string, warnings: string[], source: "photo" | "file") => void;
};

type ApiRes = { ok: true; data: { passage: string; warnings: string[] } } | { ok: false; error: string };

/** 사진 촬영 / 파일 업로드 / 끌어다 놓기로 지문 입력 */
export default function PassageUpload({ onText }: Props) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  async function handle(list: FileList | File[] | null, source: "photo" | "file") {
    const files = Array.from(list ?? []);
    if (files.length === 0) return;
    setError(null);

    const kinds = files.map((f) => classifyFile(f.name, f.type));
    if (kinds.some((k) => k === null)) return setError("사진, PDF, TXT 파일만 올릴 수 있습니다.");
    if (new Set(kinds).size > 1) return setError("사진·PDF·TXT를 섞지 말고 한 종류만 올려 주세요.");
    const kind = kinds[0];

    // TXT 는 서버를 거치지 않고 바로 읽는다
    if (kind === "text") {
      const texts = await Promise.all(files.map((f) => f.text()));
      return onText(cleanExtractedText(texts.join("\n")), [], source);
    }
    if (kind === "pdf" && files.length > 1) return setError("PDF는 한 번에 1개만 올릴 수 있습니다.");
    if (kind === "image" && files.length > MAX_IMAGES) return setError(`사진은 한 번에 최대 ${MAX_IMAGES}장까지 올릴 수 있습니다.`);

    setBusy(true);
    try {
      const prepared = kind === "image" ? await Promise.all(files.map(compressImage)) : files;
      const size = prepared.reduce((n, f) => n + f.size, 0);
      if (size > MAX_UPLOAD_BYTES) throw new Error(`파일이 너무 큽니다 (최대 ${MAX_UPLOAD_BYTES / 1024 / 1024}MB). 지문이 있는 쪽만 남겨 올려 주세요.`);

      const form = new FormData();
      prepared.forEach((f) => form.append("files", f));
      const res = await fetch("/api/extract", { method: "POST", body: form });
      const json = (await res.json().catch(() => null)) as ApiRes | null;
      if (!json) throw new Error(`서버 응답 오류 (${res.status})`);
      if (!json.ok) throw new Error(json.error);
      onText(json.data.passage, json.data.warnings, source);
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
      className={`mt-2 rounded-lg border-2 border-dashed px-4 py-3 text-sm transition ${
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
          {busy ? "글자를 읽고 있습니다… (10~30초)" : `사진(최대 ${MAX_IMAGES}장)·PDF·TXT, 여기로 끌어다 놓아도 됩니다`}
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
