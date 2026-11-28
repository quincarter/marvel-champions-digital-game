import type { PressEvent } from "@mc/ui";
import { LitElement } from "lit";
import { pauseDetailOf, pauseEvent, type PauseEventDetail } from "./pause-events.types.js";

/**
 * The base of Pause's section elements: it turns what the generic controls raise (`mc-pressed` from an `@mc/ui` row, cell
 * or card) into the one `mc-pause` event, once per element, and stops the original so nothing above hears two. A section
 * with an `mc-button` of its own says its press with `say`.
 */
export abstract class PauseElement extends LitElement {
  override connectedCallback(): void {
    super.connectedCallback();
    this.addEventListener("mc-pressed", this.#pressed);
  }

  override disconnectedCallback(): void {
    this.removeEventListener("mc-pressed", this.#pressed);
    super.disconnectedCallback();
  }

  readonly #pressed = (event: PressEvent): void => {
    const detail = pauseDetailOf(event.detail.action);
    if (!detail) return;
    event.stopPropagation();
    this.say(detail);
  };

  protected say(detail: PauseEventDetail): void {
    this.dispatchEvent(pauseEvent(detail));
  }
}
