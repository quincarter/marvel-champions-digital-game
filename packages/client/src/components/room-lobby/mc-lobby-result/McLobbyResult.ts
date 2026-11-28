import { html, LitElement, nothing, type PropertyDeclarations } from "lit";
import { McLobbyResultStyles } from "./mc-lobby-result.styles.js";
import type { LobbyStartResultModel } from "./mc-lobby-result.types.js";
import "../mc-lobby-button/mc-lobby-button.js";

/**
 * # Lobby start result
 * What the host's Start said when it did not start the game: a boxed headline marked with "!" (never colour alone), a line
 * per refused seat, and a Dismiss button. Shared by the standard and the Competitive panels.
 *
 * @element mc-lobby-result
 * @prop model - The result (`LobbyStartResultModel`); null draws nothing.
 * @fires mc-pressed - From Dismiss: `{ action: { type: "dismiss-result" }, hold: false }` (the section's relay raises it).
 */
export class McLobbyResult extends LitElement {
  static override styles = [McLobbyResultStyles];

  static override properties: PropertyDeclarations = { model: { attribute: false } };

  declare model: LobbyStartResultModel | null;

  constructor() {
    super();
    this.model = null;
  }

  override render() {
    const result = this.model;
    if (!result) return nothing;
    return html`<div class="box" role="alert">
      <div class="head">
        <span class="mark" aria-hidden="true">!</span>
        <p class="headline">${result.headline}</p>
      </div>
      ${result.lines.map((line) => html`<p class="line">${line}</p>`)}
      <mc-lobby-button .model=${result.dismiss}></mc-lobby-button>
    </div>`;
  }
}
