import { LitElement } from "lit";
import { onTap } from "@mc/ui/tap";
import { SEATS_EVENT, type SeatsEvent } from "./seats.types.js";

/**
 * The base of Take your seats' elements: one place that wraps the tap rule and the one event. A pressable part carries
 * `data-action` (and its `data-stop` key); a pointer press goes through `onTap` (the lift that ends a swipe is not a
 * press) and Enter on a focused stop is the part's `click()` with no pointer (`detail` 0), so both reach `act`.
 */
export abstract class SeatsElement extends LitElement {
  readonly #bound = new WeakSet<Element>();

  /** What a press on the part named `action` does. */
  protected abstract act(action: string, part: HTMLElement): void;

  protected emit(detail: SeatsEvent): void {
    this.dispatchEvent(new CustomEvent<SeatsEvent>(SEATS_EVENT, { detail, bubbles: true, composed: true }));
  }

  protected override updated(): void {
    for (const part of this.renderRoot.querySelectorAll<HTMLElement>("[data-action]")) {
      if (this.#bound.has(part)) continue;
      this.#bound.add(part);
      const press = (): void => this.act(part.dataset.action ?? "", part);
      onTap(part, press);
      part.addEventListener("click", (event) => {
        if (event.detail === 0) press();
      });
    }
  }
}
