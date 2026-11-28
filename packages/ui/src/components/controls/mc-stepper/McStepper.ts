import { html, LitElement, nothing, type PropertyDeclarations } from "lit";
import { styleMap } from "lit/directives/style-map.js";
import type { ControlGlyph } from "../../../shared/popup.types.js";
import { glyphLabelShift } from "../mc-glyph-hint/mc-glyph-hint.types.js";
import "../mc-chip/mc-chip.js";
import "../mc-glyph-hint/mc-glyph-hint.js";
import { McStepperStyles } from "./mc-stepper.styles.js";
import type { McStepperProps } from "./mc-stepper.types.js";

/**
 * # Stepper
 * Previous, what is chosen, next: two arrow chips either side of a chip that says the choice (a hero of several, a
 * villain of a list). The arrows are fixed width and the middle takes the rest, so the three never wrap. Each arrow is a
 * press control (`mc-chip`) that raises `mc-pressed` with its own action; the middle chip is a stop only when it has one.
 * An owner whose arrows are not plain chips (a "−" and a "+" that say why they are off) fills the `prev` and `next` slots
 * instead; the slotted control takes the arrow's box.
 *
 * @slot prev - Replaces the previous arrow.
 * @slot next - Replaces the next arrow.
 *
 * @element mc-stepper
 * @fires mc-pressed - From an arrow: `{ action: prevAction | nextAction, hold: false }`.
 */
export class McStepper extends LitElement implements McStepperProps {
  static override styles = [McStepperStyles];

  static override properties: PropertyDeclarations = {
    label: { type: String },
    prevStop: { type: String, attribute: "prev-stop" },
    nextStop: { type: String, attribute: "next-stop" },
    nameStop: { type: String, attribute: "name-stop" },
    prevAction: { attribute: false },
    nextAction: { attribute: false },
    prevGlyph: { attribute: false },
    nextGlyph: { attribute: false },
    several: { type: Boolean },
  };

  declare label: string;
  declare prevStop: string;
  declare nextStop: string;
  declare nameStop: string;
  declare prevAction: unknown;
  declare nextAction: unknown;
  declare prevGlyph: ControlGlyph | undefined;
  declare nextGlyph: ControlGlyph | undefined;
  declare several: boolean;

  constructor() {
    super();
    this.label = "";
    this.prevStop = "";
    this.nextStop = "";
    this.nameStop = "";
    this.prevAction = null;
    this.nextAction = null;
    this.prevGlyph = undefined;
    this.nextGlyph = undefined;
    this.several = true;
  }

  #arrow(word: string, stop: string, action: unknown, glyph: ControlGlyph | undefined) {
    return html`<div class="arrow" style=${styleMap({ "--mc-label-shift": `${glyphLabelShift(glyph)}px` })}>
      <slot name=${word === "◂" ? "prev" : "next"}>
        <mc-chip
          label=${word}
          .stop=${stop}
          .action=${action}
          ?disabled=${!this.several}
          aria-label=${word === "◂" ? "Previous" : "Next"}
        ></mc-chip>
      </slot>
      <mc-glyph-hint .glyph=${glyph}></mc-glyph-hint>
    </div>`;
  }

  override render() {
    return html`${this.several ? this.#arrow("◂", this.prevStop, this.prevAction, this.prevGlyph) : nothing}
      <mc-chip class="name" label=${this.label} selected .stop=${this.nameStop}></mc-chip>
      ${this.several ? this.#arrow("▸", this.nextStop, this.nextAction, this.nextGlyph) : nothing}`;
  }
}
