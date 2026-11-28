/**
 * The issue's modes (RRG 1.8 "Campaign Mode", p. 29): what it is handed (one row per mode) and what it reports (a chip pressed,
 * by its action string, which the scene hands to `ctx.setIssueMode` to store and compose the issue again).
 */
import type { IssueModeRow } from "../../../../../view/campaign-modes-model.js";
import type { OptionChip } from "../../../../../view/setup-options.js";
import type { SectionBase } from "../sections.types.js";

export interface ModesInput extends SectionBase {
  readonly rows: readonly IssueModeRow[];
}

export interface ModesEvents {
  readonly choose: (action: string) => void;
}

/** A row in the player's language: the words the model wrote in English, said by the row's id. */
export interface ModeRowText {
  readonly name: string;
  readonly meta: string;
  readonly chips: readonly (OptionChip & { readonly text: string })[];
}
