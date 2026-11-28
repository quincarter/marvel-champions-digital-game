import { html, LitElement, nothing, type PropertyDeclarations } from "lit";
import { repeat } from "lit/directives/repeat.js";
import "../mc-lobby-button/mc-lobby-button.js";
import type { LobbyButtonRow } from "../room-lobby.types.js";
import { McLobbyButtonRowStyles } from "./mc-lobby-button-row.styles.js";

/**
 * # Lobby button row
 * One to three `mc-lobby-button`s across one row, equal widths (a plus and a minus, a pair of choices). It raises nothing of
 * its own: each button's `mc-pressed` bubbles to the section's `FeatureRelay`.
 *
 * @element mc-lobby-button-row
 * @prop row - The buttons (`LobbyButtonRow`); an empty row draws nothing.
 * @cssprop --mc-lobby-row-gap - The space between buttons (8px).
 */
export class McLobbyButtonRow extends LitElement {
  static override styles = [McLobbyButtonRowStyles];

  static override properties: PropertyDeclarations = {
    row: { attribute: false },
  };

  declare row: LobbyButtonRow;

  constructor() {
    super();
    this.row = [];
  }

  override render() {
    this.toggleAttribute("hidden", this.row.length === 0);
    if (this.row.length === 0) return nothing;
    return html`${repeat(
      this.row,
      (button) => button.stop,
      (button) => html`<mc-lobby-button .model=${button}></mc-lobby-button>`,
    )}`;
  }
}
