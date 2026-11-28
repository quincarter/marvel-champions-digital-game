import { html, nothing, type PropertyDeclarations } from "lit";
import type { PictureSource } from "@mc/ui";
import { StatsTileBase } from "../shared/StatsTileBase.js";
import { McStatsPortraitTileStyles } from "./mc-stats-portrait-tile.styles.js";
import type { McStatsPortraitTileProps, StatsPortraitVariant } from "./mc-stats-portrait-tile.types.js";

/**
 * # Portrait tile
 * A hero's or villain's picture with its caption, name and record: the favorite hero standing tall on a wide Overview, a
 * banner on a phone, or a picture over the words. The picture is leased by the scene and handed in.
 *
 * @element mc-stats-portrait-tile
 * @attr variant - tall | banner | stack.
 * @attr data-stop - The tile's focus stop.
 */
export class McStatsPortraitTile extends StatsTileBase implements McStatsPortraitTileProps {
  static override styles = McStatsPortraitTileStyles;

  static override properties: PropertyDeclarations = {
    ...StatsTileBase.properties,
    variant: { type: String, reflect: true },
    label: { type: String },
    name: { type: String },
    detail: { type: String },
    extra: { type: String },
    picture: { attribute: false },
  };

  declare variant: StatsPortraitVariant;
  declare label: string;
  declare name: string;
  declare detail: string;
  declare extra: string;
  declare picture: PictureSource | null;

  constructor() {
    super();
    this.variant = "stack";
    this.label = "";
    this.name = "";
    this.detail = "";
    this.extra = "";
    this.picture = null;
  }

  override render() {
    return html`<mc-picture-tile
        .picture=${this.picture ?? { src: null }}
        .frame=${0}
        ground="parchment"
      ></mc-picture-tile>
      <div class="words">
        <span class="caption">${this.label}</span>
        <div class="name display" title=${this.name}>${this.name}</div>
        <div class="line body">${this.detail}</div>
        ${this.extra ? html`<div class="line extra body">${this.extra}</div>` : nothing}
      </div>`;
  }
}
