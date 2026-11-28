import type { PressEvent } from "@mc/ui";
import type { ReactiveController, ReactiveControllerHost } from "lit";
import { briefingDetailOf, raiseBriefing } from "../briefing.types.js";

/**
 * Turns what the generic controls raise (`mc-pressed` from an `@mc/ui` card, row or chip, or from a Briefing press) into
 * the Briefing's own `mc-briefing` event, once per element: the control knows nothing of the screen, and the scene hears
 * one typed event. A press whose action is a `BriefingDetail` passes as it is and its original event stops here, so nothing above
 * hears two; any other action goes up unchanged for the owner of the press.
 */
export class BriefingRelay implements ReactiveController {
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
    const detail = briefingDetailOf(event.detail.action);
    if (!detail) return;
    event.stopPropagation();
    raiseBriefing(this.#host, detail);
  };
}
