/**
 * Everything Deck check's elements say to the scene: one `mc-deck-check` event (bubbles and composed) whose `detail` is
 * one of these, so the region guard (`GUARDED_EVENTS`) holds the lot back while the scene is not taking input.
 */
export type DeckCheckTab = "curve" | "cards" | "aspect";

export type DeckCheckEventDetail =
  /** Back to where the screen was opened from. */
  | { readonly type: "back" }
  /** Edit deck. */
  | { readonly type: "edit" }
  /** Start game. */
  | { readonly type: "start" }
  /** The card list's sort button. */
  | { readonly type: "sort" }
  /** A tab of the narrow layout. */
  | { readonly type: "tab"; readonly tab: DeckCheckTab }
  /** A chip of the type filter (`all`, `ally`, ...). */
  | { readonly type: "filter"; readonly filter: string }
  /** An aspect segment's "i": open or shut that aspect's tip. */
  | { readonly type: "tip"; readonly aspect: string }
  /** A tap on the open tip's lesson link. */
  | { readonly type: "tip-link"; readonly aspect: string }
  /** A tap outside the open tip's plate: it shuts. */
  | { readonly type: "tip-close" }
  /** A tap on a card cell (`card:<id>`) or a face tile (`face:<id>`): the scene opens Inspect. */
  | { readonly type: "card"; readonly key: string };

/** Not a press, so not guarded: the page or its card list finished drawing, and the focus stops may have changed. */
export const DECK_CHECK_RENDERED = "mc-deck-check-rendered";

declare global {
  interface HTMLElementEventMap {
    "mc-deck-check": CustomEvent<DeckCheckEventDetail>;
  }
}
