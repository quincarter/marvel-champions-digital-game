/** What the builder's action handlers ask of the scene that owns them. */
import type Phaser from "phaser";
import type { Deck } from "@mc/content";
import type { BuilderState } from "./builder-state.js";

export interface BuilderHost {
  readonly state: BuilderState;
  readonly scene: Phaser.Scene;
  /** Sets the page from the state again. */
  compose(): void;
  /** The pool list goes back to its top (a new search, filter or sort). */
  resetPool(): void;
  /** The focus route puts its ring on `key` (after the page has drawn it). */
  focusKey(key: string): void;
  /** True from the wide layout's width up: three columns. */
  isWide(): boolean;
  /** Something drawn over the builder owns the keys and the pad: Inspect, the cheat sheet, the pack picker. */
  overlayUp(): boolean;
  /** Opens Inspect on a card (once: a hold that also taps would open it twice). */
  inspect(cardId: string, face: { readonly kind: string } | null): void;
  /** The deck as it stands changed. */
  setDeck(deck: Deck): void;
  /** From your games is on screen: its narrow tab, or the wide rail's second tab. */
  showsGames(): boolean;
  /** Keeps the pool's sort, filters and view for the next visit. */
  rememberView(): void;
}
