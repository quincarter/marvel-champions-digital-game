import type { HintGlyph, PictureSource } from "@mc/ui";
import type { RoleBuildCard, RoleBuildContext } from "../../../view/campaign-role-build-model.js";

/** Role-building context (the seat role, deck aspects and hero stats) and its cards. */
export interface RoleBuildData {
  readonly ctx: RoleBuildContext;
  readonly cards: readonly RoleBuildCard[];
}

/** Role-building (MC32 p. 5): the data, the card pictures by id and the glyph on Confirm. */
export interface RoleBuildCallModel {
  readonly build: RoleBuildData;
  readonly pictures: ReadonlyMap<string, PictureSource>;
  readonly confirmGlyph: HintGlyph | null;
  readonly phone: boolean;
}
