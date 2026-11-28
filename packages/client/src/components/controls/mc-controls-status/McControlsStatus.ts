import { html, LitElement, type PropertyDeclarations } from "lit";
import { McControlsStatusStyles } from "./mc-controls-status.styles.js";

/**
 * # Controls status
 * Whether a controller is connected, in words: "Xbox controller connected: <pad>" with a filled dot, or "No controller
 * connected" with a hollow one. The words carry the state; the dot only repeats it (a filled and a hollow shape, never
 * colour alone). A polite live region, so a pad plugged in is announced.
 *
 * @element mc-controls-status
 * @attr connected - A pad is connected.
 * @attr text - The status line, already translated.
 */
export class McControlsStatus extends LitElement {
  static override styles = [McControlsStatusStyles];

  static override properties: PropertyDeclarations = {
    connected: { type: Boolean, reflect: true },
    text: { type: String },
  };

  declare connected: boolean;
  declare text: string;

  constructor() {
    super();
    this.connected = false;
    this.text = "";
  }

  override render() {
    return html`<span class="dot" aria-hidden="true"></span><span class="text" role="status">${this.text}</span>`;
  }
}
