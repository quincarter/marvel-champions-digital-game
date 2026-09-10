/**
 * Seeded PRNG (mulberry32). The whole engine is deterministic, so this state
 * lives in `GameState` and every consumer threads the next state back.
 */
export interface RngState {
  readonly value: number;
  /** Number of draws taken so far, purely for inspection/debugging. */
  readonly draws: number;
}

export const createRng = (seed: number): RngState => ({ value: seed >>> 0, draws: 0 });

export function nextUint32(rng: RngState): readonly [number, RngState] {
  const t = (rng.value + 0x6d2b79f5) >>> 0;
  let r = t;
  r = Math.imul(r ^ (r >>> 15), r | 1);
  r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
  const out = (r ^ (r >>> 14)) >>> 0;
  return [out, { value: t, draws: rng.draws + 1 }];
}

export function nextInt(rng: RngState, maxExclusive: number): readonly [number, RngState] {
  if (maxExclusive <= 1) return [0, rng];
  const [raw, next] = nextUint32(rng);
  return [raw % maxExclusive, next];
}

export function shuffle<T>(items: readonly T[], rng: RngState): readonly [readonly T[], RngState] {
  const out = [...items];
  let current = rng;
  for (let i = out.length - 1; i > 0; i--) {
    const [j, next] = nextInt(current, i + 1);
    current = next;
    const a = out[i] as T;
    const b = out[j] as T;
    out[i] = b;
    out[j] = a;
  }
  return [out, current];
}
