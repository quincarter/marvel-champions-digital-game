import type { HintGlyph } from "@mc/ui";
import type { ScenarioActionsModel } from "../../../components/scenario-select/mc-scenario-actions/mc-scenario-actions.types.js";
import type { ScenarioFiltersModel } from "../../../components/scenario-select/mc-scenario-filters/mc-scenario-filters.types.js";
import type { ScenarioPickedModel } from "../../../components/scenario-select/mc-scenario-picked/mc-scenario-picked.types.js";
import type { ScenarioShelvesModel } from "../../../components/scenario-select/mc-scenario-shelves/mc-scenario-shelves.types.js";
import type { ScenarioStatCell } from "../../../components/scenario-select/mc-scenario-stats/mc-scenario-stats.types.js";

/** The ink bar across the top. */
export interface ScenarioTopBarModel {
  readonly backLabel: string;
  readonly title: string;
  /** "STEP 1 OF 3". */
  readonly right: string;
  readonly backGlyph: HintGlyph | null;
  /** How far the title drops, and where it must end, to clear the dark mode tab (`sheetThemeFor`). */
  readonly titleDrop: number;
  readonly titleMaxRight: number;
}

/** Everything Choose a scenario shows; the scene builds it from the draft and the pool and sets it on the page. */
export interface ScenarioSelectPageModel {
  /** Two columns (the list beside the stages panel) instead of one stacked column (`formFactorFor`). */
  readonly wide: boolean;
  /** A phone: a taller bar and tighter gutters. */
  readonly phone: boolean;
  readonly topBar: ScenarioTopBarModel;
  readonly filters: ScenarioFiltersModel;
  readonly shelves: ScenarioShelvesModel;
  /** The stat strip's cells (under the shelves on a wide screen; inside the open stages sheet on a narrow one). */
  readonly stats: readonly ScenarioStatCell[];
  readonly picked: ScenarioPickedModel;
  readonly actions: ScenarioActionsModel;
}
