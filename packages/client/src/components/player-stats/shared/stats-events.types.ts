/**
 * Everything Your stats' elements say to the scene: one `mc-player-stats` event (bubbles and composed) whose `detail` is
 * one of these, so the region guard (`GUARDED_EVENTS`) holds the lot back while the scene is not taking input.
 */
import type { MatchupKind, MatchupView } from "../../../view/matchup-grid.js";
import type { StatsTab } from "../../../view/player-stats-tabs.js";

export type StatsSourceName = "you" | "everyone";
export type StatsFilterName = "hero" | "villain" | "difficulty" | "clear" | "toggle";
export type StatsGridToggle = "counts" | "played" | "flip";

export type StatsEventDetail =
  /** Back to where the screen was opened from (or close the overlay). */
  | { readonly type: "back" }
  /** The You / Everyone switch. */
  | { readonly type: "source"; readonly source: StatsSourceName }
  /** A tab. */
  | { readonly type: "tab"; readonly tab: StatsTab }
  /** A filter chip steps to the next hero, villain or difficulty; clear puts every one back; toggle folds them (phone). */
  | { readonly type: "filter"; readonly filter: StatsFilterName }
  /** "Share my games" on Everyone. */
  | { readonly type: "share" }
  /** Cards by hero's arrows. */
  | { readonly type: "hero-step"; readonly direction: 1 | -1 }
  /** The Matchups Focus view's stepper, and its side list's row. */
  | { readonly type: "focus-step"; readonly direction: 1 | -1 }
  | { readonly type: "focus-row"; readonly row: number }
  /** A shelf opened as the Focus view. */
  | { readonly type: "open-focus"; readonly row: number }
  /** The Matchups chips. */
  | { readonly type: "view"; readonly view: MatchupView }
  | { readonly type: "grid"; readonly kind: MatchupKind }
  | { readonly type: "grid-toggle"; readonly toggle: StatsGridToggle }
  /** The grid's cursor moved (an arrow, a tap on a cell); the scene keeps it across redraws. */
  | { readonly type: "grid-cursor"; readonly row: number; readonly column: number }
  /** "Hide hero cards". */
  | { readonly type: "hide-signature" }
  /** A record's "View game". */
  | { readonly type: "open-game"; readonly gameId: string }
  /** A card the stats name, to read large in Inspect (a hold, the route's Inspect, A on its row). */
  | { readonly type: "card"; readonly cardId: string };

export const STATS_EVENT = "mc-player-stats";

export type StatsEvent = CustomEvent<StatsEventDetail>;

/** The event for `detail`, ready to dispatch. */
export const statsEvent = (detail: StatsEventDetail): StatsEvent =>
  new CustomEvent(STATS_EVENT, { detail, bubbles: true, composed: true });

/** Not a press, so not guarded: the page finished drawing, and the focus stops may have changed. */
export const STATS_RENDERED = "mc-player-stats-rendered";

declare global {
  interface HTMLElementEventMap {
    "mc-player-stats": StatsEvent;
  }
}

/** How the sections lay themselves out: set by the page from the screen width. */
export type StatsMode = "wide" | "phone";
