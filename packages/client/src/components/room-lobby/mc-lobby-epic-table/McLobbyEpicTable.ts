import { ThemeStyles } from "@mc/ui";
import { html, LitElement, nothing, type PropertyDeclarations, type PropertyValues } from "lit";
import { repeat } from "lit/directives/repeat.js";
import { FeatureRelay } from "../../../dom/feature-relay.js";
import "../mc-lobby-button-row/mc-lobby-button-row.js";
import { LOBBY_EVENT, type LobbyEpicTableModel, type LobbyEvent } from "../room-lobby.types.js";
import { McLobbyEpicTableStyles } from "./mc-lobby-epic-table.styles.js";

/**
 * # Lobby Epic table
 * One Epic table's card: its name, "Pod: ... / difficulty / status" in words, its host, the organizer's control rows (rename +
 * pod, difficulty + host, fewer + more seats, watch, retry, drop) and its seats. The seats are `mc-lobby-seat-row`s (the
 * seats section's row: deck, holder, Ask / Take / Leave, the deck button); this card adds only the frame around them. Your
 * own table has a heavier border (`mine`), never colour alone.
 *
 * @element mc-lobby-epic-table
 * @prop model - What it shows (`LobbyEpicTableModel`).
 * @attr mine - Set from the model: the heavier border.
 * @fires mc-room-lobby - `{ type: "epic", key }` from its control buttons; a seat row's own events pass through.
 */
export class McLobbyEpicTable extends LitElement {
  static override styles = [ThemeStyles, McLobbyEpicTableStyles];

  static override properties: PropertyDeclarations = {
    model: { attribute: false },
    mine: { type: Boolean, reflect: true },
  };

  declare model: LobbyEpicTableModel | null;
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
    const table = this.model;
    if (!table) return nothing;
    return html`<h3 class="name" data-key=${`epic-table:${table.id}`}>${table.name}</h3>
      <p class="facts">${table.facts}</p>
      <p class="host">${table.hostLine}</p>
      ${
        table.controls.length > 0
          ? html`<div class="controls">
              ${table.controls.map((row) => html`<mc-lobby-button-row .row=${row}></mc-lobby-button-row>`)}
            </div>`
          : nothing
      }
      <div class="seats">
        ${repeat(
          table.seats,
          (row) => row.id,
          (row) => html`<mc-lobby-seat-row .model=${row}></mc-lobby-seat-row>`,
        )}
      </div>`;
  }
}
