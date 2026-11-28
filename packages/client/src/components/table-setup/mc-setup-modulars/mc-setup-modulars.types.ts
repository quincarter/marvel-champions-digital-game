import type { CivilWarTableSummary } from "../../../view/civil-war-table-summary.js";
import type { HoodModularSetOption } from "../../../view/hood-modular-sets.js";
import type { ModularSetOption, RequiredEncounterSet } from "../../../view/modular-sets.js";
import type { SetPicture } from "../mc-setup-set-tile/mc-setup-set-tile.types.js";

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
  /** Each set's picture (its most recognizable card), by set id; a set with no cards on hand has none. */
  readonly pictures: ReadonlyMap<string, SetPicture>;
}
