import { ThemeStyles } from "@mc/ui";
import { html, LitElement, nothing, type PropertyDeclarations } from "lit";
import { repeat } from "lit/directives/repeat.js";
import { FeatureRelay } from "../../../dom/feature-relay.js";
import "../mc-lobby-button/mc-lobby-button.js";
import "../mc-lobby-button-row/mc-lobby-button-row.js";
import "../mc-lobby-people/mc-lobby-people.js";
import "../mc-lobby-team/mc-lobby-team.js";
import { LOBBY_EVENT, type LobbyCompetitiveModel, type LobbyEvent } from "../room-lobby.types.js";
import { LOBBY_STOP } from "../room-lobby.stops.js";
import { McLobbyCompetitiveStyles } from "./mc-lobby-competitive.styles.js";

/**
 * # Lobby Competitive panel
 * The Competitive seats panel: the mode's detail line, the start result (headline, lines, Dismiss), the host's 1v1 / 2v2
 * choice before the start, one `mc-lobby-team` per side, then the people, one line each. The panel's heading (`model.title`)
 * is the frame's, so it draws none; everything below scrolls in `scroller` (`list:seats`).
 *
 * @element mc-lobby-competitive
 * @prop model - What it shows (`LobbyCompetitiveModel`).
 * @prop scroller - The scrolling region, for the pad's stick and the scene's saved position.
 * @fires mc-room-lobby - `{ type: "competitive", key }` from the size buttons (`comp:size1`, `comp:size2`), and the result's
 *   `dismiss-result`.
 */
export class McLobbyCompetitive extends LitElement {
  static override styles = [ThemeStyles, McLobbyCompetitiveStyles];

  static override properties: PropertyDeclarations = {
    model: { attribute: false },
  };

  declare model: LobbyCompetitiveModel | null;

  constructor() {
    super();
    this.model = null;
    new FeatureRelay<LobbyEvent>(this, LOBBY_EVENT);
  }

  /** The `list:seats` region the pad's stick scrolls. */
  get scroller(): HTMLElement | null {
    return this.renderRoot.querySelector<HTMLElement>(".scroller");
  }

  override render() {
    const comp = this.model;
    if (!comp) return nothing;
    const result = comp.result;
    return html`<div class="scroller" data-key=${LOBBY_STOP.list("seats")} tabindex="-1">
      <p class="detail">${comp.detail}</p>
      ${
        result
          ? html`<div class="result" role="status">
              <h3>${result.headline}</h3>
              ${result.lines.map((line) => html`<p>${line}</p>`)}
              <mc-lobby-button .model=${result.dismiss}></mc-lobby-button>
            </div>`
          : nothing
      }
      ${comp.sizes ? html`<mc-lobby-button-row .row=${comp.sizes}></mc-lobby-button-row>` : nothing}
      <div class="teams">
        ${repeat(
          comp.teams,
          (team) => team.team,
          (team) => html`<mc-lobby-team .model=${team}></mc-lobby-team>`,
        )}
      </div>
      <mc-lobby-people .model=${comp.people}></mc-lobby-people>
    </div>`;
  }
}
