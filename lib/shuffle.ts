export type Rng = () => number;

export function randomInt(maxExclusive: number, rng: Rng = Math.random): number {
  return Math.floor(rng() * maxExclusive);
}

export function shuffled<T>(arr: readonly T[], rng: Rng = Math.random): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = randomInt(i + 1, rng);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * 선택지와 선택지별 설명을 함께 섞고, 정답 번호를 다시 계산한다.
 * LLM은 정답을 특정 번호에 몰아두는 경향이 있어서 서버에서 섞는다.
 */
export function shuffleChoices<T>(
  choices: readonly T[],
  answerIndex: number,
  notes: readonly string[],
  rng: Rng = Math.random,
): { choices: T[]; answerIndex: number; notes: string[] } {
  const order = shuffled(choices.map((_, i) => i), rng);
  return {
    choices: order.map((i) => choices[i]),
    notes: order.map((i) => notes[i] ?? ""),
    answerIndex: order.indexOf(answerIndex),
  };
}

/** 시드 고정 난수 (테스트용) */
export function seededRng(seed: number): Rng {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}
