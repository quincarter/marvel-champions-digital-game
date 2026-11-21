/**
 * What the decision sheet offers when it could not draw a decision (#943): a draw that throws (a pack card whose data
 * the sheet cannot read) used to leave the sheet torn down with the engine still waiting on the answer, so nothing on
 * the screen could be pressed. The sheet records the error and draws a plain list instead, built only from the engine's
 * own options and labels, so the player still makes the decision and the game can always go on.
 *
 * A pick of one answers on the press. Anything else toggles options and answers with Confirm once the count is legal;
 * Choose none answers at once when the decision allows none. When the order of the picks is the answer, each pick is
 * numbered in the order it was made and a tap again takes it out. The list pages when it outruns the screen.
 */
import type { PendingChoice } from "@mc/engine";

export interface FallbackOptionRow {
  readonly optionId: string;
  readonly label: string;
  readonly selected: boolean;
  /** Its place in the answer (1 first) when the order of the picks is the answer; null otherwise or unpicked. */
  readonly order: number | null;
}

export interface FallbackChoiceView {
  readonly rows: readonly FallbackOptionRow[];
  /** One press answers: the decision takes exactly one option. */
  readonly answersOnPress: boolean;
  /** Confirm is offered (several may be picked) and enabled when the count is legal. */
  readonly confirm: { readonly enabled: boolean; readonly label: string } | null;
  /** "Choose none" answers with nothing: offered only when the decision allows none. */
  readonly canChooseNone: boolean;
  /** The order of the picks is the answer: say so, and number each pick (a tap again takes it out). */
  readonly ordered: boolean;
}

const labelOf = (option: PendingChoice["options"][number]): string =>
  typeof option.label === "string" && option.label.trim() !== "" ? option.label : option.optionId;

export function fallbackChoiceView(
  choice: Pick<PendingChoice, "options" | "minSelections" | "maxSelections"> & Partial<Pick<PendingChoice, "ordered">>,
  selected: readonly string[],
): FallbackChoiceView {
  const answersOnPress = choice.maxSelections === 1 && choice.minSelections <= 1;
  const picked = new Set(selected);
  const rows = choice.options.map((option) => ({
    optionId: option.optionId,
    label: labelOf(option),
    selected: !answersOnPress && picked.has(option.optionId),
    order:
      !answersOnPress && choice.ordered && picked.has(option.optionId) ? selected.indexOf(option.optionId) + 1 : null,
  }));
  const count = rows.filter((row) => row.selected).length;
  return {
    rows,
    answersOnPress,
    confirm: answersOnPress
      ? null
      : {
          enabled: count >= Math.max(1, choice.minSelections) && count <= choice.maxSelections,
          label: `Confirm (${count} of ${choice.minSelections === choice.maxSelections ? choice.maxSelections : `${choice.minSelections}-${choice.maxSelections}`})`,
        },
    canChooseNone: choice.minSelections === 0,
    ordered: !answersOnPress && choice.ordered === true,
  };
}

/** The selection after a press on `optionId`: toggled, never beyond the decision's maximum. */
export function toggleFallbackPick(
  choice: Pick<PendingChoice, "maxSelections">,
  selected: readonly string[],
  optionId: string,
): readonly string[] {
  if (selected.includes(optionId)) return selected.filter((id) => id !== optionId);
  return selected.length >= choice.maxSelections ? selected : [...selected, optionId];
}

/** How many option rows fit on a page of `room` pixels, and how many pages `count` rows need. */
export function fallbackPages(count: number, room: number, rowHeight: number): { perPage: number; pages: number } {
  const perPage = Math.max(1, Math.floor(room / rowHeight));
  return { perPage, pages: Math.max(1, Math.ceil(count / perPage)) };
}
