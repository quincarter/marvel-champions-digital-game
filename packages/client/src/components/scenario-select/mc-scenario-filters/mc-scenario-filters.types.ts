import type { HintGlyph } from "@mc/ui";
import type { ScenarioChip } from "../mc-scenario-chips/mc-scenario-chips.types.js";

/** Everything the filters section draws: the search, the Filters button and the product chips. */
export interface ScenarioFiltersModel {
  /** The text the screen has accepted into the search (never the field's live draft). */
  readonly searchValue: string;
  readonly placeholder: string;
  readonly clearLabel: string;
  /** The field is drawn: always on a wide screen, only while the toggle is on on a narrow one. */
  readonly searchShown: boolean;
  /** Narrow only: the magnifier at the head of the row that shows or hides the field. Null on a wide screen. */
  readonly searchToggle: { readonly label: string; readonly active: boolean } | null;
  /** The chips are behind this button (a controller is in use, or the screen is narrower than the breakpoint). */
  readonly filtersButton: { readonly label: string; readonly glyph: HintGlyph | null } | null;
  /** The pad's View hint beside the Filters button (a wide screen only), or none. */
  readonly inspectHint: { readonly text: string; readonly glyph: HintGlyph } | null;
  /** The chips are on screen (not folded behind the button). */
  readonly chipsShown: boolean;
  readonly chips: readonly ScenarioChip[];
}
