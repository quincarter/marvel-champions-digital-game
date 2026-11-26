import { nothing } from "lit";
import { AsyncDirective, directive, PartType, type ElementPart, type PartInfo } from "lit/async-directive.js";
import { onHold, onTap } from "./tap.js";

/**
 * `<div ${tapped(fn)}>`: `fn` runs on a tap on the element (`shared/tap.ts`), never on the lift that ends a swipe.
 * `<div ${tapped(fn, hold)}>` also runs `hold` for a press-and-hold or a right-click (`onHold`), and the release that
 * ended a hold is then not a tap. The listeners go when the element leaves the page.
 */
class TappedDirective extends AsyncDirective {
  #stop: (() => void) | null = null;
  #stopHold: (() => void) | null = null;
  #element: HTMLElement | null = null;
  #handler: () => void = () => undefined;
  #hold: (() => void) | undefined;

  constructor(part: PartInfo) {
    super(part);
    if (part.type !== PartType.ELEMENT) throw new Error("tapped() goes on an element");
  }

  render(_handler: () => void, _hold?: () => void) {
    return nothing;
  }

  override update(part: ElementPart, [handler, hold]: [() => void, (() => void) | undefined]) {
    this.#handler = handler;
    this.#hold = hold;
    this.#element = part.element as HTMLElement;
    this.#listen();
    return nothing;
  }

  #listen(): void {
    const element = this.#element;
    if (!element) return;
    if (this.#hold && !this.#stopHold) this.#stopHold = onHold(element, () => this.#hold?.());
    else if (!this.#hold && this.#stopHold) {
      this.#stopHold();
      this.#stopHold = null;
    }
    if (!this.#stop) this.#stop = onTap(element, () => this.#handler());
  }

  protected override disconnected(): void {
    this.#stop?.();
    this.#stop = null;
    this.#stopHold?.();
    this.#stopHold = null;
  }

  protected override reconnected(): void {
    this.#listen();
  }
}

export const tapped = directive(TappedDirective);
