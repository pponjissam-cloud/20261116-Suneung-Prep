/**
 * HTML 단독 실행판: API 키·모델을 브라우저에만 저장.
 * 키 모양으로 회사를 알아낸다:
 *   "sk-ant-…" → Anthropic(Claude)
 *   "AQ.…"(2026년 5월부터 새로 만드는 인증 키), "AIza…"(예전 표준 키) → Google AI Studio(Gemini)
 * 모양을 모르는 키는 사용자가 회사를 직접 고른다.
 */

export type Provider = "anthropic" | "gemini";

export const PROVIDERS: Record<Provider, { name: string; defaultModel: string; keyUrl: string }> = {
  anthropic: { name: "Claude (Anthropic)", defaultModel: "claude-sonnet-5-5", keyUrl: "https://console.anthropic.com/settings/keys" },
  gemini: { name: "Gemini (Google AI Studio)", defaultModel: "gemini-3.8-flash", keyUrl: "https://aistudio.google.com/apikey" },
};

const KEY = "suneung-api-key";
const PROVIDER_KEY = "suneung-provider";
const LEGACY_KEY = "suneung-anthropic-api-key";
const modelKey = (p: Provider) => `suneung-model-${p}`;

const listeners = new Set<() => void>();
let memoryKey = "";
const memoryModel: Partial<Record<Provider, string>> = {};

/** 키 모양으로 회사 판별. 모르면 null */
export function detectProvider(key: string): Provider | null {
  const k = key.trim();
  if (k.startsWith("sk-ant-")) return "anthropic";
  if (k.startsWith("AQ.") || k.startsWith("AIza")) return "gemini";
  return null;
}

/** 예전 형식(AIza) Gemini 키인지. 2026년 9월부터 Gemini API가 거부한다 */
export function isLegacyGeminiKey(key: string): boolean {
  return key.trim().startsWith("AIza");
}

export function getApiKey(): string {
  try {
    return localStorage.getItem(KEY) ?? localStorage.getItem(LEGACY_KEY) ?? "";
  } catch {
    return memoryKey;
  }
}

let memoryProvider: Provider | null = null;

export function getProvider(): Provider {
  const detected = detectProvider(getApiKey());
  if (detected) return detected;
  try {
    const saved = localStorage.getItem(PROVIDER_KEY);
    if (saved === "anthropic" || saved === "gemini") return saved;
  } catch {
    /* 무시 */
  }
  return memoryProvider ?? "gemini";
}

/** 키를 저장한다. 모양으로 회사를 알 수 없는 키는 provider 로 회사를 정해 준다 */
export function setApiKey(value: string, provider?: Provider): void {
  memoryKey = value.trim();
  memoryProvider = provider ?? null;
  try {
    localStorage.removeItem(LEGACY_KEY);
    if (provider) localStorage.setItem(PROVIDER_KEY, provider);
    else localStorage.removeItem(PROVIDER_KEY);
    if (memoryKey) localStorage.setItem(KEY, memoryKey);
    else localStorage.removeItem(KEY);
  } catch {
    /* 저장이 막힌 브라우저에서는 이 창을 닫을 때까지만 기억 */
  }
  listeners.forEach((l) => l());
}

export function getModel(provider: Provider = getProvider()): string {
  try {
    return localStorage.getItem(modelKey(provider)) || PROVIDERS[provider].defaultModel;
  } catch {
    return memoryModel[provider] || PROVIDERS[provider].defaultModel;
  }
}

export function setModel(provider: Provider, value: string): void {
  const v = value.trim();
  memoryModel[provider] = v;
  try {
    if (v && v !== PROVIDERS[provider].defaultModel) localStorage.setItem(modelKey(provider), v);
    else localStorage.removeItem(modelKey(provider));
  } catch {
    /* 무시 */
  }
  listeners.forEach((l) => l());
}

export function onSettingsChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
