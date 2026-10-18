/**
 * The wave 11 (cycle 11) card pool: every earlier playable card plus the Jessica Jones (`jj`) and Luke Cage
 * (`luke_cage`) hero packs. `@mc/content`'s `PLAYABLE_CARDS` lists them, so this is the playable pool itself (like
 * `../wave10/cards.ts`). `fne` (Fear No Evil) is in the pool too.
 */
import { PLAYABLE_CARDS, type AnyCard } from "@mc/content";

/** Every card the wave 11 scenarios and decks can name, each exactly once. */
export const WAVE11_CARDS: readonly AnyCard[] = PLAYABLE_CARDS;
