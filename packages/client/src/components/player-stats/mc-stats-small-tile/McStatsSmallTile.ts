import { html, type PropertyDeclarations } from "lit";
import { StatsTileBase } from "../shared/StatsTileBase.js";
import { McStatsSmallTileStyles } from "./mc-stats-small-tile.styles.js";
import type { McStatsSmallTileProps } from "./mc-stats-small-tile.types.js";

/**
 * # Small tile
 * A caption, one headline in Bangers and a line under it: the favorite aspect, a streak, a count.
 *
 * @element mc-stats-small-tile
 * @attr data-stop - The tile's focus stop.
 */
export class McStatsSmallTile extends StatsTileBase implements McStatsSmallTileProps {
  static override styles = McStatsSmallTileStyles;

  static override properties: PropertyDeclarations = {
    ...StatsTileBase.properties,
    label: { type: String },
    value: { type: String },
    detail: { type: String },
  };

  declare label: string;
  declare value: string;
  declare detail: string;

  constructor() {
    super();
    this.label = "";
    this.value = "";
    this.detail = "";
  }

  override render() {
    return html`<span class="caption">${this.label}</span>
      <div class="value display" title=${this.value}>${this.value}</div>
      <div class="body" title=${this.detail}>${this.detail}</div>`;
  }
}
