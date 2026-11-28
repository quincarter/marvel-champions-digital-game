import { html, type PropertyDeclarations } from "lit";
import { StatsTileBase } from "../shared/StatsTileBase.js";
import { McStatsFiguresTileStyles } from "./mc-stats-figures-tile.styles.js";
import type { McStatsFiguresTileProps, StatsFigureLine } from "./mc-stats-figures-tile.types.js";

/**
 * # Figures tile
 * A caption over a few labelled figures ("Each game": rounds, damage, threat removed), the label at the left and the
 * value at the right.
 *
 * @element mc-stats-figures-tile
 * @attr data-stop - The tile's focus stop.
 */
export class McStatsFiguresTile extends StatsTileBase implements McStatsFiguresTileProps {
  static override styles = McStatsFiguresTileStyles;

  static override properties: PropertyDeclarations = {
    ...StatsTileBase.properties,
    label: { type: String },
    lines: { attribute: false },
  };

  declare label: string;
  declare lines: readonly StatsFigureLine[];

  constructor() {
    super();
    this.label = "";
    this.lines = [];
  }

  override render() {
    return html`<span class="caption">${this.label}</span>
      <dl>
        ${this.lines.map(
          (line) =>
            html`<dt>${line.label}</dt>
              <dd>${line.value}</dd>`,
        )}
      </dl>`;
  }
}
