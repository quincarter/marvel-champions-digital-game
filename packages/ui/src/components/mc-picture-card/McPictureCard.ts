import { html, LitElement, nothing, type PropertyDeclarations } from "lit";
import { ThemeStyles } from "../../shared/theme.styles.js";
import "../mc-picture-tile/mc-picture-tile.js";
import type { PictureErrorDetail } from "../mc-picture-tile/mc-picture-tile.types.js";
import type { McPictureCardModel } from "./mc-picture-card.types.js";
import { McPictureCardStyles } from "./mc-picture-card.styles.js";

/**
 * # Picture card
 * A shelf card: an `mc-picture-tile` (cropped around a focal point; a gray faded ghost when `dim`) with a status chip on
 * it and a caption strip with a title and a detail line, in one ink frame. With no picture, or one that fails to load,
 * the faint `initial` stands in. Decorative: the screen puts a tap area over it (the press, the hover and the focus ring
 * belong to the screen, not the card). `mc-image-load` and `mc-image-error` from the picture bubble up unchanged.
 *
 * @element mc-picture-card
 * @prop model - What it shows (`McPictureCardModel`).
 */
export class McPictureCard extends LitElement {
  static override styles = [ThemeStyles, McPictureCardStyles];

  static override properties: PropertyDeclarations = {
    model: { attribute: false },
    failedSrc: { state: true },
  };

  declare model: McPictureCardModel | null;
  /** The URL that failed to load, so the initial stands in for it. */
  declare failedSrc: string;

  constructor() {
    super();
    this.model = null;
    this.failedSrc = "";
  }

  override render() {
    const m = this.model;
    if (!m) return nothing;
    const caption = m.captionHeight ?? 52;
    const gone = !m.src || m.src === this.failedSrc;
    return html`
      <div class="art" style=${`bottom:${caption}px`}>
        ${
          m.src
            ? html`<mc-picture-tile
                .src=${m.src}
                .subject=${{ x: 0.5, y: m.focusY }}
                .frame=${0}
                .dim=${m.dim}
                ground="ink"
                @mc-image-error=${(event: CustomEvent<PictureErrorDetail>) => {
                  this.failedSrc = event.detail.src;
                }}
              ></mc-picture-tile>`
            : nothing
        }
        ${
          gone
            ? html`<span class="initial" style=${`font-size:${Math.round(this.clientHeight * 0.3)}px`}
                >${m.initial}</span
              >`
            : nothing
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
