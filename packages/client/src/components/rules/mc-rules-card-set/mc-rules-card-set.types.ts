import type { RulesTile } from "../shared/rules-tile.js";

export interface RulesCardSetModel {
  readonly setId: string;
  /** "RHINO - 12 CARDS", in capitals. */
  readonly heading: string;
  readonly tiles: readonly RulesTile[];
}

export interface McRulesCardSetProps {
  set: RulesCardSetModel | null;
}
