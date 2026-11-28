import { html, LitElement, type PropertyDeclarations } from "lit";
import { repeat } from "lit/directives/repeat.js";
import { ThemeStyles, type StatTile } from "@mc/ui";
import "../mc-deck-card-row/mc-deck-card-row.js";
import { McDeckSummaryStyles } from "./mc-deck-summary.styles.js";
import type { DeckCardRowModel } from "../mc-deck-card-row/mc-deck-card-row.types.js";
import type { McDeckSummaryProps } from "./mc-deck-summary.types.js";

/**
 * # Deck summary
 * The narrow Curve tab under its chart: a row of `mc-stat-tile`s (how many resources, allies and events) and the
 * deck's lines (`mc-deck-card-row`). The page scrolls it natively when the deck is longer than the screen.
 *
 * @element mc-deck-summary
 */
export class McDeckSummary extends LitElement implements McDeckSummaryProps {
  static override styles = [ThemeStyles, McDeckSummaryStyles];

  static override properties: PropertyDeclarations = { tiles: { attribute: false }, rows: { attribute: false } };

  declare tiles: readonly StatTile[];
  declare rows: readonly DeckCardRowModel[];

  constructor() {
    super();
    this.tiles = [];
    this.rows = [];
  }

  override render() {
    return html`<div class="tiles">
        ${repeat(
          this.tiles,
          (tile) => tile.id,
          (tile) => html`<mc-stat-tile data-key=${tile.id} .text=${tile.text}></mc-stat-tile>`,
        )}
      </div>
      <div class="rows">
        ${repeat(
          this.rows,
          (row) => row.id,
          (row) =>
            html`<mc-deck-card-row
              .cost=${row.cost}
              .costColor=${row.costColor}
              .name=${row.name}
              .quantity=${row.quantity}
            ></mc-deck-card-row>`,
        )}
      </div>`;
  }
}
