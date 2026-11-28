/**
 * Turns what a generic press control raises (`mc-pressed` from an `@mc/ui` control or `McPress` subclass) into the Extras
 * elements' own `mc-extras` event, once per element: the control knows nothing of the screen. A press whose action is
 * already an `ExtrasEventDetail` passes as it is. The original event stops here, so nothing above hears two.
 */
import type { PressEvent } from "@mc/ui";
import type { ReactiveController, ReactiveControllerHost } from "lit";
import { extrasEvent, type ExtrasEventDetail } from "./extras-events.types.js";

/** What a pressed action means to the screen (null: nothing). */
export function extrasDetailOf(action: unknown): ExtrasEventDetail | null {
  return typeof action === "object" && action !== null && "type" in action ? (action as ExtrasEventDetail) : null;
}

export class ExtrasRelay implements ReactiveController {
  readonly #host: ReactiveControllerHost & HTMLElement;

  constructor(host: ReactiveControllerHost & HTMLElement) {
    this.#host = host;
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
    const detail = extrasDetailOf(event.detail.action);
    if (detail) this.#host.dispatchEvent(extrasEvent(detail));
  };
}
