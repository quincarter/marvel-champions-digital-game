import { html, LitElement, type PropertyDeclarations } from "lit";
import { repeat } from "lit/directives/repeat.js";
import { ThemeStyles, type StatTile } from "@mc/ui";
import { McDeckGroupTilesStyles } from "./mc-deck-group-tiles.styles.js";
import type { McDeckGroupTilesProps } from "./mc-deck-group-tiles.types.js";

/**
 * # Deck group tiles
 * The narrow Aspect tab: the deck's composition as a grid of `mc-stat-tile`s, three to a row.
 *
 * @element mc-deck-group-tiles
 */
export class McDeckGroupTiles extends LitElement implements McDeckGroupTilesProps {
  static override styles = [ThemeStyles, McDeckGroupTilesStyles];

  static override properties: PropertyDeclarations = {
    heading: { type: String },
    tiles: { attribute: false },
    empty: { type: String },
  };

  declare heading: string;
  declare tiles: readonly StatTile[];
  declare empty: string;

  constructor() {
    super();
    this.heading = "";
    this.tiles = [];
    this.empty = "";
  }

  override render() {
    return html`<div class="heading">${this.heading}</div>
      ${
        this.tiles.length === 0
          ? html`<div class="empty">${this.empty}</div>`
          : html`<div class="tiles">
              ${repeat(
                this.tiles,
                (tile) => tile.id,
                (tile) => html`<mc-stat-tile data-key=${tile.id} .text=${tile.text}></mc-stat-tile>`,
              )}
            </div>`
      }`;
  }
}
