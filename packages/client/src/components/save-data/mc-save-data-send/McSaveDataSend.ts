import { html, LitElement, nothing, type PropertyDeclarations } from "lit";
import { saveDataEvent, type SaveDataSendInput } from "../save-data.types.js";
import { McSaveDataSendStyles } from "./mc-save-data-send.styles.js";

/**
 * # Save data Send
 * The Send step: while the save uploads, only its title; then the instructions, the code in the mono face, the countdown
 * and a QR code (`mc-qr-code`) of the receive link beside the text where there is room and under it where there is not.
 * Copy code (stop `copy`) turns into New code (stop `new-code`) when the code runs out; Back (stop `back-menu`) returns to
 * the six rows. The code is shown in full, never clipped: it wraps before it overflows.
 *
 * @element mc-save-data-send
 * @prop input - `SaveDataSendInput`.
 * @fires mc-save-data - `{ type: "copy" }`, `{ type: "new-code" }` or `{ type: "menu" }`.
 */
export class McSaveDataSend extends LitElement {
  static override styles = [McSaveDataSendStyles];

  static override properties: PropertyDeclarations = {
    input: { attribute: false },
  };

  declare input: SaveDataSendInput | null;

  constructor() {
    super();
    this.input = null;
  }

  #say(type: "copy" | "new-code" | "menu") {
    return (event: Event): void => {
      event.stopPropagation();
      this.dispatchEvent(saveDataEvent({ type }));
    };
  }

  override render() {
    const input = this.input;
    if (!input) return nothing;
    if (input.phase === "uploading") return html`<h3 class="title">${input.title}</h3>`;
    const first = input.expired
      ? { stop: "new-code", label: input.newCodeLabel, type: "new-code" as const }
      : { stop: "copy", label: input.copyLabel, type: "copy" as const };
    return html`<div class="layout">
      <div class="text">
        <h3 class="title">${input.title}</h3>
        <p class="help">${input.help}</p>
        <p class="code" data-key="code">${input.code}</p>
        <p class="countdown" data-key="countdown">${input.countdown}</p>
        <div class="buttons">
          <mc-hint-button
            kind="secondary"
            data-stop=${first.stop}
            .label=${first.label}
            @mc-press=${this.#say(first.type)}
          ></mc-hint-button>
          <mc-hint-button
            kind="secondary"
            data-stop="back-menu"
            .label=${input.backLabel}
            .glyph=${input.backGlyph}
            @mc-press=${this.#say("menu")}
          ></mc-hint-button>
        </div>
      </div>
      <mc-qr-code .rows=${input.qr} .label=${input.link}></mc-qr-code>
    </div>`;
  }
}
