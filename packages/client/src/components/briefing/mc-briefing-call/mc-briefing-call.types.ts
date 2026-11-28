import type { HintGlyph } from "@mc/ui";
import type { ModularSetCallView } from "../../../view/campaign-modular-call-model.js";
import type { CallHeadModel } from "../mc-briefing-call-head/mc-briefing-call-head.types.js";
import type { CallPromptModel } from "../mc-briefing-call-prompt/mc-briefing-call-prompt.types.js";
import type { OptionsModel } from "../mc-briefing-options/mc-briefing-options.types.js";
import type { RoleBuildCallModel } from "../mc-briefing-role-build/mc-briefing-role-build.types.js";
import type { RoleConfirmModel } from "../mc-briefing-role-confirm/mc-briefing-role-confirm.types.js";
import type { RoleTilesModel } from "../mc-briefing-role-tiles/mc-briefing-role-tiles.types.js";
import type { SchemePickModel } from "../mc-briefing-scheme-pick/mc-briefing-scheme-pick.types.js";

/** Which question the pending call is, with what that kind shows. */
export type CallBody =
  | { readonly kind: "roleBuild"; readonly model: RoleBuildCallModel }
  | { readonly kind: "sideScheme"; readonly model: SchemePickModel }
  | { readonly kind: "modular"; readonly view: ModularSetCallView }
  /** `confirms` has the confirm step of each role by id (shown after a tile is pressed). */
  | { readonly kind: "role"; readonly tiles: RoleTilesModel; readonly confirms: ReadonlyMap<string, RoleConfirmModel> }
  | { readonly kind: "options"; readonly model: OptionsModel };

/** "Your call": the pending question the engine asked, as the Briefing shows it. */
export interface CallModel {
  /** Names the question: a new key starts the call afresh (no selection, filter or confirm step carried over). */
  readonly key: string;
  readonly head: CallHeadModel;
  /** Who is deciding, the box plain words and the printed rule; null for a kind that words its own question. */
  readonly prompt: CallPromptModel | null;
  readonly body: CallBody;
  /** The Start glyph on a role confirm step. */
  readonly glyph: HintGlyph | null;
  /** The call takes the whole column under its head and scrolls itself (role-building). */
  readonly ownsScroll: boolean;
}
