/**
 * What the room deck picker's details panel shows for a deck (#880; Quin, 2026-11-21): the hero and deck names, the
 * deck's stats (the same counts the deck builder and Decks & Collection draw, `view/deck-stats.ts`), the cards grouped
 * as in the builder, and the actions on offer. Plain data: nothing here judges the deck; whether it may be seated is the
 * engine's verdict already on the row.
 */
import type { CardPool } from "@mc/engine";
import {
  compositionTilesOf,
  costCurveBars,
  deckCountText,
  deckListGroupsOf,
  deckStatsOf,
  type CompositionTile,
  type CostCurveBar,
  type DeckListGroup,
} from "./deck-stats.js";
import { isCommunityDeckId } from "./community-deck-id.js";
import type { PickerRow } from "./room-deck-picker-model.js";

export interface DeckDetails {
  readonly id: string;
  readonly title: string;
  readonly heroName: string;
  /** "Justice + Protection", or "" for a deck with none. */
  readonly aspects: string;
  /** The hero's identity card id: the picture and its hover. */
  readonly cardId: string;
  /** "40 cards" or "40 cards + 2 permanent". */
  readonly countText: string;
  /** "Average cost 1.8", or null when no card has a cost. */
  readonly averageCostText: string | null;
  readonly curve: readonly CostCurveBar[];
  readonly tiles: readonly CompositionTile[];
  readonly groups: readonly DeckListGroup[];
  /** Cards in the deck this build does not know: said in words, so a short list never reads as a complete one. */
  readonly missing: number;
  readonly seatable: boolean;
  /** Its status is still being worked out. */
  readonly checking: boolean;
  readonly blockedReason: string | null;
  readonly current: boolean;
  /**
   * The deck builder action: "Edit deck" for a deck of the player's own, "Edit a copy" for a precon (the builder never
   * edits a precon in place, `view/deck-builder-model.ts`'s `editableDeckOf`).
   * Null for a tested community deck: it is only an offer, never one of the player's saved decks, so there is nothing to edit here.
   */
  readonly edit: { readonly label: string; readonly copy: boolean } | null;
}

export function deckDetailsOf(row: PickerRow, pool: CardPool): DeckDetails {
  const deck = row.option.deck;
  const stats = deckStatsOf(deck, pool);
  const copy = deck.source.kind === "precon";
  return {
    id: row.id,
    title: row.name,
    heroName: row.heroName,
    aspects: row.aspects,
    cardId: row.cardId,
    countText: deckCountText(stats),
    averageCostText: stats.averageCost === null ? null : `Average cost ${stats.averageCost.toFixed(1)}`,
    curve: costCurveBars(stats),
    tiles: compositionTilesOf(stats),
    groups: deckListGroupsOf(deck, pool),
    missing: stats.missingCardIds.length,
    seatable: row.seatable,
    checking: row.checking,
    blockedReason: row.blockedReason,
    current: row.current,
    edit: isCommunityDeckId(row.id) ? null : { label: copy ? "Edit a copy" : "Edit deck", copy },
  };
}
