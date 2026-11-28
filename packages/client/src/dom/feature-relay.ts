/**
 * Turns what the generic controls raise (`mc-pressed` from an `@mc/ui` chip, card or row, or from a screen's own
 * `McPress` element) into the screen's one typed event, once per section: the control knows nothing of the screen, and
 * the scene hears a single name (`mc-past-games`, `mc-trophy-room`) the panel region can guard (`GUARDED_EVENTS`).
 * A press whose `action` is an object with a string `type` passes as it is; anything else means nothing here. The
 * original `mc-pressed` stops at the section, so nothing above hears two.
 */
import type { PressEvent } from "@mc/ui";
import type { ReactiveController, ReactiveControllerHost } from "lit";

export class FeatureRelay<D extends { readonly type: string }> implements ReactiveController {
  readonly #host: ReactiveControllerHost & HTMLElement;
  readonly #name: string;

  constructor(host: ReactiveControllerHost & HTMLElement, eventName: string) {
    this.#host = host;
    this.#name = eventName;
    host.addController(this);
  }

  hostConnected(): void {
    this.#host.addEventListener("mc-pressed", this.#pressed);
  }

  hostDisconnected(): void {
    this.#host.removeEventListener("mc-pressed", this.#pressed);
  }

  readonly #pressed = (event: PressEvent): void => {
    event.stopPropagation();
    const action = event.detail.action;
    if (typeof action !== "object" || action === null || typeof (action as { type?: unknown }).type !== "string")
      return;
    this.#host.dispatchEvent(new CustomEvent<D>(this.#name, { detail: action as D, bubbles: true, composed: true }));
  };
}
