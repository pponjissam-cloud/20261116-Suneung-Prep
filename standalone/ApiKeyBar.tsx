import { useEffect, useState } from "react";
import { DEFAULT_MODEL, getApiKey, getModel, onSettingsChange, setApiKey, setModel } from "./settings";

const mask = (k: string) => (k.length > 12 ? `${k.slice(0, 7)}…${k.slice(-4)}` : "••••");

/** 화면 맨 위: Anthropic API 키·모델 설정 (브라우저에만 저장) */
export default function ApiKeyBar() {
  const [key, setKey] = useState(getApiKey());
  const [model, setModelState] = useState(getModel());
  const [editing, setEditing] = useState(!getApiKey());
  const [draftKey, setDraftKey] = useState("");
  const [draftModel, setDraftModel] = useState(getModel());

  useEffect(
    () =>
      onSettingsChange(() => {
        setKey(getApiKey());
        setModelState(getModel());
      }),
    [],
  );

  if (!editing)
    return (
      <div className="no-print border-b border-[var(--line)] bg-white">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 text-xs text-[var(--muted)]">
          <span className="font-semibold text-green-700">● API 키 설정됨</span>
          <span>{mask(key)}</span>
          <span>모델: {model}</span>
          <button
            type="button"
            className="ml-auto underline"
            onClick={() => {
              setDraftKey("");
              setDraftModel(model);
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
          if (draftKey.trim()) setApiKey(draftKey);
          setModel(draftModel);
          if (draftKey.trim() || key) setEditing(false);
        }}
      >
        <p className="font-semibold">Anthropic API 키를 입력하세요</p>
        <p className="mt-1 text-xs leading-relaxed text-[var(--muted)]">
          이 파일은 서버 없이 브라우저에서 Claude를 직접 부릅니다. 키는{" "}
          <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer" className="underline">
            Anthropic 콘솔
          </a>
          에서 발급받을 수 있습니다. 입력한 키는 <b>이 브라우저에만</b> 저장되고 api.anthropic.com 으로만 보내집니다. 공용 컴퓨터에서는 다 쓴 뒤
          &lsquo;키 지우기&rsquo;를 누르세요.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <input
            type="password"
            autoComplete="off"
            value={draftKey}
            onChange={(e) => setDraftKey(e.target.value)}
            placeholder={key ? `현재 키 유지 (${mask(key)})` : "sk-ant-..."}
            className="min-w-64 flex-1 rounded border border-[var(--line)] bg-white px-3 py-1.5"
            aria-label="API 키"
          />
          <input
            value={draftModel}
            onChange={(e) => setDraftModel(e.target.value)}
            placeholder={DEFAULT_MODEL}
            className="w-48 rounded border border-[var(--line)] bg-white px-3 py-1.5"
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
      </form>
    </div>
  );
}
