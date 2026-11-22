/**
 * One `DeckOption` (`view/deck-list-model.ts`) reduced to what the Decks
 * screen's status chip shows: a short label and which of the design's signal
 * hues it reads in. Every fact behind it — legal, seatable, unscripted, pool
 * moved — already came from the engine (`validateDeck`/`unscriptedCards`);
 * this only picks the words and the tone, never a rule.
 */
import { CHECKING_REASON, NOT_LEGAL_REASON, NOT_READY_REASON, type DeckOption } from "./deck-list-model.js";
import { t, type MessageKey } from "../i18n/translate.js";
import type { CardLanguage } from "../art/card-language.js";

export type DeckStatusTone = "legal" | "illegal" | "unscripted" | "poolChanged";

const REASON_KEYS: Readonly<Record<string, MessageKey>> = {
  [NOT_READY_REASON]: "deckStatus.notReady",
  [CHECKING_REASON]: "deckStatus.checkingDeck",
  [NOT_LEGAL_REASON]: "deckStatus.notLegal",
};

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
export function deckStatusOf(option: DeckOption, lang: CardLanguage = "en"): DeckStatus {
  if (option.checking) return { text: t("deckStatus.checking", undefined, lang), tone: "poolChanged" };
  if (option.blockedReason === NOT_READY_REASON)
    return { text: reasonLabelOf(NOT_READY_REASON, lang), tone: "illegal" };
  if (!option.legal) return { text: t("deckStatus.illegal", undefined, lang), tone: "illegal" };
  // Every legal deck can be seated and played (`DeckOption.seatable` is `legal` alone). What an unscripted card
  // costs the player is that one card's ability doing nothing — not the deck being unplayable, which is what this
  // chip used to claim.
  if (option.unscripted.length > 0) return { text: t("deckStatus.partly", undefined, lang), tone: "unscripted" };
  if (option.poolChanged) return { text: t("deckStatus.poolChanged", undefined, lang), tone: "poolChanged" };
  return { text: t("deckStatus.legal", undefined, lang), tone: "legal" };
}

/** The short tag a blocked hero tile on Take your seats wears: "NOT READY" for a not-ready hero, else "AT THE TABLE" (a duplicate hero). */
/**
 * A deck's blocked reason in the player's language, for display only: the canonical English reasons
 * (`NOT_READY_REASON`, the checking and not-legal fallbacks) stay the values code compares. Any other reason (an
 * engine legality message, a lock caption already worded by its own catalog) passes through as it is.
 */
export function reasonLabelOf(reason: string, lang: CardLanguage = "en"): string {
  const key = REASON_KEYS[reason];
  return key ? t(key, undefined, lang) : reason;
}

export const blockedTagOf = (blockedBy: string): string =>
  blockedBy === NOT_READY_REASON ? t("seats.notReadyTag") : t("seats.atTableTag");
