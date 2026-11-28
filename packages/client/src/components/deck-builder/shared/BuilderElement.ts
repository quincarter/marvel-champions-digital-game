import { LitElement } from "lit";
import { onTap } from "@mc/ui/tap";
import { BUILDER_EVENT, BUILDER_RENDERED, type DeckBuilderEventDetail } from "./deck-builder-events.types.js";

/**
 * The base of the deck builder's elements: one way to speak to the scene (`mc-deck-builder`, typed) and one place that
 * wraps the tap rule. Presses go through `mc-button` / `mc-chip` / `onTap`, which answer the focus route's `click()` and
 * ignore the lift that ends a swipe.
 */
export abstract class BuilderElement extends LitElement {
  readonly #bound = new WeakSet<Element>();

  protected emit(detail: DeckBuilderEventDetail): void {
    this.dispatchEvent(
      new CustomEvent<DeckBuilderEventDetail>(BUILDER_EVENT, { detail, bubbles: true, composed: true }),
    );
  }

  /** A handler that raises `detail` and keeps the part's own event (`mc-press`) from going any further. */
  protected send(detail: DeckBuilderEventDetail): (event?: Event) => void {
    return (event) => {
      event?.stopPropagation();
      this.emit(detail);
    };
  }

  /**
   * `mc-pressed` from a `McPress` part whose `action` (or `holdAction`) is itself the event to raise: stops the press
   * and says what it carried.
   */
  protected readonly relay = (event: Event): void => {
    event.stopPropagation();
    const { action } = (event as CustomEvent<{ action: unknown }>).detail;
    if (action) this.emit(action as DeckBuilderEventDetail);
  };

  /** Tells the page the stops may have changed (the scene reads them again a frame later). */
  protected emitRendered(): void {
    this.dispatchEvent(new CustomEvent(BUILDER_RENDERED, { bubbles: true, composed: true }));
  }

  /**
   * Makes `part` a tap target: a pointer tap (never the lift that ends a swipe) and the route's `click()` (no pointer
   * behind it, `detail` 0) both run `press`. Bound once per part.
   */
  protected tapPart(part: Element, press: () => void): void {
    if (this.#bound.has(part)) return;
    this.#bound.add(part);
    onTap(part as HTMLElement, press);
    part.addEventListener("click", (event) => {
      if ((event as MouseEvent).detail === 0) press();
    });
  }
}
