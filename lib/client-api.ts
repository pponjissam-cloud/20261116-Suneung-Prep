"use client";

import type { Difficulty, QuestionType } from "./types";

export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: string; retryable: boolean };

/** 분석 API 호출. 네트워크 오류도 ApiResult 로 돌려준다 */
export async function callAnalyze<T>(
  section: "vocabulary" | "translation" | "grammar" | "structure" | "question",
  body: { passage: string; difficulty: Difficulty; questionType?: QuestionType },
): Promise<ApiResult<T>> {
  try {
    const res = await fetch(`/api/analyze/${section}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = (await res.json().catch(() => null)) as ApiResult<T> | null;
    if (!json) return { ok: false, error: `서버 응답 오류 (${res.status})`, retryable: true };
    return json;
  } catch {
    return { ok: false, error: "네트워크 오류가 발생했습니다.", retryable: true };
  }
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
