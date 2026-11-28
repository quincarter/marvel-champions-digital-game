import { LitElement } from "lit";
import { DECK_CHECK_RENDERED, type DeckCheckEventDetail } from "./deck-check-events.types.js";

/**
 * The base of Deck check's elements: one way to speak to the scene (`mc-deck-check`, typed). Presses themselves go
 * through `mc-button` / `onTap` / `tapped`, which already answer the focus route's `click()` and ignore the lift that
 * ends a swipe.
 */
export abstract class DeckCheckElement extends LitElement {
  /** Tells the scene the stops may have changed (it reads them again a frame later). */
  protected emitRendered(): void {
    this.dispatchEvent(new CustomEvent(DECK_CHECK_RENDERED, { bubbles: true, composed: true }));
  }

  protected emit(detail: DeckCheckEventDetail): void {
    this.dispatchEvent(
      new CustomEvent<DeckCheckEventDetail>("mc-deck-check", { detail, bubbles: true, composed: true }),
    );
  }
}
