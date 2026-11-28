import type { ControlGlyph } from "@mc/ui";
import type { TrophySort } from "../../../view/trophy-room-model.js";

export interface TrophyFiltersModel {
  /** The sort chips show (the Filters button is open). */
  readonly open: boolean;
  /** "▾ Sort: Category ▲": the Filters button's words, with the sort in force. */
  readonly toggleLabel: string;
  /** "Expand all", or "Collapse all" once every family is open. */
  readonly expandLabel: string;
  /** The Filters button's key hint (Y on a pad, Inspect on a keyboard) and Expand all's (R3), or undefined for none. */
  readonly toggleGlyph: ControlGlyph | undefined;
  readonly expandGlyph: ControlGlyph | undefined;
  readonly sorts: readonly { readonly id: TrophySort; readonly label: string }[];
  readonly sort: TrophySort;
  readonly descending: boolean;
  readonly ascendingLabel: string;
  readonly descendingLabel: string;
}

export interface McTrophyFiltersProps {
  readonly model: TrophyFiltersModel | null;
}
