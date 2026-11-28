import { ThemeStyles } from "@mc/ui";
import { html, LitElement, nothing, type PropertyDeclarations, type PropertyValues } from "lit";
import { repeat } from "lit/directives/repeat.js";
import { FeatureRelay } from "../../../dom/feature-relay.js";
import "../mc-lobby-button/mc-lobby-button.js";
import { LOBBY_EVENT, type LobbyEvent, type LobbyTeamModel } from "../room-lobby.types.js";
import { McLobbyTeamStyles } from "./mc-lobby-team.styles.js";

/**
 * # Lobby team
 * One side's card in a Competitive room: its title and status in words ("Sealed · Not ready"), its seats (each an
 * `mc-lobby-seat-row` with an optional "Move to ..." button under it), the host's "speak for this side" button, then the seal
 * and Ready buttons. Your own side has a heavier border (`mine`), never colour alone. It never shows the sealed scenario.
 *
 * @element mc-lobby-team
 * @prop model - What it shows (`LobbyTeamModel`).
 * @attr mine - Set from the model: the heavier border.
 * @fires mc-room-lobby - `{ type: "competitive", key }` from its buttons (`team:<seat>`, `speak:<team>`, `seal:<team>`,
 *   `ready:<team>`); a seat row's own events pass through.
 */
export class McLobbyTeam extends LitElement {
  static override styles = [ThemeStyles, McLobbyTeamStyles];

  static override properties: PropertyDeclarations = {
    model: { attribute: false },
    mine: { type: Boolean, reflect: true },
  };

  declare model: LobbyTeamModel | null;
  declare mine: boolean;

  constructor() {
    super();
    this.model = null;
    this.mine = false;
    new FeatureRelay<LobbyEvent>(this, LOBBY_EVENT);
  }

  protected override willUpdate(_changed: PropertyValues): void {
    this.mine = this.model?.mine === true;
  }

  override render() {
    const team = this.model;
    if (!team) return nothing;
    return html`<h3 class="title" data-key=${`team:${team.team}`}>${team.title}</h3>
      <p class="status">${team.status}</p>
      <div class="seats">
        ${repeat(
          team.seats,
          (seat) => seat.row.id,
          (seat) =>
            html`<div class="seat">
              <mc-lobby-seat-row .model=${seat.row}></mc-lobby-seat-row>
              ${seat.move ? html`<mc-lobby-button .model=${seat.move}></mc-lobby-button>` : nothing}
            </div>`,
        )}
      </div>
      <div class="actions">
        ${team.speak ? html`<mc-lobby-button .model=${team.speak}></mc-lobby-button>` : nothing}
        <mc-lobby-button .model=${team.seal}></mc-lobby-button>
        <mc-lobby-button .model=${team.ready}></mc-lobby-button>
      </div>`;
  }
}
