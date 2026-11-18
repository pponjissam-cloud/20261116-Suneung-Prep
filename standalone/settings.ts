/** HTML 단독 실행판: API 키·모델을 브라우저에만 저장 */

const KEY = "suneung-anthropic-api-key";
const MODEL_KEY = "suneung-anthropic-model";
export const DEFAULT_MODEL = "claude-sonnet-5-5";

const listeners = new Set<() => void>();

export function getApiKey(): string {
  try {
    return localStorage.getItem(KEY) ?? "";
  } catch {
    return memoryKey;
  }
}

let memoryKey = "";

export function setApiKey(value: string): void {
  memoryKey = value.trim();
  try {
    if (memoryKey) localStorage.setItem(KEY, memoryKey);
    else localStorage.removeItem(KEY);
  } catch {
    /* 저장이 막힌 브라우저에서는 이 창을 닫을 때까지만 기억 */
  }
  listeners.forEach((l) => l());
}

export function getModel(): string {
  try {
    return localStorage.getItem(MODEL_KEY) || DEFAULT_MODEL;
  } catch {
    return DEFAULT_MODEL;
  }
}

export function setModel(value: string): void {
  try {
    if (value.trim() && value.trim() !== DEFAULT_MODEL) localStorage.setItem(MODEL_KEY, value.trim());
    else localStorage.removeItem(MODEL_KEY);
  } catch {
    /* 무시 */
  }
  listeners.forEach((l) => l());
}

export function onSettingsChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
