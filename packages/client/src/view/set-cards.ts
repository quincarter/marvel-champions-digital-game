/** Wording for the "cards in this modular set" sheet (`scenes/set-cards.ts`). */

/** The line under the set's name: how many cards the set holds and how many are different. */
export function setCardsSubtitle(totalCards: number, different: number): string {
  return `${totalCards} cards, ${different} different. Tap a card to read it.`;
}

/** Under a card's name: the copy count when there is more than one ("x2 · Minion"), then its type. */
export function setCardCaption(copies: number, typeWord: string): string {
  return `${copies > 1 ? `x${copies} · ` : ""}${typeWord}`;
}
