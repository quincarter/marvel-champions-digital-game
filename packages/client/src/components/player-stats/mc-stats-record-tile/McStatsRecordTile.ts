import { html, nothing, type PropertyDeclarations } from "lit";
import { StatsTileBase } from "../shared/StatsTileBase.js";
import { McStatsRecordTileStyles } from "./mc-stats-record-tile.styles.js";
import type { McStatsRecordTileProps } from "./mc-stats-record-tile.types.js";

/**
 * # Record tile
 * The Overview's headline: wins and losses in big letters, the win rate, a track filled to the share won, and the streak.
 *
 * @element mc-stats-record-tile
 * @attr data-stop - The tile's focus stop (`tile:record`).
 */
export class McStatsRecordTile extends StatsTileBase implements McStatsRecordTileProps {
  static override styles = McStatsRecordTileStyles;

  static override properties: PropertyDeclarations = {
    ...StatsTileBase.properties,
    caption: { type: String },
    record: { type: String },
    rate: { type: String },
    fraction: { type: Number },
    detail: { type: String },
  };

  declare caption: string;
  declare record: string;
  declare rate: string;
  declare fraction: number;
  declare detail: string;

  constructor() {
    super();
    this.caption = "";
    this.record = "";
    this.rate = "";
    this.fraction = 0;
    this.detail = "";
  }

  override render() {
    return html`<div class="top">
        <span class="caption">${this.caption}</span><span class="caption">${this.rate}</span>
      </div>
      <div class="record display">${this.record}</div>
      <div class="track">
        ${
          this.fraction > 0
            ? html`<div class="fill" style=${`width:${Math.max(0, Math.min(1, this.fraction)) * 100}%`}></div>`
            : nothing
        }
      </div>
      <div class="body">${this.detail}</div>`;
  }
}
