import { html, LitElement, type PropertyDeclarations } from "lit";
import { ThemeStyles } from "../../../shared/theme.styles.js";
import "../../mc-button/mc-button.js";
import { McValueStepperStyles } from "./mc-value-stepper.styles.js";
import type { ValueStepperPart, ValueStepperPressDetail } from "./mc-value-stepper.types.js";

/**
 * # Value stepper
 * Previous, a named middle and next as three buttons: a value that steps through choices (a pack, a trait, a draw
 * count). The middle is chosen (`selected`) while a value is picked. Each part has its own focus-stop key, so a pad or
 * keyboard reaches all three; a disabled part stays in place, dimmed.
 *
 * @element mc-value-stepper
 * @attr label - The middle's words, already translated.
 * @attr selected - The middle is chosen.
 * @attr prev-label - The previous button's words ("<").
 * @attr next-label - The next button's words (">").
 * @attr prev-stop - The previous button's focus stop key; none when empty.
 * @attr name-stop - The middle's focus stop key.
 * @attr next-stop - The next button's focus stop key.
 * @attr prev-disabled - Previous does nothing.
 * @attr name-disabled - The middle does nothing.
 * @attr next-disabled - Next does nothing.
 * @fires mc-value-stepper-press - `ValueStepperPressDetail`.
 */
export class McValueStepper extends LitElement {
  static override styles = [ThemeStyles, McValueStepperStyles];

  static override properties: PropertyDeclarations = {
    label: { type: String },
    selected: { type: Boolean },
    prevLabel: { type: String, attribute: "prev-label" },
    nextLabel: { type: String, attribute: "next-label" },
    prevStop: { type: String, attribute: "prev-stop" },
    nameStop: { type: String, attribute: "name-stop" },
    nextStop: { type: String, attribute: "next-stop" },
    prevDisabled: { type: Boolean, attribute: "prev-disabled" },
    nameDisabled: { type: Boolean, attribute: "name-disabled" },
    nextDisabled: { type: Boolean, attribute: "next-disabled" },
  };

  declare label: string;
  declare selected: boolean;
  declare prevLabel: string;
  declare nextLabel: string;
  declare prevStop: string;
  declare nameStop: string;
  declare nextStop: string;
  declare prevDisabled: boolean;
  declare nameDisabled: boolean;
  declare nextDisabled: boolean;

  constructor() {
    super();
    this.label = "";
    this.selected = false;
    this.prevLabel = "<";
    this.nextLabel = ">";
    this.prevStop = "";
    this.nameStop = "";
    this.nextStop = "";
    this.prevDisabled = false;
    this.nameDisabled = false;
    this.nextDisabled = false;
  }

  #press(part: ValueStepperPart, event: Event): void {
    event.stopPropagation();
    this.dispatchEvent(
      new CustomEvent<ValueStepperPressDetail>("mc-value-stepper-press", {
        detail: { part },
        bubbles: true,
        composed: true,
      }),
    );
  }

  override render() {
    return html`<mc-button
        data-stop=${this.prevStop}
        .label=${this.prevLabel}
        ?disabled=${this.prevDisabled}
        @mc-press=${(e: Event) => this.#press("prev", e)}
      ></mc-button>
      <mc-button
        data-stop=${this.nameStop}
        .label=${this.label}
        ?selected=${this.selected}
        ?disabled=${this.nameDisabled}
        @mc-press=${(e: Event) => this.#press("name", e)}
      ></mc-button>
      <mc-button
        data-stop=${this.nextStop}
        .label=${this.nextLabel}
        ?disabled=${this.nextDisabled}
        @mc-press=${(e: Event) => this.#press("next", e)}
      ></mc-button>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-value-stepper": McValueStepper;
  }
  interface HTMLElementEventMap {
    "mc-value-stepper-press": CustomEvent<ValueStepperPressDetail>;
  }
}
