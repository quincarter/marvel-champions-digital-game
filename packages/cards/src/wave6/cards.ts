/**
 * The wave 6 (cycle 6, Mutant Genesis) card pool: `@mc/content`'s `PLAYABLE_CARDS` now includes every wave 6 pack
 * (`mut_gen`, `cyclops`, `phoenix`, `wolv`, `storm`, `mojo`, `gambit`, `rogue`), so this is a plain alias, as
 * `wave5/cards.ts` is. Do not re-add a per-pack spread here: every wave 6 card would be counted twice.
 */
import { PLAYABLE_CARDS, type AnyCard } from "@mc/content";

/** Every card the wave 6 scenarios and decks can name, each exactly once. */
export const WAVE6_CARDS: readonly AnyCard[] = PLAYABLE_CARDS;
