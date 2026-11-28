/**
 * Turns what the generic controls raise (`mc-pressed` from an `@mc/ui` chip, or from a row or card of this screen) into
 * Your stats' own `mc-player-stats` event, once per element: the control knows nothing of the screen, and the scene hears
 * one typed event. The original event stops here, so nothing above hears two.
 */
import type { PressEvent } from "@mc/ui";
import type { ReactiveController, ReactiveControllerHost } from "lit";
import { statsEvent, type StatsEventDetail } from "./stats-events.types.js";

/** What a pressed action means to the screen (null: nothing). */
export function statsDetailOf(action: unknown): StatsEventDetail | null {
  if (typeof action === "object" && action !== null && "type" in action) return action as StatsEventDetail;
  return null;
}

export class StatsRelay implements ReactiveController {
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
    const detail = statsDetailOf(event.detail.action);
    if (detail) this.#host.dispatchEvent(statsEvent(detail));
  };
}
