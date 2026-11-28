import type { ShelfRosterModel } from "@mc/ui";
import type { ScenarioRandomRowModel } from "../mc-scenario-random-row/mc-scenario-random-row.types.js";

/** The list: the Random row over the pack shelves (or, drilled into a box, over its grid). */
export interface ScenarioShelvesModel {
  readonly randomRow: ScenarioRandomRowModel;
  /** The shelves; its card sizes are 0 (fluid), so the stylesheet sizes the tiles from the box. */
  readonly roster: ShelfRosterModel;
}
