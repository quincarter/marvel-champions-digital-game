import type { CivilWarTableSummary } from "../../../view/civil-war-table-summary.js";
import type { HoodModularSetOption } from "../../../view/hood-modular-sets.js";
import type { ModularSetOption, RequiredEncounterSet } from "../../../view/modular-sets.js";

/** What the Modular sets section shows. A Civil War build shows `cw` in place of the picker. */
export interface ModularsInput {
  readonly cw: CivilWarTableSummary | null;
  /** The villain the required sets are "required by". */
  readonly villainName: string;
  readonly required: readonly RequiredEncounterSet[];
  readonly options: readonly ModularSetOption[];
  /** The Hood's own set-aside candidates (empty for every other scenario). */
  readonly hood: readonly HoodModularSetOption[];
  /** Whether the header offers a Random draw. */
  readonly randomSets: boolean;
  /** The header's right label ("2 of 2 chosen", a Civil War build's "Ready-made"). */
  readonly right: string;
  /** Which phone groups the player has shown or hidden (an absent group follows its own default). */
  readonly openGroups: ReadonlyMap<string, boolean>;
}

/** What the player changed in the Modular sets section. */
export interface ModularsEvents {
  readonly toggle: (setId: string) => void;
  /** Random: a random legal draw for the scenario's count. */
  readonly random: () => void;
  /** Open one set's cards (its picture, its "Cards" tab, Inspect). */
  readonly cards: (setId: string) => void;
  readonly toggleHood: (setId: string) => void;
  readonly editScenario: () => void;
  /** A phone group shown or hidden. */
  readonly toggleGroup: (groupId: string, open: boolean) => void;
}
