import { html, type PropertyDeclarations } from "lit";
import { McPress } from "../../../shared/press/McPress.js";
import { McDottedTermStyles } from "./mc-dotted-term.styles.js";
import { TERM_HOVER_EVENT, type McDottedTermProps, type TermHoverDetail } from "./mc-dotted-term.types.js";

/**
 * # Dotted term
 * A word in running text that has a definition: underlined with a dotted rule, and a press control (a tap raises
 * `action`; the focus route presses it through `click()`). A mouse over it raises `mc-term-hover` `{ over: true }` and
 * leaving it `{ over: false }`, so the text that holds it can open and close the definition on a desktop; a finger raises
 * none. It is inline, and its press area grows past the line to a touch target.
 *
 * @element mc-dotted-term
 * @attr label - The word as it reads in the sentence.
 * @prop action - What a tap raises.
 * @fires mc-pressed - `PressDetail`.
 * @fires mc-term-hover - `{ over }` (`TermHoverDetail`), the mouse only.
 */
export class McDottedTerm extends McPress implements McDottedTermProps {
  static override styles = [McDottedTermStyles];

  static override properties: PropertyDeclarations = {
    ...McPress.properties,
    label: { type: String },
  };

  declare label: string;

  constructor() {
    super();
    this.label = "";
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.addEventListener("pointerenter", this.#enter);
    this.addEventListener("pointerleave", this.#leave);
  }

  override disconnectedCallback(): void {
    this.removeEventListener("pointerenter", this.#enter);
    this.removeEventListener("pointerleave", this.#leave);
    super.disconnectedCallback();
  }

  #hover(over: boolean): void {
    this.dispatchEvent(
      new CustomEvent<TermHoverDetail>(TERM_HOVER_EVENT, { detail: { over }, bubbles: true, composed: true }),
    );
  }

  readonly #enter = (event: PointerEvent): void => {
    if (event.pointerType === "mouse") this.#hover(true);
  };

  readonly #leave = (event: PointerEvent): void => {
    if (event.pointerType === "mouse") this.#hover(false);
  };

  override render() {
    return html`<span class="word">${this.label}</span>`;
  }
}
