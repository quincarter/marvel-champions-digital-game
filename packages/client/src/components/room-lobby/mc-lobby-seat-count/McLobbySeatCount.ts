import { html, LitElement, nothing, type PropertyDeclarations } from "lit";
import { McLobbySeatCountStyles } from "./mc-lobby-seat-count.styles.js";
import type { LobbySeatCountModel } from "./mc-lobby-seat-count.types.js";
import "../mc-lobby-button/mc-lobby-button.js";

/**
 * # Lobby seat count
 * The host's seat-count control: the `@mc/ui` stepper with "Seats: 3" in its middle chip and the model's own "−" and "+"
 * lobby buttons in its arrow slots (each says why it is off when it has a reason: a seat somebody holds is never dropped by
 * a press), and the hint under it. `mc-stepper` must be defined (the `@mc/ui` entry does it).
 *
 * @element mc-lobby-seat-count
 * @prop model - The control (`LobbySeatCountModel`); null draws nothing.
 * @fires mc-pressed - From either button: `{ action: { type: "seat-count", to }, hold: false }`.
 */
export class McLobbySeatCount extends LitElement {
  static override styles = [McLobbySeatCountStyles];

  static override properties: PropertyDeclarations = { model: { attribute: false } };

  declare model: LobbySeatCountModel | null;

  constructor() {
    super();
    this.model = null;
  }

  override render() {
    const count = this.model;
    if (!count) return nothing;
    return html`<mc-stepper .label=${count.label} .nameStop=${""}>
        <mc-lobby-button slot="prev" .model=${count.less}></mc-lobby-button>
        <mc-lobby-button slot="next" .model=${count.more}></mc-lobby-button>
      </mc-stepper>
      <p class="hint">${count.hint}</p>`;
  }
}
