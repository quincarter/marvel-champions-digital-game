import { html, LitElement, type PropertyDeclarations } from "lit";
import { repeat } from "lit/directives/repeat.js";
import "../mc-segment-cell/mc-segment-cell.js";
import type { McSegmentOption } from "./mc-segments.types.js";
import { McSegmentsStyles } from "./mc-segments.styles.js";

/**
 * # Segments
 * A strip of `mc-segment-cell`s on an ink ground, one per option, equal in width (a card size, a guide level, a choice
 * a search found). Each cell is its own focus stop and raises its own `mc-pressed`; this holds no state.
 *
 * @element mc-segments
 * @prop options - The cells (`McSegmentOption`).
 * @attr look - cell | tile.
 */
export class McSegments extends LitElement {
  static override styles = McSegmentsStyles;

  static override properties: PropertyDeclarations = {
    options: { attribute: false },
    look: { type: String, reflect: true },
  };

  declare options: readonly McSegmentOption[];
  declare look: "cell" | "tile";

  constructor() {
    super();
    this.options = [];
    this.look = "cell";
  }

  override render() {
    return html`<div class="strip" role="group">
      ${repeat(
        this.options,
        (option) => option.stop,
        (option) =>
          html`<mc-segment-cell
            .stop=${option.stop}
            .label=${option.label}
            .detail=${option.detail ?? ""}
            .look=${this.look}
            ?selected=${option.selected}
            .action=${option.action}
          ></mc-segment-cell>`,
      )}
    </div>`;
  }
}
