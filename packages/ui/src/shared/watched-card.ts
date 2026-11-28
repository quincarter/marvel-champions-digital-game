import { nothing } from "lit";
import { AsyncDirective, directive, PartType, type ElementPart, type PartInfo } from "lit/async-directive.js";
import { watchCard, type CardRef } from "./card-events.js";

/**
 * `<div ${watchedCard(() => ({ cardId, face }))}>`: `watchCard` (`shared/card-events.ts`) for a picture a template draws, so
 * a list of hundreds of them needs no element each. The mouse over it raises the card hover events and a hold raises
 * Inspect; the listeners go when the element leaves the page. The function is read at each pointer event, so a redraw
 * that changes the card needs no new directive.
 */
class WatchedCardDirective extends AsyncDirective {
  #stop: (() => void) | null = null;
  #element: HTMLElement | null = null;
  #card: () => CardRef | null = () => null;

  constructor(part: PartInfo) {
    super(part);
    if (part.type !== PartType.ELEMENT) throw new Error("watchedCard() goes on an element");
  }

  render(_card: () => CardRef | null) {
    return nothing;
  }

  override update(part: ElementPart, [card]: [() => CardRef | null]) {
    this.#card = card;
    const element = part.element as HTMLElement;
    if (element !== this.#element) {
      this.#stop?.();
      this.#element = element;
      this.#stop = watchCard(element, () => this.#card());
    }
    return nothing;
  }

  protected override disconnected(): void {
    this.#stop?.();
    this.#stop = null;
    this.#element = null;
  }

  protected override reconnected(): void {
    if (this.#element && !this.#stop) this.#stop = watchCard(this.#element, () => this.#card());
  }
}

export const watchedCard = directive(WatchedCardDirective);
