/**
 * Everything the Mod Store's elements say to the scene: one `mc-mod-store` event (bubbles and composed) whose `detail`
 * is one of these, so the region guard (`GUARDED_EVENTS`) holds the lot back while the scene is not taking input. The
 * search box's own `mc-search` and `mc-search-focus` pass through as they are (the guard restores a field it refuses).
 */
import type { PackActionId } from "../../../view/mod-store-model.js";
import type { UpdateAllActionId } from "../../../view/mod-store-update-all.js";
import type { ModNoticeAnswer } from "../../../view/mod-notice.js";

export type ModStoreEventDetail =
  /** Back: to the store from a pack's page, else to where the store was opened from. */
  | { readonly type: "back" }
  /** About mods: the heads-up opens. */
  | { readonly type: "about" }
  /** A tab of the browse view. */
  | { readonly type: "tab"; readonly tab: string }
  /** A phone's magnifier: the search box, sort and chips show or fold away. */
  | { readonly type: "toggle-finders" }
  /** The sort button. */
  | { readonly type: "sort" }
  /** A tag chip (`tag:<name>`) or the picked creator's chip (`creator`): `id` is the chip's id. */
  | { readonly type: "chip"; readonly id: string }
  /** Clear: every narrowing goes. */
  | { readonly type: "clear" }
  /** A button of the Update all bar. */
  | { readonly type: "update-all"; readonly action: UpdateAllActionId }
  /** Try again, after the store could not be reached. */
  | { readonly type: "retry" }
  /** A pack tile: its page opens. */
  | { readonly type: "open-pack"; readonly id: string }
  /** A creator on Credits: their packs show on All. */
  | { readonly type: "creator"; readonly name: string }
  /** A button of a pack's page. */
  | { readonly type: "pack-action"; readonly action: PackActionId }
  /** A tap on one of the page's cards: the scene opens Inspect (`key` is the gallery's own key for it). */
  | { readonly type: "card"; readonly key: string }
  /** An answer to the heads-up about mods. */
  | { readonly type: "notice"; readonly answer: ModNoticeAnswer };

export const MOD_STORE_EVENT = "mc-mod-store";

/** Not a press, so not guarded: the page or one of its parts finished drawing, and the focus stops may have changed. */
export const MOD_STORE_RENDERED = "mc-mod-store-rendered";

declare global {
  interface HTMLElementEventMap {
    "mc-mod-store": CustomEvent<ModStoreEventDetail>;
  }
}
