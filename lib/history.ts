"use client";

import type { AnalysisResult, Difficulty, QuestionType } from "./types";

/** 생성 요청 (입력 화면 → 결과 화면 전달용) */
export type JobRequest = {
  passage: string;
  questionTypes: QuestionType[];
  difficulty: Difficulty;
};

export type HistoryEntry = {
  id: string;
  createdAt: string;
  preview: string;
  request: JobRequest;
  result: AnalysisResult;
};

const HISTORY_KEY = "suneung-history";
const JOB_PREFIX = "suneung-job:";
const MAX_HISTORY = 10;

// 브라우저 저장소는 사생활 보호 모드 등에서 예외를 던질 수 있어 모두 try/catch 로 감싼다

export function saveJob(id: string, req: JobRequest): void {
  try {
    sessionStorage.setItem(JOB_PREFIX + id, JSON.stringify(req));
  } catch {
    /* 저장 실패 시 결과 화면에서 안내 */
  }
}

export function loadJob(id: string): JobRequest | null {
  try {
    const raw = sessionStorage.getItem(JOB_PREFIX + id);
    return raw ? (JSON.parse(raw) as JobRequest) : null;
  } catch {
    return null;
  }
}

export function listHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? (JSON.parse(raw) as HistoryEntry[]) : [];
  } catch {
    return [];
  }
}

export function getHistory(id: string): HistoryEntry | null {
  return listHistory().find((h) => h.id === id) ?? null;
}

export function saveHistory(entry: Omit<HistoryEntry, "preview" | "createdAt"> & { createdAt?: string }): void {
  try {
    const full: HistoryEntry = {
      ...entry,
      createdAt: entry.createdAt ?? new Date().toISOString(),
      preview: entry.request.passage.slice(0, 50),
    };
    const rest = listHistory().filter((h) => h.id !== entry.id);
    localStorage.setItem(HISTORY_KEY, JSON.stringify([full, ...rest].slice(0, MAX_HISTORY)));
  } catch {
    /* 저장 공간 부족 등은 무시 */
  }
}

export function deleteHistory(id: string): void {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(listHistory().filter((h) => h.id !== id)));
  } catch {
    /* 무시 */
  }
}
