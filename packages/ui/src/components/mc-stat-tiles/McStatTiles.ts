import { html, LitElement, type PropertyDeclarations } from "lit";
import { ThemeStyles } from "../../shared/theme.styles.js";
import "../mc-stat-tile/mc-stat-tile.js";
import { McStatTilesStyles } from "./mc-stat-tiles.styles.js";
import type { StatTile } from "./mc-stat-tiles.types.js";

/**
 * # Stat tiles
 * Boxed counts (`mc-stat-tile`) in rows of equal-width cells. The caller decides how they wrap (`rows`), since that
 * depends on how much of each label has to fit.
 *
 * @element mc-stat-tiles
 */
export class McStatTiles extends LitElement {
  static override styles = [ThemeStyles, McStatTilesStyles];

  static override properties: PropertyDeclarations = { rows: { attribute: false } };

  declare rows: readonly (readonly StatTile[])[];

  constructor() {
    super();
    this.rows = [];
  }

  override render() {
    return html`${this.rows.map(
      (row) =>
        html`<div class="row">
          ${row.map((tile) => html`<mc-stat-tile data-key=${tile.id} .text=${tile.text}></mc-stat-tile>`)}
        </div>`,
    )}`;
  }
}
