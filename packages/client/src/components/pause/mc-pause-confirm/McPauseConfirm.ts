import { html, nothing, type PropertyDeclarations } from "lit";
import type { PauseConfirmInput } from "../pause.types.js";
import { PauseElement } from "../shared/PauseElement.js";
import { McPauseConfirmStyles } from "./mc-pause-confirm.styles.js";

/**
 * # Pause confirm
 * The confirm dialog over Pause (Concede: "This ends the game for the whole table", or a guest leaving the seat): a
 * sentence and two buttons, the destructive one in Hero Red. It covers the whole sheet with a dim backdrop, so the
 * buttons never share a line with the menu and a short screen cannot draw it over anything.
 *
 * Focus stops: `concede-confirm-yes`, `concede-confirm-cancel`.
 *
 * @element mc-pause-confirm
 * @prop input - The sentence and the two labels (`PauseConfirmInput`), or none for no dialog.
 * @fires mc-pause - `{ type: "menu", id: "concede-confirm-yes" | "concede-confirm-cancel" }`.
 */
export class McPauseConfirm extends PauseElement {
  static override styles = McPauseConfirmStyles;

  static override properties: PropertyDeclarations = {
    input: { attribute: false },
  };

  declare input: PauseConfirmInput | null;

  constructor() {
    super();
    this.input = null;
  }

  override render() {
    const input = this.input;
    if (!input) return nothing;
    return html`<div class="backdrop">
      <div class="dialog" role="alertdialog" aria-label=${input.sentence}>
        <p class="sentence">${input.sentence}</p>
        <div class="buttons">
          <mc-button
            kind="primary"
            display
            data-stop="concede-confirm-yes"
            .label=${input.yes}
            @mc-press=${() => this.say({ type: "menu", id: "concede-confirm-yes" })}
          ></mc-button>
          <mc-button
            kind="onInk"
            display
            data-stop="concede-confirm-cancel"
            .label=${input.cancel}
            @mc-press=${() => this.say({ type: "menu", id: "concede-confirm-cancel" })}
          ></mc-button>
        </div>
      </div>
    </div>`;
  }
}
