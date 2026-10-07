/**
 * The wave 7 (cycle 7, NeXt Evolution) card pool: `@mc/content`'s `PLAYABLE_CARDS` already includes every wave 7 pack
 * (`next_evol`, `psylocke`, `angel`, `x23`, `deadpool`), so this is a plain alias, as `wave6/cards.ts` is. Do not
 * re-add a per-pack spread here: every wave 7 card would be counted twice.
 */
import { PLAYABLE_CARDS, type AnyCard } from "@mc/content";

/** Every card the wave 7 scenarios and decks can name, each exactly once. */
export const WAVE7_CARDS: readonly AnyCard[] = PLAYABLE_CARDS;
