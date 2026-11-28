import type { PressEvent } from "@mc/ui";
import type { ReactiveController, ReactiveControllerHost } from "lit";
import { titleEvent } from "./title.types.js";

/**
 * Turns what the Title's controls raise into the one `mc-title` event, once, on the page: a pressable element's
 * `mc-pressed` carries its key as the `action`, and an `mc-button`'s `mc-press` is keyed by its own `data-stop`. The
 * original event stops here, so nothing above hears two.
 */
export class TitleRelay implements ReactiveController {
  readonly #host: ReactiveControllerHost & HTMLElement;

  constructor(host: ReactiveControllerHost & HTMLElement) {
    this.#host = host;
    host.addController(this);
  }

  hostConnected(): void {
    this.#host.addEventListener("mc-pressed", this.#pressed);
    this.#host.addEventListener("mc-press", this.#button);
  }

  hostDisconnected(): void {
    this.#host.removeEventListener("mc-pressed", this.#pressed);
    this.#host.removeEventListener("mc-press", this.#button);
  }

  readonly #pressed = (event: PressEvent): void => {
    event.stopPropagation();
    const key = event.detail.action;
    if (typeof key === "string" && key.length > 0) this.#host.dispatchEvent(titleEvent({ type: "press", key }));
  };

  readonly #button = (event: Event): void => {
    event.stopPropagation();
    const origin = event.composedPath()[0];
    const key = origin instanceof HTMLElement ? origin.dataset.stop : undefined;
    if (key) this.#host.dispatchEvent(titleEvent({ type: "press", key }));
  };
}
