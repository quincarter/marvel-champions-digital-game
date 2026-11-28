/**
 * What the side-story reader elements say to the scene: one `mc-side-story` event, bubbling and composed, whose `detail`
 * is one of these (so the panel region can hold it back while its scene is not taking input, `GUARDED_EVENTS`). The
 * comic picture itself is drawn in the canvas, so a tap on it is the scene's own zone, not an event of these.
 */
export const SIDE_STORY_EVENT = "mc-side-story";

export type SideStoryEventDetail =
  /** CLOSE: leave the story for Extras. */
  | { readonly type: "close" }
  /** NEXT, or DONE on the last beat. */
  | { readonly type: "next" }
  /** BACK: the beat before. */
  | { readonly type: "back" };

export type SideStoryEvent = CustomEvent<SideStoryEventDetail>;

export const sideStoryEvent = (detail: SideStoryEventDetail): SideStoryEvent =>
  new CustomEvent(SIDE_STORY_EVENT, { detail, bubbles: true, composed: true });

declare global {
  interface HTMLElementEventMap {
    "mc-side-story": SideStoryEvent;
  }
}
