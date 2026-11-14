/**
 * Cards of a not-ready pack (`NOT_READY_PACK_CODES`) kept out of the deck builder's card pool and out of deck import.
 * Option A (hide every card). To go back to option B (the cards show in the builder and import, only their heroes
 * are gated: `identityOptions` and `verdictOf`), set `HIDE_NOT_READY_CARDS` to false; nothing else changes.
 */
import { isNotReadyCard } from "@mc/cards";

export const HIDE_NOT_READY_CARDS = true;

/** True when `card` should not be offered to a player building or importing a deck. */
export const hiddenNotReadyCard = (card: { readonly setCode: string }): boolean =>
  HIDE_NOT_READY_CARDS && isNotReadyCard(card);
