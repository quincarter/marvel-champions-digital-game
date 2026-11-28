import { ThemeStyles } from "@mc/ui";
import { html, LitElement, nothing, type PropertyDeclarations } from "lit";
import { repeat } from "lit/directives/repeat.js";
import { FeatureRelay } from "../../../dom/feature-relay.js";
import "../mc-lobby-button-row/mc-lobby-button-row.js";
import "../mc-lobby-people/mc-lobby-people.js";
import "../mc-lobby-epic-table/mc-lobby-epic-table.js";
import { LOBBY_EVENT, type LobbyEpicModel, type LobbyEvent } from "../room-lobby.types.js";
import { LOBBY_STOP } from "../room-lobby.stops.js";
import { McLobbyEpicStyles } from "./mc-lobby-epic.styles.js";

/**
 * # Lobby Epic panel
 * The Epic seats panel: the hint, the organizer's fewer / more tables with the time-limit button and its note (everyone else
 * gets the limit as a line), one `mc-lobby-epic-table` per table, then the people, one line each. The panel's heading
 * (`model.title`) is the frame's, so it draws none; everything below scrolls in `scroller` (`list:seats`).
 *
 * @element mc-lobby-epic
 * @prop model - What it shows (`LobbyEpicModel`).
 * @prop scroller - The scrolling region, for the pad's stick and the scene's saved position.
 * @fires mc-room-lobby - `{ type: "epic", key }` from the organizer's buttons (`epic:fewer`, `epic:more`, `epic:limit`).
 */
export class McLobbyEpic extends LitElement {
  static override styles = [ThemeStyles, McLobbyEpicStyles];

  static override properties: PropertyDeclarations = {
    model: { attribute: false },
  };

  declare model: LobbyEpicModel | null;

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
    const epic = this.model;
    if (!epic) return nothing;
    const organizer = epic.organizer;
    return html`<div class="scroller" data-key=${LOBBY_STOP.list("seats")} tabindex="-1">
      <p class="hint">${epic.hint}</p>
      ${
        organizer
          ? html`<div class="organizer">
              <mc-lobby-button-row .row=${organizer.tables}></mc-lobby-button-row>
              <mc-lobby-button-row .row=${[organizer.limit]}></mc-lobby-button-row>
              <p class="note">${organizer.note}</p>
            </div>`
          : epic.limitLine !== null
            ? html`<p class="limit">${epic.limitLine}</p>`
            : nothing
      }
      <div class="tables">
        ${repeat(
          epic.tables,
          (table) => table.id,
          (table) => html`<mc-lobby-epic-table .model=${table}></mc-lobby-epic-table>`,
        )}
      </div>
      <mc-lobby-people .model=${epic.people}></mc-lobby-people>
    </div>`;
  }
}
