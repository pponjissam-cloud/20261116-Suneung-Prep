"use client";

import type { ExtractedPassage } from "./passages";
import type { Difficulty, QuestionType } from "./types";

export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: string; retryable: boolean; retryAfterSec?: number };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** fetch → ApiResult. 요청 한도(429)에 걸리면 기다렸다가 최대 3번 다시 보낸다 */
async function post<T>(url: string, init: RequestInit): Promise<ApiResult<T>> {
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetch(url, { method: "POST", ...init });
      const json = (await res.json().catch(() => null)) as ApiResult<T> | null;
      if (res.status === 429 && attempt < 3) {
        const wait = json && !json.ok && json.retryAfterSec ? json.retryAfterSec : 20;
        await sleep((wait + 1) * 1000);
        continue;
      }
      if (!json) return { ok: false, error: `서버 응답 오류 (${res.status})`, retryable: true };
      return json;
    } catch {
      return { ok: false, error: "네트워크 오류가 발생했습니다.", retryable: true };
    }
  }
}

/** 분석 API 호출 */
export function callAnalyze<T>(
  section: "vocabulary" | "translation" | "grammar" | "structure" | "question",
  body: { passage: string; difficulty: Difficulty; questionType?: QuestionType },
): Promise<ApiResult<T>> {
  return post<T>(`/api/analyze/${section}`, {
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export type ExtractResponse = { passages: ExtractedPassage[]; warnings: string[] };

/** 사진·PDF(files) 또는 긴 텍스트(text)에서 지문 목록 추출 */
export function callExtract(form: FormData): Promise<ApiResult<ExtractResponse>> {
  return post<ExtractResponse>("/api/extract", { body: form });
}

/** 동시에 limit 개까지만 실행 (rate limit·API 부하 방지) */
export async function runPool(tasks: (() => Promise<void>)[], limit = 4): Promise<void> {
  let next = 0;
  const worker = async () => {
    while (next < tasks.length) {
      const i = next++;
      await tasks[i]();
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, worker));
}
