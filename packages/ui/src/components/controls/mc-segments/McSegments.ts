import { html, LitElement, nothing, type PropertyDeclarations } from "lit";
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
 * With a `heading` it is a settings row: the title over a line of `detail` on the left and the strip on the right
 * (`--segments-width`, 300px, wide), the strip dropping under the words where the row is too narrow for both. Without
 * one it is the bare strip, as it always was.
 *
 * @prop options - The cells (`McSegmentOption`).
 * @attr look - cell | tile.
 * @attr heading - The row's title; none: the bare strip.
 * @attr detail - The line under the title.
 * @attr dimmed - Faded but still adjustable (a row whose feature is off).
 */
export class McSegments extends LitElement {
  static override styles = McSegmentsStyles;

  static override properties: PropertyDeclarations = {
    options: { attribute: false },
    look: { type: String, reflect: true },
    heading: { type: String },
    detail: { type: String },
    dimmed: { type: Boolean, reflect: true },
  };

  declare options: readonly McSegmentOption[];
  declare look: "cell" | "tile";
  declare heading: string;
  declare detail: string;
  declare dimmed: boolean;

  constructor() {
    super();
    this.options = [];
    this.look = "cell";
    this.heading = "";
    this.detail = "";
    this.dimmed = false;
  }

  override render() {
    const strip = html`<div class="strip" role="group">
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
    if (!this.heading) return strip;
    return html`<div class="row">
      <div class="text">
        <span class="heading">${this.heading}</span>
        ${this.detail ? html`<span class="detail">${this.detail}</span>` : nothing}
      </div>
      ${strip}
    </div>`;
  }
}
