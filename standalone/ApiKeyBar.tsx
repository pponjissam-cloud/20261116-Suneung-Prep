import { useEffect, useState } from "react";
import { PROVIDERS, detectProvider, getApiKey, getModel, getProvider, isLegacyGeminiKey, onSettingsChange, setApiKey, setModel, type Provider } from "./settings";

const mask = (k: string) => (k.length > 12 ? `${k.slice(0, 6)}…${k.slice(-4)}` : "••••");

/** 화면 맨 위: API 키(Claude 또는 Gemini)·모델 설정. 브라우저에만 저장 */
export default function ApiKeyBar() {
  const [key, setKey] = useState(getApiKey());
  const [editing, setEditing] = useState(!getApiKey());
  const [draftKey, setDraftKey] = useState("");
  const [draftModel, setDraftModel] = useState("");
  const [error, setError] = useState<string | null>(null);
  /** 모양으로 회사를 알 수 없는 키일 때 사용자가 고른 회사 */
  const [manual, setManual] = useState<Provider | null>(null);
  const [, force] = useState(0);

  useEffect(
    () =>
      onSettingsChange(() => {
        setKey(getApiKey());
        force((n) => n + 1);
      }),
    [],
  );

  const provider = getProvider();
  // 입력 중인 키 모양으로 회사를 미리 보여 준다 (비어 있으면 현재 저장된 키 기준)
  const unknownShape = Boolean(draftKey.trim()) && !detectProvider(draftKey);
  const draftProvider = draftKey.trim() ? (detectProvider(draftKey) ?? manual) : key ? provider : null;

  if (!editing)
    return (
      <div className="no-print border-b border-[var(--line)] bg-white">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 text-xs text-[var(--muted)]">
          <span className="font-semibold text-green-700">● {PROVIDERS[provider].name}</span>
          <span>{mask(key)}</span>
          <span>모델: {getModel(provider)}</span>
          {isLegacyGeminiKey(key) && <span className="font-semibold text-amber-700">⚠ 예전 형식(AIza) 키라 거부될 수 있습니다. 새 키(AQ.…)로 바꾸세요.</span>}
          <button
            type="button"
            className="ml-auto underline"
            onClick={() => {
              setDraftKey("");
              setDraftModel(getModel(provider));
              setError(null);
              setEditing(true);
            }}
          >
            변경
          </button>
        </div>
      </div>
    );

  return (
    <div className="no-print border-b border-amber-200 bg-amber-50">
      <form
        className="mx-auto max-w-4xl px-4 py-4 text-sm"
        onSubmit={(e) => {
          e.preventDefault();
          const newKey = draftKey.trim();
          if (newKey && !detectProvider(newKey) && !manual) {
            setError("이 키가 어느 회사 키인지 아래에서 골라 주세요.");
            return;
          }
          const p = newKey ? (detectProvider(newKey) ?? manual!) : provider;
          if (newKey) setApiKey(newKey, detectProvider(newKey) ? undefined : p);
          // 회사가 바뀌었는데 모델 칸이 다른 회사 모델이면 기본값으로
          const m = draftModel.trim();
          const fits = p === "gemini" ? m.startsWith("gemini") : m.startsWith("claude");
          setModel(p, m && fits ? m : PROVIDERS[p].defaultModel);
          if (newKey || key) setEditing(false);
        }}
      >
        <p className="font-semibold">AI API 키를 입력하세요</p>
        <p className="mt-1 text-xs leading-relaxed text-[var(--muted)]">
          이 파일은 서버 없이 브라우저에서 AI를 직접 부릅니다. 둘 중 하나의 키를 넣으세요:{" "}
          <a href={PROVIDERS.gemini.keyUrl} target="_blank" rel="noreferrer" className="underline">
            Google AI Studio (Gemini, AQ.…)
          </a>{" "}
          또는{" "}
          <a href={PROVIDERS.anthropic.keyUrl} target="_blank" rel="noreferrer" className="underline">
            Anthropic (Claude, sk-ant-…)
          </a>
          . 키는 <b>이 브라우저에만</b> 저장되고 해당 회사 API로만 보내집니다. 공용 기기에서는 다 쓴 뒤 &lsquo;키 지우기&rsquo;를 누르세요.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <input
            type="password"
            autoComplete="off"
            value={draftKey}
            onChange={(e) => {
              setDraftKey(e.target.value);
              setError(null);
              setManual(null);
              const p = detectProvider(e.target.value);
              if (p) setDraftModel(getModel(p));
            }}
            placeholder={key ? `현재 키 유지 (${mask(key)})` : "AQ.… (Gemini) 또는 sk-ant-… (Claude)"}
            className="min-w-0 flex-[1_1_16rem] rounded border border-[var(--line)] bg-white px-3 py-1.5"
            aria-label="API 키"
          />
          <input
            value={draftModel}
            onChange={(e) => setDraftModel(e.target.value)}
            placeholder={draftProvider ? PROVIDERS[draftProvider].defaultModel : "모델 (자동)"}
            className="w-48 min-w-0 flex-[1_1_10rem] rounded border border-[var(--line)] bg-white px-3 py-1.5"
            aria-label="모델"
          />
          <button type="submit" className="rounded bg-[var(--accent)] px-4 py-1.5 font-semibold text-white">
            저장
          </button>
          {key && (
            <>
              <button type="button" className="rounded border border-[var(--line)] bg-white px-3 py-1.5" onClick={() => setEditing(false)}>
                취소
              </button>
              <button
                type="button"
                className="rounded px-3 py-1.5 text-red-600 underline"
                onClick={() => {
                  setApiKey("");
                  setDraftKey("");
                }}
              >
                키 지우기
              </button>
            </>
          )}
        </div>
        {unknownShape && (
          <fieldset className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
            <legend className="mb-1 font-semibold">처음 보는 모양의 키입니다. 어느 회사 키인가요?</legend>
            {(["gemini", "anthropic"] as const).map((p) => (
              <label key={p} className="flex items-center gap-1.5">
                <input type="radio" name="provider" checked={manual === p} onChange={() => { setManual(p); setDraftModel(getModel(p)); setError(null); }} />
                {PROVIDERS[p].name}
              </label>
            ))}
          </fieldset>
        )}
        {draftProvider && !error && <p className="mt-2 text-xs text-green-700">✓ {PROVIDERS[draftProvider].name} 키로 인식했습니다.</p>}
        {isLegacyGeminiKey(draftKey || key) && (
          <p className="mt-1 text-xs font-semibold text-amber-700">
            ⚠ AIza로 시작하는 예전 형식 키는 2026년 9월부터 Gemini에서 거부됩니다. AI Studio에서 새 키(AQ.로 시작)를 만들어 넣으세요.
          </p>
        )}
        {error && <p className="mt-2 text-xs font-semibold text-red-600">{error}</p>}
      </form>
    </div>
  );
}
