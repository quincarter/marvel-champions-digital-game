/**
 * The wave 6 (cycle 6, Mutant Genesis) card pool: every playable card through wave 5 (`PLAYABLE_CARDS`) plus the
 * wave 6 packs' card data: the Mutant Genesis box (`mut_gen`), the six X-Men hero packs (`cyclops`, `phoenix`,
 * `wolv`, `storm`, `gambit`, `rogue`) and MojoMania (`mojo`).
 *
 * `@mc/content` does not wire these into `PLAYABLE_CARDS` yet (docs/phase7-wave6.md §8: pool wiring is a later pass),
 * so this file appends them itself. **When `PLAYABLE_CARDS` grows these packs, delete the spread below** or every
 * wave 6 card is double-counted (the `wave5/cards.ts` docblock's warning).
 */
import {
  CYCLOPS_CARDS,
  GAMBIT_CARDS,
  MOJO_CARDS,
  MUT_GEN_CARDS,
  PHOENIX_CARDS,
  PLAYABLE_CARDS,
  ROGUE_CARDS,
  STORM_CARDS,
  WOLV_CARDS,
  type AnyCard,
} from "@mc/content";

/** Every card the wave 6 scenarios and decks can name, each exactly once. */
export const WAVE6_CARDS: readonly AnyCard[] = [
  ...PLAYABLE_CARDS,
  ...MUT_GEN_CARDS,
  ...CYCLOPS_CARDS,
  ...PHOENIX_CARDS,
  ...WOLV_CARDS,
  ...STORM_CARDS,
  ...GAMBIT_CARDS,
  ...ROGUE_CARDS,
  ...MOJO_CARDS,
];
