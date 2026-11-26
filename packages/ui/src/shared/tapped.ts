import { nothing } from "lit";
import { AsyncDirective, directive, PartType, type ElementPart, type PartInfo } from "lit/async-directive.js";
import { onTap } from "./tap.js";

/**
 * `<div ${tapped(fn)}>`: `fn` runs on a tap on the element (`shared/tap.ts`), never on the lift that ends a swipe.
 * The listeners go when the element leaves the page.
 */
class TappedDirective extends AsyncDirective {
  #stop: (() => void) | null = null;
  #element: HTMLElement | null = null;
  #handler: () => void = () => undefined;

  constructor(part: PartInfo) {
    super(part);
    if (part.type !== PartType.ELEMENT) throw new Error("tapped() goes on an element");
  }

  render(_handler: () => void) {
    return nothing;
  }

  override update(part: ElementPart, [handler]: [() => void]) {
    this.#handler = handler;
    this.#element = part.element as HTMLElement;
    if (!this.#stop) this.#stop = onTap(this.#element, () => this.#handler());
    return nothing;
  }

  protected override disconnected(): void {
    this.#stop?.();
    this.#stop = null;
  }

  protected override reconnected(): void {
    if (this.#element && !this.#stop) this.#stop = onTap(this.#element, () => this.#handler());
  }
}

export const tapped = directive(TappedDirective);
