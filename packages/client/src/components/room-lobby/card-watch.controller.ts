import { watchCard } from "@mc/ui";
import type { LitElement, ReactiveController } from "lit";

/**
 * Makes every `[data-card]` picture of a lobby element a card picture (`watchCard`): hover opens the card popover and a
 * hold or right-click inspects. The element carries `data-card` (the card id) and, for a villain stage or a scheme's B
 * side, `data-face`. Each picture is bound once and reads its dataset when the mouse arrives, so a re-render that
 * changes the card needs no rebinding; a picture that leaves the DOM is let go on the next update.
 */
export class CardWatchController implements ReactiveController {
  readonly #host: LitElement;
  readonly #bound = new Map<Element, () => void>();

  constructor(host: LitElement) {
    this.#host = host;
    host.addController(this);
  }

  hostUpdated(): void {
    const root = this.#host.renderRoot;
    const live = new Set<Element>(root.querySelectorAll("[data-card]"));
    for (const [element, stop] of this.#bound) {
      if (live.has(element)) continue;
      stop();
      this.#bound.delete(element);
    }
    for (const element of live) {
      if (this.#bound.has(element) || !(element instanceof HTMLElement)) continue;
      this.#bound.set(
        element,
        watchCard(element, () => {
          const cardId = element.dataset.card;
          if (!cardId) return null;
          const face = element.dataset.face;
          return face ? { cardId, face } : { cardId };
        }),
      );
    }
  }

  hostDisconnected(): void {
    for (const stop of this.#bound.values()) stop();
    this.#bound.clear();
  }
}
