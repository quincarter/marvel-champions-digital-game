import { html, nothing, type PropertyDeclarations } from "lit";
import { McPress } from "../../../shared/press/McPress.js";
import { McSegmentCellStyles } from "./mc-segment-cell.styles.js";

/**
 * # Segment cell
 * One cell of a segmented control on an ink ground: ink with a paper frame, or caution yellow with a tick when chosen (the
 * tick and the fill say it, never the colour alone). `look="tile"` adds a second line of detail under the label.
 *
 * @element mc-segment-cell
 * @attr label - The cell's words, already translated.
 * @attr detail - A tile's second line.
 * @attr selected - Chosen.
 * @attr look - cell | tile.
 * @prop action - What a tap raises.
 * @fires mc-pressed - `PressDetail`.
 */
export class McSegmentCell extends McPress {
  static override styles = McSegmentCellStyles;

  static override properties: PropertyDeclarations = {
    ...McPress.properties,
    label: { type: String },
    detail: { type: String },
    selected: { type: Boolean, reflect: true },
    look: { type: String, reflect: true },
  };

  declare label: string;
  declare detail: string;
  declare selected: boolean;
  declare look: "cell" | "tile";

  constructor() {
    super();
    this.label = "";
    this.detail = "";
    this.selected = false;
    this.look = "cell";
  }

  override render() {
    return html`<div class="cell">
      <span class="label">${this.label}</span>
      ${this.look === "tile" && this.detail ? html`<span class="detail">${this.detail}</span>` : nothing}
    </div>`;
  }
}
