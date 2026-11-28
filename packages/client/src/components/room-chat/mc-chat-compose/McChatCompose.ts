import { ThemeStyles, type McTextField } from "@mc/ui";
import { html, LitElement, type PropertyDeclarations } from "lit";
import { roomChatEvent } from "../room-chat.types.js";
import { McChatComposeStyles } from "./mc-chat-compose.styles.js";

/**
 * # Chat compose
 * The text field and Send: the field is a real input (`mc-text-field`, one line, IME-safe), so a phone's keyboard, caret and
 * selection are the browser's and survive a redraw. The text travels in the field's own `mc-input` (the scene keeps the draft
 * and hands it back as `value`); Send and Enter raise `mc-room-chat` `{ type: "send" }`. Stops: `chat-field`, `chat-send`
 * (the keys are properties, as the in-game dialog names them differently).
 *
 * @element mc-chat-compose
 * @attr value - The draft.
 * @attr placeholder - The field's words.
 * @attr send-label - Send's word.
 * @attr max - The longest line (the scene enforces it through `restoreValue`).
 * @attr disabled - Send is off (the room has ended): Enter does nothing either.
 * @attr field-stop - The field's `data-stop` ("chat-field").
 * @attr send-stop - Send's `data-stop` ("chat-send").
 * @fires mc-room-chat - `RoomChatEvent`.
 */
export class McChatCompose extends LitElement {
  static override styles = [ThemeStyles, McChatComposeStyles];

  static override properties: PropertyDeclarations = {
    value: { type: String },
    placeholder: { type: String },
    sendLabel: { type: String, attribute: "send-label" },
    disabled: { type: Boolean, reflect: true },
    fieldStop: { type: String, attribute: "field-stop" },
    sendStop: { type: String, attribute: "send-stop" },
  };

  declare value: string;
  declare placeholder: string;
  declare sendLabel: string;
  declare disabled: boolean;
  declare fieldStop: string;
  declare sendStop: string;

  constructor() {
    super();
    this.value = "";
    this.placeholder = "";
    this.sendLabel = "";
    this.disabled = false;
    this.fieldStop = "chat-field";
    this.sendStop = "chat-send";
  }

  /** The text field, for the scene's `restoreValue`, focus and blur. */
  get field(): McTextField | null {
    return this.renderRoot.querySelector<McTextField>("mc-text-field");
  }

  // Captured on the field's host: the field itself stops Enter (it leaves the field), and Enter here sends the line.
  #key = (event: KeyboardEvent): void => {
    if (event.key !== "Enter" || event.isComposing || this.disabled) return;
    this.dispatchEvent(roomChatEvent({ type: "send", via: "enter" }));
  };

  override render() {
    return html`<mc-text-field
        class="field"
        data-stop=${this.fieldStop}
        data-key=${this.fieldStop}
        .value=${this.value}
        .placeholder=${this.placeholder}
        @keydown=${{ handleEvent: this.#key, capture: true }}
      ></mc-text-field>
      <mc-button
        class="send"
        kind="primary"
        data-stop=${this.sendStop}
        data-key=${this.sendStop}
        .label=${this.sendLabel}
        ?disabled=${this.disabled}
        @mc-press=${(event: Event) => {
          event.stopPropagation();
          this.dispatchEvent(roomChatEvent({ type: "send", via: "button" }));
        }}
      ></mc-button>`;
  }
}
