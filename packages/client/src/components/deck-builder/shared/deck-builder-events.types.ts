/**
 * Everything the deck builder's elements say to the scene: one `mc-deck-builder` event (bubbles and composed) whose
 * `detail` is one of these, so the region guard (`GUARDED_EVENTS`) holds the lot back while the scene is not taking input.
 * The scene answers each with a new model; no element holds state of its own beyond what is being typed.
 */
export const BUILDER_EVENT = "mc-deck-builder";

/** Not a press, so not guarded: the page drew, and the focus stops may have changed. */
export const BUILDER_RENDERED = "mc-deck-builder-rendered";

/** The narrow layout's tabs. */
export type BuilderTab = "pool" | "deck" | "games";

/** The wide layout's deck rail tabs. */
export type RailTab = "deck" | "games";

export type ShowKey = "hideHero" | "hideBasic";

export type OddsPart = "group-prev" | "group-next" | "fewer" | "more" | "opening";

export type DeckBuilderEventDetail =
  /** Back (the first press with unsaved changes asks; the scene knows). */
  | { readonly type: "back" }
  /** The hero search's accepted text. */
  | { readonly type: "identity-search"; readonly text: string }
  /** A hero tile's name bar or picture tapped. */
  | { readonly type: "pick-hero"; readonly id: string }
  /** A hold or the route's Inspect on a hero tile. */
  | { readonly type: "hero-inspect"; readonly id: string }
  /** "Start from": an empty deck (`id` null) or a precon. */
  | { readonly type: "start"; readonly id: string | null }
  | { readonly type: "start-back" }
  /** The chosen identity's row: open Inspect on its hero side. */
  | { readonly type: "identity-card" }
  | { readonly type: "aspect"; readonly aspect: string }
  | { readonly type: "aspect-info"; readonly aspect: string }
  /** A mouse rests on, or leaves, an aspect's "i": its tip opens after a pause and closes on leaving both. */
  | { readonly type: "aspect-hover"; readonly aspect: string; readonly over: boolean }
  /** A mouse enters or leaves the open tip's plate. */
  | { readonly type: "tip-hover"; readonly over: boolean }
  | { readonly type: "tip-close" }
  | { readonly type: "tip-link"; readonly aspect: string }
  /** The deck name's accepted text. */
  | { readonly type: "name"; readonly text: string }
  | { readonly type: "tab"; readonly tab: BuilderTab }
  | { readonly type: "rail-tab"; readonly tab: RailTab }
  | { readonly type: "chart-tab"; readonly tab: "curve" | "odds" }
  | { readonly type: "show"; readonly key: ShowKey }
  | { readonly type: "type-filter"; readonly id: string }
  | { readonly type: "quick"; readonly id: string }
  | { readonly type: "trait"; readonly dir: 1 | -1 }
  | { readonly type: "pack-step"; readonly dir: 1 | -1 }
  | { readonly type: "pack-pick" }
  | { readonly type: "cycle-pick" }
  | { readonly type: "sort" }
  | { readonly type: "then" }
  | { readonly type: "filters-toggle" }
  /** The pool search's accepted text (an empty text is the clear button). */
  | { readonly type: "search"; readonly text: string }
  | { readonly type: "search-help" }
  | { readonly type: "pool-view" }
  /** One more copy of a card (the pool's + , a suggestion's Add, the route's Enter on a pool card). */
  | { readonly type: "add"; readonly cardId: string }
  | { readonly type: "remove"; readonly cardId: string }
  /** Inspect a card (a tap on a picture, a hold, the route's Inspect). */
  | { readonly type: "open"; readonly cardId: string; readonly face?: string | null }
  | { readonly type: "odds"; readonly part: OddsPart }
  | { readonly type: "reward"; readonly cardId: string; readonly included: boolean }
  | { readonly type: "deck-sort" }
  | { readonly type: "review" }
  | { readonly type: "precon" }
  | { readonly type: "clear" }
  | { readonly type: "delete" }
  | { readonly type: "freeze" }
  | { readonly type: "save" }
  | { readonly type: "games-step"; readonly dir: 1 | -1 }
  | { readonly type: "games-source"; readonly source: "yours" | "everyone" }
  | { readonly type: "games-share" };

declare global {
  interface HTMLElementEventMap {
    "mc-deck-builder": CustomEvent<DeckBuilderEventDetail>;
  }
}
