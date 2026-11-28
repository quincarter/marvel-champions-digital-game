import type { PastGameAction, PastGameFilter } from "../../../view/past-games-model.js";

/**
 * Everything Past games' elements say to the scene: one `mc-past-games` event (bubbles and composed) whose `detail` is
 * one of these, so the region guard (`GUARDED_EVENTS`) holds the lot back while the scene is not taking input. (The
 * search field's own `mc-search` and `mc-search-focus` pass through as they are: they are guarded already.)
 */
export const PAST_GAMES_EVENT = "mc-past-games";

export type PastGamesEventDetail =
  /** Back to the screen that opened this one. */
  | { readonly type: "back" }
  /** "Open a replay file". */
  | { readonly type: "open-file" }
  /** "Export for MC Tracker (CSV)": the games the list shows now. */
  | { readonly type: "export-tracker" }
  /** A filter tab. */
  | { readonly type: "filter"; readonly filter: PastGameFilter }
  /** A tap on a game's row: its details show. */
  | { readonly type: "select"; readonly id: string }
  /** The phone popup's close button (or its scrim). */
  | { readonly type: "close" }
  /** One of a game's four actions. */
  | { readonly type: "action"; readonly id: string; readonly action: PastGameAction };

export function pastGamesEvent(detail: PastGamesEventDetail): CustomEvent<PastGamesEventDetail> {
  return new CustomEvent<PastGamesEventDetail>(PAST_GAMES_EVENT, { detail, bubbles: true, composed: true });
}

declare global {
  interface HTMLElementEventMap {
    "mc-past-games": CustomEvent<PastGamesEventDetail>;
  }
}
