import { ThemeStyles } from "@mc/ui";
import { html, LitElement, nothing, type PropertyDeclarations } from "lit";
import { FeatureRelay } from "../../../dom/feature-relay.js";
import "../mc-lobby-button/mc-lobby-button.js";
import { LOBBY_EVENT, type LobbyEvent, type LobbyFooterModel } from "../room-lobby.types.js";
import { LOBBY_STOP } from "../room-lobby.stops.js";
import { McLobbyFooterStyles } from "./mc-lobby-footer.styles.js";

/**
 * # Lobby footer
 * The ink strip across the bottom: a line of words (why Start is off, what the room refused, what the host is doing) and,
 * for the host, the Start button (or Stay / Close room, or Back to title). Wide, the words sit left of the button; narrow, the
 * button goes under them.
 *
 * @element mc-lobby-footer
 * @prop model - What it shows (`LobbyFooterModel`).
 * @fires mc-room-lobby - `{ type: "footer", action }` and `blocked`, from its buttons.
 */
export class McLobbyFooter extends LitElement {
  static override styles = [ThemeStyles, McLobbyFooterStyles];

  static override properties: PropertyDeclarations = { model: { attribute: false } };

  declare model: LobbyFooterModel | null;

  constructor() {
    super();
    this.model = null;
    new FeatureRelay<LobbyEvent>(this, LOBBY_EVENT);
  }

  override render() {
    const m = this.model;
    this.toggleAttribute("hidden", m?.hidden === true);
    if (!m) return nothing;
    return html`<div class="foot" data-buttons=${m.buttons.length}>
      <p class="words" data-key=${LOBBY_STOP.footerWords} ?data-bold=${m.bold}>${m.words}</p>
      ${
        m.buttons.length > 0
          ? html`<div class="buttons">
              ${m.buttons.map((b) => html`<mc-lobby-button .model=${b}></mc-lobby-button>`)}
            </div>`
          : nothing
      }
    </div>`;
  }
}
