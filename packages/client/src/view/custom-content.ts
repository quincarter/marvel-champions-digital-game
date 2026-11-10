/**
 * What marks content from an installed custom pack (docs/custom-content-packs.md §7.4, §11.6): the small "Custom" badge a
 * tile carries, and the one rule that keeps such a deck off MarvelCDB export. Pure functions of card codes, so the
 * screens ask these rather than each testing for `x.` themselves.
 */
import { isCustomCardCode, type Deck } from "@mc/content";

/** The badge's words: a text label, never color alone. */
export const CUSTOM_BADGE = "CUSTOM";

/** Why a deck with custom cards cannot be exported (the button's `reason`). */
export const CUSTOM_EXPORT_REASON = "This deck has custom pack cards, which MarvelCDB does not know.";

/** Whether a card code belongs to an installed custom pack. */
export const isCustomCard = (code: string): boolean => isCustomCardCode(code);

/** A deck that names a custom pack's hero or any of its cards. */
export function deckUsesCustomCards(deck: Pick<Deck, "identityCardId" | "cards">): boolean {
  return (
    isCustomCardCode(deck.identityCardId as string) ||
    deck.cards.some((entry) => isCustomCardCode(entry.cardId as string))
  );
}

/** The badge a deck's tile carries: for a deck with a custom hero or custom cards, else null. */
export function customBadgeOf(deck: Pick<Deck, "identityCardId" | "cards">): string | null {
  return deckUsesCustomCards(deck) ? CUSTOM_BADGE : null;
}

/** The badge for a lone card or hero identity. */
export const customCardBadgeOf = (code: string): string | null => (isCustomCardCode(code) ? CUSTOM_BADGE : null);

/** Whether a deck may be offered to MarvelCDB export (§7.4): not with any custom card in it. */
export const canExportToMarvelCdb = (deck: Pick<Deck, "identityCardId" | "cards">): boolean =>
  !deckUsesCustomCards(deck);
