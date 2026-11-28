import type { ControlGlyph } from "@mc/ui";

/**
 * What the Title's elements raise: one `mc-title` event, bubbling and composed, whose detail says which control was
 * pressed (its focus stop's key). The scene listens on the page element and maps each key to what it does. One name so
 * the panel region can hold the event back while the Title is not taking input (`GUARDED_EVENTS`).
 */
export const TITLE_EVENT = "mc-title";

export type TitleEventDetail = { readonly type: "press"; readonly key: string };

export type TitleEvent = CustomEvent<TitleEventDetail>;

/** The event for `detail`, ready to dispatch. */
export const titleEvent = (detail: TitleEventDetail): TitleEvent =>
  new CustomEvent(TITLE_EVENT, { detail, bubbles: true, composed: true });

declare global {
  interface HTMLElementEventMap {
    "mc-title": TitleEvent;
  }
}

/** How the page lays itself out: set by the scene from the screen's size (a phone is one column on an ink ground). */
export type TitleMode = "wide" | "phone";

/** A key or pad glyph, or none. */
export type TitleGlyph = ControlGlyph | null | undefined;
