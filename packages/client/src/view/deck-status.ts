/**
 * One `DeckOption` (`view/deck-list-model.ts`) reduced to what the Decks
 * screen's status chip shows: a short label and which of the design's signal
 * hues it reads in. Every fact behind it — legal, seatable, unscripted, pool
 * moved — already came from the engine (`validateDeck`/`unscriptedCards`);
 * this only picks the words and the tone, never a rule.
 */
import { NOT_READY_REASON, type DeckOption } from "./deck-list-model.js";

export type DeckStatusTone = "legal" | "illegal" | "unscripted" | "poolChanged";

export interface DeckStatus {
  readonly text: string;
  readonly tone: DeckStatusTone;
}

/**
 * Priority order when more than one is true: illegal is the only one that
 * blocks *editing* meaningfully being about something else, then unscripted
 * (legal but this build can't play it yet), then a pool-version change worth
 * flagging even on an otherwise-fine deck, then plain legal.
 */
export function deckStatusOf(option: DeckOption): DeckStatus {
  if (option.checking) return { text: "Checking…", tone: "poolChanged" };
  if (option.blockedReason === NOT_READY_REASON) return { text: NOT_READY_REASON, tone: "illegal" };
  if (!option.legal) return { text: "Illegal", tone: "illegal" };
  // Every legal deck can be seated and played (`DeckOption.seatable` is `legal` alone). What an unscripted card
  // costs the player is that one card's ability doing nothing — not the deck being unplayable, which is what this
  // chip used to claim.
  if (option.unscripted.length > 0) return { text: "Partly playable", tone: "unscripted" };
  if (option.poolChanged) return { text: "Pool changed", tone: "poolChanged" };
  return { text: "Legal", tone: "legal" };
}

/** The short tag a blocked hero tile on Take your seats wears: "NOT READY" for a not-ready hero, else "AT THE TABLE" (a duplicate hero). */
export const blockedTagOf = (blockedBy: string): string =>
  blockedBy === NOT_READY_REASON ? "NOT READY" : "AT THE TABLE";
