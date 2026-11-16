export type TaskStatus = { state: "loading" | "success" | "error"; error?: string; retryable?: boolean };

type Props = {
  title: string;
  status?: TaskStatus;
  onRetry: () => void;
  children?: React.ReactNode;
};

/** 섹션 제목 + 로딩/오류/다시 생성 처리 */
export default function SectionShell({ title, status, onRetry, children }: Props) {
  const hasContent = Boolean(children);
  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-bold">{title}</h2>
        {status?.state !== "loading" && (
          <button type="button" onClick={onRetry} className="no-print text-xs text-[var(--muted)] underline">
            다시 생성
          </button>
        )}
      </div>
      {status?.state === "loading" && <Loading />}
      {status?.state === "error" && <ErrorBox message={status.error} onRetry={status.retryable === false ? undefined : onRetry} />}
      {status?.state !== "loading" && hasContent && children}
      {!status && !hasContent && <p className="text-sm text-[var(--muted)]">아직 생성되지 않았습니다.</p>}
    </section>
  );
}

export function Loading({ label = "AI가 분석하고 있습니다…" }: { label?: string }) {
  return (
    <div className="no-print flex items-center gap-2 py-6 text-sm text-[var(--muted)]">
      <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-[var(--accent)] border-t-transparent" />
      {label}
    </div>
  );
}

export function ErrorBox({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <div className="no-print rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
      {message ?? "오류가 발생했습니다."}
      {onRetry && (
        <button type="button" onClick={onRetry} className="ml-3 font-semibold underline">
          다시 시도
        </button>
      )}
    </div>
  );
}
