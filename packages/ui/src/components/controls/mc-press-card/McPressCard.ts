import { html, type PropertyDeclarations } from "lit";
import { McPress } from "../../../shared/press/McPress.js";
import { McPressCardStyles } from "./mc-press-card.styles.js";

/**
 * # Press card
 * A framed white card that is itself a control (a difficulty, Tower Defense's toggle, a modular set): a thin outline,
 * or a 4px red border when chosen. Its content is slotted; a tap raises `action`, a hold raises `holdAction`.
 *
 * @element mc-press-card
 * @attr selected - Chosen: the red border.
 * @attr dim - Unavailable: faded.
 * @prop action - What a tap raises.
 * @prop holdAction - What a hold or Inspect raises, or none.
 * @slot - The card's content.
 * @fires mc-pressed - `PressDetail`.
 */
export class McPressCard extends McPress {
  static override styles = [McPressCardStyles];

  static override properties: PropertyDeclarations = {
    ...McPress.properties,
    selected: { type: Boolean, reflect: true },
    dim: { type: Boolean, reflect: true },
  };

  declare selected: boolean;
  declare dim: boolean;

  constructor() {
    super();
    this.selected = false;
    this.dim = false;
  }

  override render() {
    return html`<div class="frame">
      <div class="inner"><slot></slot></div>
    </div>`;
  }
}
