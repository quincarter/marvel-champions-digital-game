/**
 * What the room deck picker's details panel shows for a deck (#880; Quin, 2026-11-21): the hero and deck names, the
 * deck's stats (the same counts the deck builder and Decks & Collection draw, `view/deck-stats.ts`), the cards grouped
 * as in the builder, and the actions on offer. Plain data: nothing here judges the deck; whether it may be seated is the
 * engine's verdict already on the row.
 */
import type { CardPool } from "@mc/engine";
import { artLanguageNow } from "../art/art-source.js";
import type { CardLanguage } from "../art/card-language.js";
import { t } from "../i18n/translate.js";
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

/** "Average cost 1.8" with the language's own decimal mark ("Coste medio 1,8"). */
export function averageCostText(average: number, lang: CardLanguage): string {
  const avg = new Intl.NumberFormat(lang, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(average);
  return t("deckPicker.averageCost", { avg }, lang);
}

export function deckDetailsOf(row: PickerRow, pool: CardPool): DeckDetails {
  const deck = row.option.deck;
  const stats = deckStatsOf(deck, pool);
  const copy = deck.source.kind === "precon";
  // Every word the panel shows follows the card language, as the rest of the screen does.
  const lang = artLanguageNow();
  return {
    id: row.id,
    title: row.name,
    heroName: row.heroName,
    aspects: row.aspects,
    cardId: row.cardId,
    countText: deckCountText(stats, lang),
    averageCostText: stats.averageCost === null ? null : averageCostText(stats.averageCost, lang),
    curve: costCurveBars(stats),
    tiles: compositionTilesOf(stats, lang),
    groups: deckListGroupsOf(deck, pool, undefined, true, lang),
    missing: stats.missingCardIds.length,
    seatable: row.seatable,
    checking: row.checking,
    blockedReason: row.blockedReason,
    current: row.current,
    edit: isCommunityDeckId(row.id) ? null : { label: t(copy ? "room.picker.editCopy" : "room.picker.edit"), copy },
  };
}
