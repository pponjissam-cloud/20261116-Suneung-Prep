"use client";

import type { PassageInput } from "./passages";
import type { AnalysisResult, Difficulty, QuestionType } from "./types";

/** 생성 요청 (입력 화면 → 결과 화면 전달용) */
export type JobRequest = {
  passages: PassageInput[];
  questionTypes: QuestionType[];
  difficulty: Difficulty;
};

export type HistoryEntry = {
  id: string;
  createdAt: string;
  preview: string;
  request: JobRequest;
  /** 지문 ID → 분석 결과 */
  results: Record<string, AnalysisResult>;
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

type LegacyEntry = {
  id: string;
  createdAt: string;
  preview: string;
  request: { passage: string; questionTypes: QuestionType[]; difficulty: Difficulty };
  result: AnalysisResult;
};

/** 지문 1개만 지원하던 예전 기록을 새 형식으로 바꾼다 */
export function migrateEntry(e: HistoryEntry | LegacyEntry): HistoryEntry {
  if ("results" in e) return e;
  return {
    id: e.id,
    createdAt: e.createdAt,
    preview: e.preview,
    request: {
      passages: [{ id: "p1", label: "지문 1", text: e.request.passage }],
      questionTypes: e.request.questionTypes,
      difficulty: e.request.difficulty,
    },
    results: { p1: e.result },
  };
}

export function listHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? (JSON.parse(raw) as (HistoryEntry | LegacyEntry)[]).map(migrateEntry) : [];
  } catch {
    return [];
  }
}

export function getHistory(id: string): HistoryEntry | null {
  return listHistory().find((h) => h.id === id) ?? null;
}

export function previewOf(req: JobRequest): string {
  const first = req.passages[0]?.text.slice(0, 50) ?? "";
  return req.passages.length > 1 ? `[지문 ${req.passages.length}개] ${first}` : first;
}

export function saveHistory(entry: Omit<HistoryEntry, "preview" | "createdAt"> & { createdAt?: string }): void {
  const full: HistoryEntry = {
    ...entry,
    createdAt: entry.createdAt ?? new Date().toISOString(),
    preview: previewOf(entry.request),
  };
  let list = [full, ...listHistory().filter((h) => h.id !== entry.id)].slice(0, MAX_HISTORY);
  // 지문이 많으면 저장 공간(약 5MB)이 모자랄 수 있다 → 오래된 기록부터 지우며 다시 시도
  while (list.length > 0) {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(list));
      return;
    } catch {
      if (list.length === 1) return;
      list = list.slice(0, -1);
    }
  }
}

export function deleteHistory(id: string): void {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(listHistory().filter((h) => h.id !== id)));
  } catch {
    /* 무시 */
  }
}
