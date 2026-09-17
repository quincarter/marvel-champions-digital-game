/**
 * What keyboard and gamepad focus moves through on the pending-choice sheet.
 *
 * The Board's route (`focus.ts`) stops at the sheet: while a decision is open
 * the Board hands input over, and until now nothing picked it up, so a player
 * on a keyboard or a pad could walk the table and then not answer the question
 * it was waiting on. Same shape as the Board's route — a pure, stated order
 * rather than whatever order the draw calls happen to run in.
 *
 * The order is the sheet's own, top to bottom: the options as they are drawn,
 * then Confirm, then Decline when declining is legal. Nothing here decides
 * which answers are legal; the options are exactly `PendingChoice.options`.
 */

import type { PendingChoice } from "@mc/engine";

export type ChoiceFocusTarget =
  | { readonly kind: "option"; readonly optionId: string }
  | { readonly kind: "confirm" }
  | { readonly kind: "decline" };

/**
 * The order a card choice draws its options in: the picked row first, in pick
 * order, then the unpicked stack in the engine's order — `ChoiceOverlay`'s two
 * rows, read left to right and top to bottom.
 */
export function cardChoiceDisplayOrder(options: PendingChoice["options"], selected: readonly string[]): readonly string[] {
  const offered = new Set(options.map((option) => option.optionId));
  return [
    ...selected.filter((optionId) => offered.has(optionId)),
    ...options.map((option) => option.optionId).filter((optionId) => !selected.includes(optionId)),
  ];
}

/**
 * The sheet's route, given the option ids in the order they are drawn. Confirm
 * takes focus even while it can't be pressed, for the same reason the Board's
 * unusable buttons do: "choose 2 to continue" is on it.
 */
export function choiceFocusOrder(shownOptionIds: readonly string[], canDecline: boolean): readonly ChoiceFocusTarget[] {
  return [
    ...shownOptionIds.map((optionId): ChoiceFocusTarget => ({ kind: "option", optionId })),
    { kind: "confirm" },
    ...(canDecline ? [{ kind: "decline" } as const] : []),
  ];
}

/**
 * What a freshly opened choice starts with selected. A lone option ("Trigger an
 * ability? · Backflip", "Choose a target · The Break-In!") starts picked, so the
 * sheet reads as the yes/no question it is: Confirm takes it, Decline doesn't.
 * Anything with more than one option starts empty — picking is the question.
 */
export function initialChoiceSelection(choice: Pick<PendingChoice, "options" | "maxSelections">): readonly string[] {
  const [only] = choice.options;
  return choice.options.length === 1 && choice.maxSelections >= 1 && only ? [only.optionId] : [];
}

/**
 * The fewest picks Confirm needs. When declining is legal the sheet already has
 * a Decline button for "none", so Confirm with nothing picked is the same answer
 * wearing the wrong label — and read in play as a Confirm that did nothing.
 */
export function confirmMinimum(choice: Pick<PendingChoice, "options" | "minSelections">): number {
  return choice.minSelections === 0 && choice.options.length > 0 ? 1 : choice.minSelections;
}

/** True when Confirm can be pressed with `selectedCount` picks. */
export function canConfirmChoice(
  choice: Pick<PendingChoice, "options" | "minSelections" | "maxSelections">,
  selectedCount: number,
): boolean {
  return selectedCount >= confirmMinimum(choice) && selectedCount <= choice.maxSelections;
}

/** One string per focusable thing on the sheet, so a rect can be looked up by what it is. */
export const choiceFocusKey = (target: ChoiceFocusTarget): string =>
  target.kind === "option" ? `option:${target.optionId}` : target.kind;

/** True when two targets name the same thing, so focus survives a rebuild — and a card moving between rows. */
export const sameChoiceTarget = (a: ChoiceFocusTarget | null, b: ChoiceFocusTarget | null): boolean =>
  a !== null && b !== null && choiceFocusKey(a) === choiceFocusKey(b);
