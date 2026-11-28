import type { McTextField } from "@mc/ui";
import { html, LitElement, nothing, type PropertyDeclarations } from "lit";
import { saveDataEvent, type SaveDataReceiveInput } from "../save-data.types.js";
import { McSaveDataReceiveStyles } from "./mc-save-data-receive.styles.js";

/**
 * # Save data Receive
 * The Receive step: the instructions, the code field (`mc-text-field`, stop `code`, 18px mono so a code reads the same
 * everywhere; the screen keeps what was typed), Receive (stop `receive`) and Back (stop `back-menu`). Enter in the field
 * asks for the save as the button does. While the service answers only the title shows.
 *
 * @element mc-save-data-receive
 * @prop input - `SaveDataReceiveInput`.
 * @fires mc-save-data - `{ type: "receive" }` or `{ type: "menu" }`.
 * @fires mc-input - The field's text (`McInputDetail`), passed through.
 * @fires mc-field-focus - The caret went into or left the field, passed through.
 */
export class McSaveDataReceive extends LitElement {
  static override styles = [McSaveDataReceiveStyles];

  static override properties: PropertyDeclarations = {
    input: { attribute: false },
  };

  declare input: SaveDataReceiveInput | null;

  constructor() {
    super();
    this.input = null;
  }

  /** The code field, for the scene's caret rules. */
  get field(): McTextField | null {
    return this.renderRoot.querySelector("mc-text-field");
  }

  /** Enter asks for the save. Heard in the capture phase: the field stops the key itself, so it never bubbles to here. */
  readonly #enter = (event: KeyboardEvent): void => {
    if (event.key !== "Enter" || event.isComposing) return;
    this.dispatchEvent(saveDataEvent({ type: "receive" }));
  };

  #say(type: "receive" | "menu") {
    return (event: Event): void => {
      event.stopPropagation();
      this.dispatchEvent(saveDataEvent({ type }));
    };
  }

  override render() {
    const input = this.input;
    if (!input) return nothing;
    if (input.fetching) return html`<h3 class="title">${input.title}</h3>`;
    return html`<h3 class="title">${input.title}</h3>
      <p class="help">${input.help}</p>
      <mc-text-field
        data-stop="code"
        .value=${input.value}
        .placeholder=${input.placeholder}
        .size=${18}
        @keydown=${{ handleEvent: this.#enter, capture: true }}
      ></mc-text-field>
      <div class="buttons">
        <mc-hint-button
          kind="secondary"
          data-stop="receive"
          .label=${input.receiveLabel}
          @mc-press=${this.#say("receive")}
        ></mc-hint-button>
        <mc-hint-button
          kind="secondary"
          data-stop="back-menu"
          .label=${input.backLabel}
          .glyph=${input.backGlyph}
          @mc-press=${this.#say("menu")}
        ></mc-hint-button>
      </div>`;
  }
}
