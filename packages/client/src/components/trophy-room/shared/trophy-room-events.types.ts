import type { AchievementFamily } from "../../../progression/achievements.js";
import type { TrophySort } from "../../../view/trophy-room-model.js";

/**
 * Everything the Trophy Room's elements say to the scene: one `mc-trophy-room` event (bubbles and composed) whose `detail`
 * is one of these, so the region guard (`GUARDED_EVENTS`) holds the lot back while the scene is not taking input.
 */
export const TROPHY_ROOM_EVENT = "mc-trophy-room";

export type TrophyRoomEventDetail =
  /** Back to the Title. */
  | { readonly type: "back" }
  /** "Your stats" (X on a pad). */
  | { readonly type: "stats" }
  /** The Filters button: the sort chips show or fold (Y on a pad). */
  | { readonly type: "filters-toggle" }
  /** Expand all, or Collapse all once every family is open (R3 on a pad). */
  | { readonly type: "expand-all" }
  /** A sort chip. */
  | { readonly type: "sort"; readonly sort: TrophySort }
  /** The ascending or descending chip. */
  | { readonly type: "direction"; readonly descending: boolean }
  /** A family's heading: it folds or opens. */
  | { readonly type: "family"; readonly id: AchievementFamily }
  /** An achievement's card: its sheet opens. */
  | { readonly type: "achievement"; readonly id: string }
  /** The sheet's Close button, or a tap outside it. */
  | { readonly type: "close" };

export function trophyRoomEvent(detail: TrophyRoomEventDetail): CustomEvent<TrophyRoomEventDetail> {
  return new CustomEvent<TrophyRoomEventDetail>(TROPHY_ROOM_EVENT, { detail, bubbles: true, composed: true });
}

declare global {
  interface HTMLElementEventMap {
    "mc-trophy-room": CustomEvent<TrophyRoomEventDetail>;
  }
}
