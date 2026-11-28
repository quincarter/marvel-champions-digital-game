/**
 * What the Extras reader elements say to the scene: one `mc-reader` event, bubbling and composed, whose `detail` is one of
 * these. One name for all of them so the panel region can hold them back while its scene is not taking input
 * (`GUARDED_EVENTS`).
 */
export const READER_EVENT = "mc-reader";

export type ReaderEventDetail =
  /** Back (to Extras, or from a phone's open section to its contents). */
  | { readonly type: "back" }
  /** A row of the contents: the section's index in the book. */
  | { readonly type: "toc"; readonly index: number }
  /** A phone's CONTENTS button: from the open section back to the list. */
  | { readonly type: "contents" }
  | { readonly type: "prev" }
  | { readonly type: "next" }
  /** A PDF button: its index in the book's list. */
  | { readonly type: "pdf"; readonly index: number }
  /** The search field's text (after its typing pause). */
  | { readonly type: "search"; readonly value: string }
  /** The caret went into or left the search field. */
  | { readonly type: "search-focus"; readonly focused: boolean };

export type ReaderEvent = CustomEvent<ReaderEventDetail>;

/** The event for `detail`, ready to dispatch. */
export const readerEvent = (detail: ReaderEventDetail): ReaderEvent =>
  new CustomEvent(READER_EVENT, { detail, bubbles: true, composed: true });

declare global {
  interface HTMLElementEventMap {
    "mc-reader": ReaderEvent;
  }
}
