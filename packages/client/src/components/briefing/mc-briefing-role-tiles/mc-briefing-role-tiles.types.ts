import type { OptionTileModel } from "../mc-briefing-option-tile/mc-briefing-option-tile.types.js";

/** The role call tiles and the "What roles do" note. */
export interface RoleTilesModel {
  /** One per role, each with the action `{ type: "role", id }` (a taken role is not available and takes no press). */
  readonly tiles: readonly OptionTileModel[];
  readonly note: { readonly heading: string; readonly lines: readonly string[] };
}
