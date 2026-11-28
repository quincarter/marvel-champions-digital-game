import type { PressEvent, TermGlossaryDetail, TermTipChangeDetail } from "@mc/ui";
import { LitElement } from "lit";
import { learnEvent, type LearnEventDetail } from "./learn-events.types.js";

/** What a pressed action means to the learning screens (null: nothing). A bare `close` is the bar's ×. */
export function learnDetailOf(action: unknown): LearnEventDetail | null {
  if (action === "close") return { type: "close" };
  if (typeof action === "object" && action !== null && "type" in action) return action as LearnEventDetail;
  return null;
}

/**
 * The base of the learning screens' section elements. Turns what the generic controls raise (`mc-pressed` from a chip,
 * row or card, `mc-term-glossary` and `mc-term-tip-change` from the term text) into the one `mc-learn` event, once per
 * section: the control knows nothing of the screen, and the scene hears one typed event. The originals stop here, so
 * nothing above hears two. A section that has a plain `mc-button` raises its own with `emit`.
 */
export abstract class LearnElement extends LitElement {
  override connectedCallback(): void {
    super.connectedCallback();
    this.addEventListener("mc-pressed", this.#pressed);
    this.addEventListener("mc-term-glossary", this.#glossary);
    this.addEventListener("mc-term-tip-change", this.#tip);
  }

  override disconnectedCallback(): void {
    this.removeEventListener("mc-pressed", this.#pressed);
    this.removeEventListener("mc-term-glossary", this.#glossary);
    this.removeEventListener("mc-term-tip-change", this.#tip);
    super.disconnectedCallback();
  }

  protected emit(detail: LearnEventDetail): void {
    this.dispatchEvent(learnEvent(detail));
  }

  readonly #pressed = (event: PressEvent): void => {
    event.stopPropagation();
    const detail = learnDetailOf(event.detail.action);
    if (detail) this.emit(detail);
  };

  readonly #glossary = (event: CustomEvent<TermGlossaryDetail>): void => {
    event.stopPropagation();
    this.emit({ type: "glossary", heading: event.detail.heading });
  };

  readonly #tip = (event: CustomEvent<TermTipChangeDetail>): void => {
    event.stopPropagation();
    this.emit({ type: "tip", open: event.detail.id !== null });
  };
}
