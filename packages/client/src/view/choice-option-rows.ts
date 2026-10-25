/**
 * The rows of a "choose one" sheet (#412): every option the engine offered, and every option on the card it did not
 * offer, in the card's own order, so an option is never missing without a word. An offered row is the engine's option
 * (by its place in `choice.options`); a barred row is drawn disabled with why (`unavailableOptionReasons`). The engine's
 * option ids for a "choose one" are the option's index on the card (`<index>` or `<index>#<n>`), which places them.
 */
import type { PendingChoice } from "@mc/engine";

export type ChoiceRow =
  | { readonly kind: "option"; readonly optionIndex: number }
  | { readonly kind: "unavailable"; readonly label: string; readonly why: string };

/** The option's index on the card, from its id; null for an id that is not one (a card, a player, a place). */
const cardIndexOf = (optionId: string): number | null => {
  const index = Number(optionId.split("#")[0]);
  return Number.isInteger(index) && index >= 0 ? index : null;
};

export function choiceRowsOf(
  choice: Pick<PendingChoice, "options">,
  unavailable: readonly { readonly index: number; readonly label: string; readonly why: string }[],
): ChoiceRow[] {
  const offered = choice.options.map((option, optionIndex) => ({
    row: { kind: "option", optionIndex } as const satisfies ChoiceRow,
    at: cardIndexOf(option.optionId),
  }));
  if (unavailable.length === 0 || offered.some(({ at }) => at === null)) {
    // Not a "choose one" by index: its rows are the engine's, and a barred option goes after them.
    return [
      ...offered.map(({ row }) => row),
      ...unavailable.map(({ label, why }): ChoiceRow => ({ kind: "unavailable", label, why })),
    ];
  }
  const barred = unavailable.map(({ index, label, why }) => ({
    row: { kind: "unavailable", label, why } as const satisfies ChoiceRow,
    at: index,
  }));
  // A stable sort: options offered more than once (`allowRepeat`) keep their order.
  return [...offered, ...barred].sort((a, b) => a.at! - b.at!).map(({ row }) => row);
}
