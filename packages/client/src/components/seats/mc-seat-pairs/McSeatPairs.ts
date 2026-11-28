import { html, LitElement, nothing, type PropertyDeclarations } from "lit";
import type { SeatPairModel } from "../seats.types.js";
import { McSeatPairsStyles } from "./mc-seat-pairs.styles.js";

/**
 * # Seat pairs
 * The Team-Up strip under the seat cards: for each pair a bracket drops from the centre of one partner's card, runs across
 * under the cards between them and rises to the other's, with a pill on the line saying "Team-Up: Colossus and Shadowcat"
 * (with the pair's picture where there is art). It sits in a four-column grid that must line up with the seat cards' columns
 * (set `--mc-seats-gap` to the cards' gap). Deeper pairs drop lower, so the brackets never cross a pill. The strip only
 * says what the table has: it takes no press and is no stop.
 *
 * @element mc-seat-pairs
 * @prop pairs - The pairs (`SeatPairModel[]`; `seats` are 1-based seat numbers, the lower first, 1 to 4).
 */
export class McSeatPairs extends LitElement {
  static override styles = [McSeatPairsStyles];

  static override properties: PropertyDeclarations = { pairs: { attribute: false } };

  declare pairs: readonly SeatPairModel[];

  constructor() {
    super();
    this.pairs = [];
  }

  override render() {
    if (this.pairs.length === 0) return nothing;
    return html`<div class="strip" data-rows=${this.pairs.length} role="list">
      ${this.pairs.map((pair, index) => {
        const [from, to] = [Math.min(...pair.seats), Math.max(...pair.seats)];
        return html`<div
          class="bracket"
          role="listitem"
          data-from=${from}
          data-span=${to - from + 1}
          data-row=${index + 1}
        >
          <span class="pill">
            ${pair.picture ? html`<mc-picture-tile class="badge" .picture=${pair.picture} .frame=${1}></mc-picture-tile>` : nothing}
            <span class="label">${pair.label}</span>
          </span>
        </div>`;
      })}
    </div>`;
  }
}
