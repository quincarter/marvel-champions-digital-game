/**
 * One `DeckOption` (`view/deck-list-model.ts`) reduced to what the Decks
 * screen's status chip shows: a short label and which of the design's signal
 * hues it reads in. Every fact behind it — legal, seatable, unscripted, pool
 * moved — already came from the engine (`validateDeck`/`unscriptedCards`);
 * this only picks the words and the tone, never a rule.
 */
import type { DeckOption } from "./deck-list-model.js";

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
  if (!option.legal) return { text: "Illegal", tone: "illegal" };
  if (option.unscripted.length > 0) return { text: "Not playable yet", tone: "unscripted" };
  if (option.poolChanged) return { text: "Pool changed", tone: "poolChanged" };
  return { text: "Legal", tone: "legal" };
}
