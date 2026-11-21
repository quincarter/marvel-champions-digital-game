/**
 * What the decision sheet offers when it could not draw a decision (#943): a draw that throws (a pack card whose data
 * the sheet cannot read) used to leave the sheet torn down with the engine still waiting on the answer, so nothing on
 * the screen could be pressed. The sheet records the error and draws these plain buttons instead, built only from the
 * engine's own option labels, so the game can always go on. It answers with one option, none, or the first ones a
 * decision needs: a payment that needs two resources or more cannot be made here, only declined (Undo stays open).
 */
import type { PendingChoice } from "@mc/engine";

export interface FallbackChoiceButton {
  readonly label: string;
  /** The option ids sent as the answer. */
  readonly answer: readonly string[];
}

/** At most this many options get a button of their own; a longer list is answered by "Let the game pick". */
export const FALLBACK_OPTION_LIMIT = 6;

/**
 * One button per option for a pick of one (the player still chooses), "Choose none" when nothing is required, and
 * otherwise "Let the game pick": the first options the decision needs, in the engine's own order.
 */
export function fallbackChoiceButtons(
  choice: Pick<PendingChoice, "options" | "minSelections" | "maxSelections">,
): readonly FallbackChoiceButton[] {
  const buttons: FallbackChoiceButton[] = [];
  const single = choice.maxSelections >= 1 && choice.minSelections <= 1;
  if (single && choice.options.length <= FALLBACK_OPTION_LIMIT) {
    for (const option of choice.options) {
      const label = typeof option.label === "string" && option.label.trim() !== "" ? option.label : option.optionId;
      buttons.push({ label, answer: [option.optionId] });
    }
  } else if (choice.minSelections > 0 && choice.options.length >= choice.minSelections) {
    buttons.push({
      label: "Let the game pick",
      answer: choice.options.slice(0, choice.minSelections).map((option) => option.optionId),
    });
  }
  if (choice.minSelections === 0) buttons.push({ label: "Choose none", answer: [] });
  return buttons;
}
