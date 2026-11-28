import { html, type PropertyDeclarations } from "lit";
import { McPress } from "../../../shared/press/McPress.js";
import { McCheckRowStyles } from "./mc-check-row.styles.js";

/**
 * # Check row
 * A checkbox row (a candidate modular set, a Hood set, Tower Defense's toggle, a watch toggle): a paper card with a
 * ticked box when on (the tick and the words say the state, never colour alone), the name over a line of detail, and an
 * optional picture at the end (slotted). `locked` is a required choice: ink-filled, a red ticked box, no press.
 *
 * @element mc-check-row
 * @attr name - The row's name, already translated.
 * @attr meta - The line under it.
 * @attr checked - Ticked.
 * @attr locked - Required: ink fill, never pressable.
 * @attr onink - On an ink ground: no card, paper words and box (a watch toggle in a sidebar).
 * @prop action - What a tap raises.
 * @prop holdAction - What a hold raises.
 * @slot end - A picture at the row's end.
 * @fires mc-pressed - `PressDetail`.
 */
export class McCheckRow extends McPress {
  static override styles = [McCheckRowStyles];

  static override properties: PropertyDeclarations = {
    ...McPress.properties,
    name: { type: String },
    meta: { type: String },
    checked: { type: Boolean, reflect: true },
    locked: { type: Boolean, reflect: true },
    onink: { type: Boolean, reflect: true },
  };

  declare name: string;
  declare meta: string;
  declare checked: boolean;
  declare locked: boolean;
  declare onink: boolean;

  constructor() {
    super();
    this.name = "";
    this.meta = "";
    this.checked = false;
    this.locked = false;
    this.onink = false;
  }

  protected override tapAction(): unknown {
    return this.locked ? null : this.action;
  }

  override render() {
    return html`<div class="row">
      <span class="box" aria-hidden="true">${this.checked || this.locked ? "✓" : ""}</span>
      <div class="text">
        <div class="name">${this.name}</div>
        <div class="label">${this.meta}</div>
      </div>
      <slot name="end"></slot>
    </div>`;
  }
}
