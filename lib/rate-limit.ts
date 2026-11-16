/**
 * 메모리 기반 간단한 고정 창 rate limit (서버 인스턴스 1개 기준).
 * 지문 1건 생성에 섹션 4개 + 문제 유형 수만큼 요청이 나가므로, 요청 단위로 넉넉히 잡는다.
 * 여러 인스턴스로 배포한다면 Redis(Upstash 등)로 바꾸세요.
 */
const WINDOW_MS = 60_000;
const LIMIT = Number(process.env.RATE_LIMIT_PER_MINUTE ?? 40);

const hits = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(key: string, now = Date.now()): { ok: boolean; retryAfterSec: number } {
  const entry = hits.get(key);
  if (!entry || entry.resetAt <= now) {
    hits.set(key, { count: 1, resetAt: now + WINDOW_MS });
    if (hits.size > 5000) for (const [k, v] of hits) if (v.resetAt <= now) hits.delete(k);
    return { ok: true, retryAfterSec: 0 };
  }
  entry.count++;
  return { ok: entry.count <= LIMIT, retryAfterSec: Math.ceil((entry.resetAt - now) / 1000) };
}
