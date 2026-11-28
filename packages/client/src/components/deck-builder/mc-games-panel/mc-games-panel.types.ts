import type { GamesAgainstModel } from "../mc-games-against/mc-games-against.types.js";
import type { GamesSectionModel } from "../mc-games-section/mc-games-section.types.js";

/**
 * "From your games" (issue #529, C2): how this hero's finished games go, cards in this deck that rarely come out (Cut), cards
 * won with on this hero that the deck may take (Add), the Against block, and the staples to keep. Suggestions only.
 */
export interface GamesPanelModel {
  /** While the games are still being read: just this line. */
  readonly reading: string | null;
  readonly headline: string | null;
  readonly insight: string | null;
  /** Cut and Try, above the Against block. */
  readonly first: readonly GamesSectionModel[];
  /** Null when there is no room for it (never now) or no games. */
  readonly against: GamesAgainstModel | null;
  /** What won and lost against the villain, then the cards to keep. */
  readonly then: readonly GamesSectionModel[];
  /** "Nothing stands out" under the Against sections. */
  readonly nothing: string | null;
  readonly note: string | null;
}
