/**
 * What the Extras viewer elements say to the scene: one `mc-viewer` event, bubbling and composed, whose `detail` is one of
 * these (one name, in `GUARDED_EVENTS`, so the panel region holds it back while its scene is not taking input).
 */
export const VIEWER_EVENT = "mc-viewer";

export type ViewerEventDetail =
  /** The close button: leave the viewer. */
  | { readonly type: "close" }
  /** The previous (-1) or next (1) picture of the file. */
  | { readonly type: "step"; readonly direction: 1 | -1 }
  /** A promo card's use-this-art control: use it, or stop using it. */
  | { readonly type: "promo" };

export type ViewerEvent = CustomEvent<ViewerEventDetail>;

export const viewerEvent = (detail: ViewerEventDetail): ViewerEvent =>
  new CustomEvent(VIEWER_EVENT, { detail, bubbles: true, composed: true });

declare global {
  interface HTMLElementEventMap {
    "mc-viewer": ViewerEvent;
  }
}
