import type { DeckContents } from "@mc/content";

/**
 * A 'Pool QA fixture deck: `DeckContents` (what `validateDeck` and a game seat take) plus a short name and the idea of
 * the deck. Quantities count the identity set too (the hero's own lines come first in every list).
 */
export interface PoolFixture extends DeckContents {
  readonly id: string;
  readonly name: string;
  readonly idea: string;
}
