import { html, nothing, type PropertyDeclarations } from "lit";
import { ThemeStyles, type PictureSource } from "@mc/ui";
import { ViewerElement } from "../shared/ViewerElement.js";
import { McViewerSlideStyles } from "./mc-viewer-slide.styles.js";
import type { McViewerSlideProps } from "./mc-viewer-slide.types.js";

/**
 * # Viewer slide
 * The picture shown whole (fitted, never cropped) on the ink ground, with the arrows to the file's other pictures at its
 * left and right edges and the caption ("Cover - 2 / 5") under it. With no picture it says so in a word. The arrows are
 * the focus stops `prev` and `next`.
 *
 * @element mc-viewer-slide
 * @fires mc-viewer - `{ type: "step", direction }`.
 */
export class McViewerSlide extends ViewerElement implements McViewerSlideProps {
  static override styles = [ThemeStyles, McViewerSlideStyles];

  static override properties: PropertyDeclarations = {
    picture: { attribute: false },
    caption: { type: String },
    empty: { type: String },
    arrows: { type: Boolean },
  };

  declare picture: PictureSource | null;
  declare caption: string;
  declare empty: string;
  declare arrows: boolean;

  constructor() {
    super();
    this.picture = null;
    this.caption = "";
    this.empty = "";
    this.arrows = false;
  }

  #arrow(direction: 1 | -1) {
    return html`<mc-button
      class=${direction < 0 ? "arrow prev" : "arrow next"}
      kind="onInk"
      data-stop=${direction < 0 ? "prev" : "next"}
      .label=${direction < 0 ? "◂" : "▸"}
      @mc-press=${() => this.emit({ type: "step", direction })}
    ></mc-button>`;
  }

  override render() {
    return html`<div class="frame">
        ${
          this.picture
            ? html`<mc-picture-tile .picture=${this.picture} .frame=${0} ground="ink"></mc-picture-tile>`
            : html`<span class="none">${this.empty}</span>`
        }
        ${this.arrows ? html`${this.#arrow(-1)}${this.#arrow(1)}` : nothing}
      </div>
      <div class="caption">${this.caption}</div>`;
  }
}
