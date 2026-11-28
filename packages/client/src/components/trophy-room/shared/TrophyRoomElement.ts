import { onTap } from "@mc/ui/tap";
import { LitElement } from "lit";
import { trophyRoomEvent, type TrophyRoomEventDetail } from "./trophy-room-events.types.js";

/**
 * The base of the Trophy Room's elements: one way to speak to the scene (`mc-trophy-room`, typed), and a part marked
 * `data-action` pressed by `onTap` (the lift that ends a swipe is not a press). Buttons, chips and cards go through
 * `mc-hint-button`, `mc-chip` and `McPress`, which already answer the focus route's `click()`.
 */
export abstract class TrophyRoomElement extends LitElement {
  readonly #bound = new WeakSet<Element>();

  /** What a press on the part named `action` does (only elements with a `data-action` part override it). */
  protected act(_action: string): void {}

  protected emit(detail: TrophyRoomEventDetail): void {
    this.dispatchEvent(trophyRoomEvent(detail));
  }

  protected override updated(): void {
    for (const part of this.renderRoot.querySelectorAll<HTMLElement>("[data-action]")) {
      if (this.#bound.has(part)) continue;
      this.#bound.add(part);
      onTap(part, () => this.act(part.dataset.action ?? ""));
    }
  }
}
