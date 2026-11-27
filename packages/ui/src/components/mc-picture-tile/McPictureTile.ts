import { html, LitElement, nothing, type PropertyDeclarations } from "lit";
import { ThemeStyles } from "../../shared/theme.styles.js";
import type { McPictureTileModel } from "./mc-picture-tile.types.js";
import { McPictureTileStyles } from "./mc-picture-tile.styles.js";

/**
 * # Picture tile
 * A shelf tile: a picture (a lazy `<img>`, cropped around a focal point; a gray faded ghost when `dim`), a status chip
 * on it, and a caption strip with a title and a detail line, in one ink frame. Decorative: the screen puts a tap area
 * over it (the press, the hover and the focus ring belong to the screen, not the tile).
 *
 * @element mc-picture-tile
 * @prop model - What it shows (`McPictureTileModel`).
 */
export class McPictureTile extends LitElement {
  static override styles = [ThemeStyles, McPictureTileStyles];

  static override properties: PropertyDeclarations = { model: { attribute: false } };

  declare model: McPictureTileModel | null;

  constructor() {
    super();
    this.model = null;
  }

  override render() {
    const m = this.model;
    if (!m) return nothing;
    const caption = m.captionHeight ?? 52;
    return html`
      <div class="art" style=${`bottom:${caption}px`}>
        ${
          m.src
            ? html`<img
                class=${m.dim ? "dim" : ""}
                src=${m.src}
                alt=""
                loading="lazy"
                decoding="async"
                draggable="false"
                style=${`object-position:50% ${m.focusY * 100}%`}
              />`
            : html`<span class="initial" style=${`font-size:${Math.round(this.clientHeight * 0.3)}px`}
                >${m.initial}</span
              >`
        }
        <span class=${m.chipTone === "locked" ? "chip locked" : "chip"}>${m.chip}</span>
      </div>
      <div class="caption" style=${`height:${caption}px`}>
        <div class="title">${m.title}</div>
        <div class=${m.detailTone === "alert" ? "detail alert" : "detail"}>${m.detail}</div>
      </div>
      <div class="frame"></div>
    `;
  }
}
