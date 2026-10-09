/**
 * The wave 9 (cycle 9) card pool: every earlier playable card plus the six wave 9 packs (`aos`, `bp`, `silk`, `falcon`,
 * `winter`, `tt`). `@mc/content`'s `PLAYABLE_CARDS` lists them, so this is the playable pool itself (like
 * `../wave8/cards.ts`).
 */
import { PLAYABLE_CARDS, type AnyCard } from "@mc/content";

/** Every card the wave 9 scenarios and decks can name, each exactly once. */
export const WAVE9_CARDS: readonly AnyCard[] = PLAYABLE_CARDS;
