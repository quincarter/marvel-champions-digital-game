import { html, type PropertyDeclarations } from "lit";
import type { SegmentBarPart } from "@mc/ui";
import { StatsTileBase } from "../shared/StatsTileBase.js";
import { McStatsSplitTileStyles } from "./mc-stats-split-tile.styles.js";
import type { McStatsSplitTileProps } from "./mc-stats-split-tile.types.js";

/**
 * # Split tile
 * A fact split into parts (how you lose): a caption, a stacked bar with each part's words and count in it, and a line
 * under it. The parts carry their words, so a split is never read by colour alone.
 *
 * @element mc-stats-split-tile
 * @attr data-stop - The tile's focus stop.
 */
export class McStatsSplitTile extends StatsTileBase implements McStatsSplitTileProps {
  static override styles = McStatsSplitTileStyles;

  static override properties: PropertyDeclarations = {
    ...StatsTileBase.properties,
    label: { type: String },
    parts: { attribute: false },
    detail: { type: String },
  };

  declare label: string;
  declare parts: readonly SegmentBarPart[];
  declare detail: string;

  constructor() {
    super();
    this.label = "";
    this.parts = [];
    this.detail = "";
  }

  override render() {
    return html`<span class="caption">${this.label}</span>
      <mc-segment-bar .parts=${this.parts} .height=${28} labels></mc-segment-bar>
      <div class="body">${this.detail}</div>`;
  }
}
