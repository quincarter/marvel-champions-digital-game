import { html, LitElement, nothing, type PropertyDeclarations } from "lit";
import { repeat } from "lit/directives/repeat.js";
import { FeatureRelay } from "../../../dom/feature-relay.js";
import { LOBBY_EVENT, type LobbyEvent } from "../room-lobby.types.js";
import { LOBBY_STOP } from "../room-lobby.stops.js";
import { McLobbySeatsStyles } from "./mc-lobby-seats.styles.js";
import type { LobbySeatsModel } from "./mc-lobby-seats.types.js";
import "../mc-lobby-button/mc-lobby-button.js";
import "../mc-lobby-people/mc-lobby-people.js";
import "../mc-lobby-plan/mc-lobby-plan.js";
import "../mc-lobby-result/mc-lobby-result.js";
import "../mc-lobby-seat-count/mc-lobby-seat-count.js";
import "../mc-lobby-seat-row/mc-lobby-seat-row.js";

/**
 * # Lobby seats panel (standard)
 * The standard room's seats panel, built to `LobbySeatsModel`: an optional heading, then in one scrolling list the host's
 * hint, "Set up the table" and the seat-count stepper, the table plan (or a guest's note), the start result with its
 * Dismiss, the seat rows, and the people. Every press is an `mc-lobby-button` whose command this section's
 * `FeatureRelay` turns into the one `mc-room-lobby` event; pictures are leased `PictureSource`s and card pictures raise
 * the hover and Inspect events (`watchCard`).
 *
 * The list is `list:seats` (`data-key`), exposed as `scroller` for the pad's stick and the scene's kept scroll position.
 *
 * @element mc-lobby-seats
 * @prop model - The panel (`LobbySeatsModel`); null draws nothing.
 * @fires mc-room-lobby - `LobbyEvent`, from any button inside.
 * @fires mc-card-hover - See `watchCard`.
 * @fires mc-card-hover-end - See `watchCard`.
 * @fires mc-card-inspect - See `watchCard`.
 */
export class McLobbySeats extends LitElement {
  static override styles = [McLobbySeatsStyles];

  static override properties: PropertyDeclarations = { model: { attribute: false } };

  declare model: LobbySeatsModel | null;


  constructor() {
    super();
    this.model = null;
    new FeatureRelay<LobbyEvent>(this, LOBBY_EVENT);
  }

  /** The seats list (`list:seats`): what the pad's stick scrolls and the scene keeps the position of. */
  get scroller(): HTMLElement | null {
    return this.renderRoot.querySelector<HTMLElement>(`[data-key="${LOBBY_STOP.list("seats")}"]`);
  }

  #host(panel: LobbySeatsModel) {
    if (!panel.host) return nothing;
    return html`${panel.hint ? html`<p class="hint">${panel.hint}</p>` : nothing}
    ${panel.setup ? html`<mc-lobby-button .model=${panel.setup}></mc-lobby-button>` : nothing}
    ${panel.seatCount ? html`<mc-lobby-seat-count .model=${panel.seatCount}></mc-lobby-seat-count>` : nothing}`;
  }

  override render() {
    const panel = this.model;
    if (!panel) return nothing;
    return html`<section class="panel" aria-label=${panel.title ?? ""}>
      ${panel.title ? html`<h2 class="title">${panel.title}</h2>` : nothing}
      <div class="list" data-key=${LOBBY_STOP.list("seats")}>
        ${this.#host(panel)} ${panel.plan ? html`<mc-lobby-plan .model=${panel.plan}></mc-lobby-plan>` : nothing}
        ${panel.note ? html`<p class="note">${panel.note}</p>` : nothing}
        ${panel.result ? html`<mc-lobby-result .model=${panel.result}></mc-lobby-result>` : nothing}
        ${panel.rows.length === 0 && panel.noSeats ? html`<p class="none">${panel.noSeats}</p>` : nothing}
        ${repeat(
          panel.rows,
          (row) => row.id,
          (row) => html`<mc-lobby-seat-row .model=${row}></mc-lobby-seat-row>`,
        )}
        <mc-lobby-people .model=${panel.people}></mc-lobby-people>
      </div>
    </section>`;
  }
}
