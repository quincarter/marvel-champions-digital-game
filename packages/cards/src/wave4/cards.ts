/**
 * The wave 4 (cycle 4) card pool: every wave 3 playable card, plus the Nebula (`nebu`) hero pack — the first wave 4
 * pack scripted (docs/phase7-wave4.md). `@mc/content` does not fold `nebu` into `PLAYABLE_CARDS` yet (wiring a new
 * wave into the shared playable pool happens once for the whole wave, not per pack), so this pool concatenates it
 * itself the same way `wave3/setup.ts`'s own docblock describes for `WAVE3_CARDS`: `NEBU_CARDS` shares no cards
 * with `WAVE3_CARDS`, so nothing here is double-counted.
 */
import { MTS_CARDS, NEBU_CARDS, PLAYABLE_CARDS, WARM_CARDS, type AnyCard } from "@mc/content";

/** Every playable card through wave 3, plus Nebula, War Machine and The Mad Titan's Shadow. */
export const WAVE4_CARDS: readonly AnyCard[] = [...PLAYABLE_CARDS, ...NEBU_CARDS, ...WARM_CARDS, ...MTS_CARDS];
