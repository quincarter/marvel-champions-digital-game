/**
 * What the Extras elements say to the scene: one `mc-extras` event, bubbling and composed, whose `detail` is one of these
 * (one name, in `GUARDED_EVENTS`, so the panel region holds it back while its scene is not taking input).
 */
export const EXTRAS_EVENT = "mc-extras";

export type ExtrasDoorId = "trophies" | "credits";
export type ExtrasPlayerAction = "shuffle" | "next" | "pause";

export type ExtrasEventDetail =
  /** Back to Title. */
  | { readonly type: "back" }
  /** The Trophy Room or Art and Credits door. */
  | { readonly type: "door"; readonly id: ExtrasDoorId }
  /** A tab of the rail: the tab's id. */
  | { readonly type: "tab"; readonly id: string }
  /** A tile (or a song row): the entry's id. */
  | { readonly type: "tile"; readonly id: string }
  /** The Music tab's Shuffle, Next or Pause. */
  | { readonly type: "player"; readonly action: ExtrasPlayerAction }
  /** The volume slider's track was pressed or dragged: 0 to 1 along it, `commit` on release. */
  | { readonly type: "volume"; readonly share: number; readonly commit: boolean }
  /** The volume slider's minus (-1) or plus (1). */
  | { readonly type: "volume-step"; readonly direction: -1 | 1 };

export type ExtrasEvent = CustomEvent<ExtrasEventDetail>;

export const extrasEvent = (detail: ExtrasEventDetail): ExtrasEvent =>
  new CustomEvent(EXTRAS_EVENT, { detail, bubbles: true, composed: true });

declare global {
  interface HTMLElementEventMap {
    "mc-extras": ExtrasEvent;
  }
}
