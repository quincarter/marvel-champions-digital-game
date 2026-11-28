import { html, nothing, type PropertyDeclarations } from "lit";
import { SeatsElement } from "../SeatsElement.js";
import type { SeatModel, SeatPairModel, SeatSummaryModel } from "../seats.types.js";
import "../mc-seat-card/mc-seat-card.js";
import "../mc-seat-chip/mc-seat-chip.js";
import "../mc-seat-summary/mc-seat-summary.js";
import { McSeatsTableStyles } from "./mc-seats-table.styles.js";

/** At most this many Team-Up rows show under the seats, as the strip always held. */
export const MAX_PAIR_ROWS = 3;

/**
 * # Seats table
 * The four seats in one row (a card each on a wide screen, a compact chip each on a narrow one), the Team-Up pairs under
 * them and, narrow, the active seat's summary strip. The pairs are CSS: each pair is a row of the same four columns as the
 * seats, a bracket from the middle of one partner's column to the middle of the other's, and a pill centered on it. It only
 * says what the table has and takes no press. The seats and the summary raise `mc-seats` themselves.
 *
 * @element mc-seats-table
 * @prop seats - The four seats (`SeatModel`).
 * @prop pairs - The seated Team-Up pairs (`SeatPairModel`), the first three shown.
 * @prop summary - The active seat's strip (`SeatSummaryModel`), or null where the layout has none.
 * @attr compact - Chips instead of cards (the narrow layouts).
 */
export class McSeatsTable extends SeatsElement {
  static override styles = [McSeatsTableStyles];

  static override properties: PropertyDeclarations = {
    seats: { attribute: false },
    pairs: { attribute: false },
    summary: { attribute: false },
    compact: { type: Boolean, reflect: true },
  };

  declare seats: readonly SeatModel[];
  declare pairs: readonly SeatPairModel[];
  declare summary: SeatSummaryModel | null;
  declare compact: boolean;

  constructor() {
    super();
    this.seats = [];
    this.pairs = [];
    this.summary = null;
    this.compact = false;
  }

  /** The table raises nothing of its own: its seats and summary do. */
  protected override act(): void {}

  override render() {
    return html`
      <div class="seats">
        ${this.seats.map((seat) =>
          this.compact
            ? html`<mc-seat-chip .model=${seat}></mc-seat-chip>`
            : html`<mc-seat-card .model=${seat}></mc-seat-card>`,
        )}
      </div>
      ${
        this.pairs.length > 0
          ? html`<ol class="pairs">
              ${this.pairs.slice(0, MAX_PAIR_ROWS).map((pair) => this.#pair(pair))}
            </ol>`
          : nothing
      }
      ${this.summary ? html`<mc-seat-summary .model=${this.summary}></mc-seat-summary>` : nothing}
    `;
  }

  #pair(pair: SeatPairModel) {
    const from = Math.min(pair.seats[0], pair.seats[1]);
    const to = Math.max(pair.seats[0], pair.seats[1]);
    return html`<li class="pair" data-from=${from} data-to=${to} data-span=${to - from + 1}>
      <span class="pill">
        ${pair.picture ? html`<mc-picture-tile class="badge" .picture=${pair.picture} .frame=${1}></mc-picture-tile>` : nothing}
        <span class="words">${pair.label}</span>
      </span>
    </li>`;
  }
}
