/**
 * Turns what the generic controls raise (`mc-pressed` from an `@mc/ui` chip, card or row) into the Set up the table
 * element's own `mc-setup` event, once per element: the control knows nothing of the screen, and the scene hears one
 * typed event. A press whose action is already a `SetupEventDetail` passes as it is; a bare string is an option card's
 * action (`applySetupOption`). The original event stops here, so nothing above hears two.
 */
import type { PressEvent } from "@mc/ui";
import type { ReactiveController, ReactiveControllerHost } from "lit";
import { setupEvent, type SetupEventDetail } from "./setup-events.types.js";

/** What a pressed action means to the screen (null: nothing). */
export function setupDetailOf(action: unknown): SetupEventDetail | null {
  if (typeof action === "string") return { type: "option", action };
  if (typeof action === "object" && action !== null && "type" in action) return action as SetupEventDetail;
  return null;
}

export class SetupRelay implements ReactiveController {
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
    const detail = setupDetailOf(event.detail.action);
    if (detail) this.#host.dispatchEvent(setupEvent(detail));
  };
}
