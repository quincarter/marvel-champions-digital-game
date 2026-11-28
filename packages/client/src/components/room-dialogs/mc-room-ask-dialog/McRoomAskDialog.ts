import { ThemeStyles, type McTextField } from "@mc/ui";
import { html, LitElement, nothing, type PropertyDeclarations } from "lit";
import { roomDialogEvent, type RoomAskModel } from "../room-dialogs.types.js";
import { McRoomAskDialogStyles } from "./mc-room-ask-dialog.styles.js";

/**
 * # Ask for a change (dialog)
 * A seated guest's note to the host: a heading, a line of explanation, a one-line text field and Cancel / Send. The field is
 * a real input, so the phone's keyboard and caret are the browser's. Presses raise `mc-room-dialog` `{ type: "press", key }`
 * with `cancel` or `send`; a tap on the scrim raises `mc-dialog-dismiss`; the text is the field's own `mc-input`.
 *
 * Focus stops: `field`, `cancel`, `send`.
 *
 * @element mc-room-ask-dialog
 * @prop model - The dialog (`RoomAskModel`).
 * @fires mc-room-dialog - `RoomDialogEvent`.
 */
export class McRoomAskDialog extends LitElement {
  static override styles = [ThemeStyles, McRoomAskDialogStyles];

  static override properties: PropertyDeclarations = { model: { attribute: false } };

  declare model: RoomAskModel | null;

  constructor() {
    super();
    this.model = null;
  }

  /** The note field, for the scene's caret, blur and `restoreValue`. */
  get field(): McTextField | null {
    return this.renderRoot.querySelector<McTextField>("mc-text-field");
  }

  #press = (event: CustomEvent<{ key: string }>): void => {
    event.stopPropagation();
    this.dispatchEvent(roomDialogEvent({ type: "press", key: event.detail.key }));
  };

  override render() {
    const m = this.model;
    if (!m) return nothing;
    return html`<mc-dialog .heading=${m.heading} .width=${520}>
      <p class="body">${m.body}</p>
      <mc-text-field
        class="field"
        data-stop="field"
        data-key="field"
        .value=${m.value}
        .placeholder=${m.placeholder}
      ></mc-text-field>
      <div slot="footer" class="buttons">
        <mc-popup-button .button=${m.cancel} .glyph=${m.glyphs[m.cancel.key] ?? null} @mc-activate=${this.#press}>
        </mc-popup-button>
        <mc-popup-button .button=${m.send} .glyph=${m.glyphs[m.send.key] ?? null} @mc-activate=${this.#press}>
        </mc-popup-button>
      </div>
    </mc-dialog>`;
  }
}
