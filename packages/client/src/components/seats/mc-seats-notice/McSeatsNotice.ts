import { html, nothing, type PropertyDeclarations } from "lit";
import { SeatsElement } from "../SeatsElement.js";
import { McSeatsNoticeStyles } from "./mc-seats-notice.styles.js";

/**
 * # Seats notice
 * The same-name clash strip under the seats ("2 cards can't be played with these heroes ▸"): a caution-filled, ink-outlined
 * button that opens the sheet answering it. The words carry the meaning, never the colour. Stop `conflict-notice`.
 *
 * @element mc-seats-notice
 * @prop text - The words, already translated; empty draws nothing.
 * @fires mc-seats - `{ type: "action", action: "conflict-notice" }`.
 */
export class McSeatsNotice extends SeatsElement {
  static override styles = [McSeatsNoticeStyles];

  static override properties: PropertyDeclarations = { text: { type: String } };

  declare text: string;

  constructor() {
    super();
    this.text = "";
  }

  protected override act(action: string): void {
    if (action === "notice") this.emit({ type: "action", action: "conflict-notice" });
  }

  override render() {
    if (this.text === "") return nothing;
    return html`<button type="button" data-action="notice" data-stop="conflict-notice">${this.text}</button>`;
  }
}
