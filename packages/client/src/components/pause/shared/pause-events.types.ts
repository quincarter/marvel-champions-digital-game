/**
 * What the Pause elements raise: one `mc-pause` event, bubbling and composed, whose detail says what the player pressed.
 * The scene listens on the page element and turns each into an action. One name for all of them so the panel region can
 * hold them back while its scene is not taking input (`GUARDED_EVENTS`).
 */
export const PAUSE_EVENT = "mc-pause";

/** The buttons of the menu column and the footer, which are also their focus stops' keys. */
export type PauseMenuId =
  | "close"
  | "resume"
  | "full-game-log"
  | "rules-reference"
  | "settings"
  | "stats"
  | "save-quit"
  | "music"
  | "report"
  | "watch-link"
  | "show-hand"
  | "guide-stop-tutorial"
  | "guide-turn-guide-off"
  | "manual-adjust"
  | "concede"
  | "concede-confirm-yes"
  | "concede-confirm-cancel";

export type PauseEventDetail =
  | { readonly type: "menu"; readonly id: PauseMenuId }
  /** A keyword or status card: opens Rules reference on that term. */
  | { readonly type: "keyword"; readonly id: string }
  /** A log moment Undo can get back to: rewinds there. */
  | { readonly type: "moment"; readonly id: string }
  | { readonly type: "quick-toggle" }
  /** A Quick reference row (phone). */
  | { readonly type: "quick"; readonly id: string }
  /** A Table row's switch (phone). */
  | { readonly type: "table"; readonly id: string }
  | { readonly type: "card-size"; readonly value: string }
  | { readonly type: "guide-level"; readonly value: string }
  /** A Guide row's switch or door (phone). */
  | { readonly type: "guide"; readonly id: string }
  /** A search result that opens its page, by the search entry's id. */
  | { readonly type: "result"; readonly id: string }
  /** A search result that is a Settings row: its switch, or one of its choices (`value`). */
  | { readonly type: "setting"; readonly id: string; readonly value?: string };

export type PauseEvent = CustomEvent<PauseEventDetail>;

/** The event for `detail`, ready to dispatch. */
export const pauseEvent = (detail: PauseEventDetail): PauseEvent =>
  new CustomEvent(PAUSE_EVENT, { detail, bubbles: true, composed: true });

/** What a pressed control's `action` means to Pause (null: nothing). */
export function pauseDetailOf(action: unknown): PauseEventDetail | null {
  return typeof action === "object" && action !== null && "type" in action ? (action as PauseEventDetail) : null;
}

declare global {
  interface HTMLElementEventMap {
    "mc-pause": PauseEvent;
  }
}
