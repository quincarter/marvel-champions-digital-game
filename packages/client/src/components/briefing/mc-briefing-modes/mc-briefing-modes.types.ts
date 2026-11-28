import type { IssueModeRow } from "../../../view/campaign-modes-model.js";
import type { OptionChip } from "../../../view/setup-options.js";

/** What the section shows: one row per mode this issue offers. */
export interface ModesProps {
  readonly rows: readonly IssueModeRow[];
}

/** A row in the player language: the words the model wrote in English, said by the row id. */
export interface ModeRowText {
  readonly name: string;
  readonly meta: string;
  readonly chips: readonly (OptionChip & { readonly text: string })[];
}
