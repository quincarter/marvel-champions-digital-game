import { html, LitElement, nothing, type PropertyDeclarations } from "lit";
import { saveDataEvent, type SaveDataConfirmInput } from "../save-data.types.js";
import { McSaveDataConfirmStyles } from "./mc-save-data-confirm.styles.js";

/**
 * # Save data replace confirm
 * Importing or receiving a save replaces what is on the device, so a good file lands here first: what the file holds and
 * that it overwrites, then Cancel (stop `cancel`, with its Cancel glyph) and Replace (stop `replace`, the attack red: the
 * word says it, never the colour alone).
 *
 * @element mc-save-data-confirm
 * @prop input - `SaveDataConfirmInput`.
 * @fires mc-save-data - `{ type: "menu" }` from Cancel, `{ type: "replace" }` from Replace.
 */
export class McSaveDataConfirm extends LitElement {
  static override styles = [McSaveDataConfirmStyles];

  static override properties: PropertyDeclarations = {
    input: { attribute: false },
  };

  declare input: SaveDataConfirmInput | null;

  constructor() {
    super();
    this.input = null;
  }

  #say(type: "menu" | "replace") {
    return (event: Event): void => {
      event.stopPropagation();
      this.dispatchEvent(saveDataEvent({ type }));
    };
  }

  override render() {
    const input = this.input;
    if (!input) return nothing;
    return html`<h3 class="title">${input.title}</h3>
      <p class="body">${input.body}</p>
      <div class="buttons">
        <mc-hint-button
          kind="secondary"
          data-stop="cancel"
          .label=${input.cancelLabel}
          .glyph=${input.cancelGlyph}
          @mc-press=${this.#say("menu")}
        ></mc-hint-button>
        <mc-hint-button
          kind="primary"
          data-stop="replace"
          .label=${input.confirmLabel}
          @mc-press=${this.#say("replace")}
        ></mc-hint-button>
      </div>`;
  }
}
