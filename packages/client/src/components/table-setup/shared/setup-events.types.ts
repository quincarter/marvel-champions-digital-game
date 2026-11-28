/**
 * What the Set up the table elements raise: one `mc-setup` event, bubbling and composed, whose detail says what the
 * player changed. The scene listens on the page element and turns each into a change to the draft. One name for all of
 * them so the panel region can hold them back while its scene is not taking input (`GUARDED_EVENTS`).
 */
export const SETUP_EVENT = "mc-setup";

export type SetupEventDetail =
  | { readonly type: "back" }
  | { readonly type: "difficulty"; readonly id: string }
  | { readonly type: "option"; readonly action: string }
  | { readonly type: "sets-sheet" }
  | { readonly type: "tower-defense" }
  | { readonly type: "modular-toggle"; readonly id: string }
  | { readonly type: "modular-random" }
  | { readonly type: "modular-cards"; readonly id: string }
  | { readonly type: "hood-toggle"; readonly id: string }
  | { readonly type: "edit-scenario" }
  | { readonly type: "group-toggle"; readonly id: string; readonly open: boolean }
  | { readonly type: "seat-pick"; readonly index: number }
  | { readonly type: "seat-roll" }
  | { readonly type: "reroll" }
  | { readonly type: "watch" }
  | { readonly type: "deal" }
  | { readonly type: "seed-input"; readonly value: string }
  | { readonly type: "seed-focus"; readonly focused: boolean };

export type SetupEvent = CustomEvent<SetupEventDetail>;

/** The event for `detail`, ready to dispatch. */
export const setupEvent = (detail: SetupEventDetail): SetupEvent =>
  new CustomEvent(SETUP_EVENT, { detail, bubbles: true, composed: true });

declare global {
  interface HTMLElementEventMap {
    "mc-setup": SetupEvent;
  }
}

/** How the sections lay themselves out: set by the page from the screen width (phone: the compact page, tablets in portrait too). */
export type SetupMode = "wide" | "phone";
