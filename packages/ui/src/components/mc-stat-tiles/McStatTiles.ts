import { css, html, LitElement, type PropertyDeclarations } from "lit";
import { ThemeStyles } from "../../shared/theme.styles.js";
import type { StatTile } from "./mc-stat-tiles.types.js";

const styles = css`
  :host {
    display: block;
  }
  .row {
    display: flex;
    gap: 6px;
    margin-bottom: 6px;
  }
  .tile {
    flex: 1;
    min-width: 0;
    height: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--mc-fill-card);
    box-shadow: inset 0 0 0 3px var(--mc-line-ink);
    font-weight: 800;
    font-size: var(--mc-small-11, 11px);
    white-space: nowrap;
    overflow: hidden;
  }
`;

/**
 * # Stat tiles
 * Boxed counts in rows of equal-width cells. The caller decides how they wrap (`rows`), since that depends on how
 * much of each label has to fit.
 *
 * @element mc-stat-tiles
 */
export class McStatTiles extends LitElement {
  static override styles = [ThemeStyles, styles];

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
          ${row.map((tile) => html`<div class="tile" data-key=${tile.id}>${tile.text}</div>`)}
        </div>`,
    )}`;
  }
}
