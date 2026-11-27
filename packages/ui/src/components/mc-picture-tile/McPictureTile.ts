import { html, LitElement, nothing, type PropertyDeclarations } from "lit";
import { ThemeStyles } from "../../shared/theme.styles.js";
import type { PictureFit, PictureFocus, PictureGround } from "../../shared/picture.types.js";
import type { PictureErrorDetail } from "./mc-picture-tile.types.js";
import { McPictureTileStyles } from "./mc-picture-tile.styles.js";

/**
 * # Picture tile
 * A picture in a frame and nothing else: the file loads when it scrolls near (`loading="lazy"`), fills the box cropped
 * around a focal point (or fits whole with `fit="contain"`, a card scan), and says `missing` in a word when there is no
 * picture or it fails to load, so a missing picture never reads as an empty box. Decorative: the part that holds it
 * takes any press, hover and focus ring. Captions, chips and badges are compositions built from it
 * (`mc-picture-card`).
 *
 * @element mc-picture-tile
 * @attr src - The picture's URL; empty for none.
 * @attr missing - What the box says while there is no picture, already translated.
 * @attr fit - cover (default) | contain.
 * @prop subject - Where the subject sits (`PictureFocus`, 0 to 1 each way; centered by default). Used by `cover`.
 * @attr frame - The ink frame's width in px (2; 0 for none).
 * @attr ground - spent (default) | ink | parchment: what shows behind and round the picture.
 * @attr letter - `missing` is one letter drawn big and faint (a pack initial) rather than a small caption.
 * @attr dim - A gray, faded ghost of the picture on its ground (a locked tile).
 * @fires mc-image-load - The picture loaded.
 * @fires mc-image-error - The picture failed to load; `detail.src` (`PictureErrorDetail`).
 */
export class McPictureTile extends LitElement {
  static override styles = [ThemeStyles, McPictureTileStyles];

  static override properties: PropertyDeclarations = {
    src: { type: String },
    missing: { type: String },
    fit: { type: String, reflect: true },
    subject: { attribute: false },
    frame: { type: Number },
    ground: { type: String, reflect: true },
    dim: { type: Boolean, reflect: true },
    letter: { type: Boolean },
    failedSrc: { state: true },
  };

  declare src: string;
  declare missing: string;
  declare fit: PictureFit;
  declare subject: PictureFocus;
  declare frame: number;
  declare ground: PictureGround;
  declare dim: boolean;
  declare letter: boolean;
  /** The URL that failed to load, so the box says `missing` for it and tries again for a new one. */
  declare failedSrc: string;

  constructor() {
    super();
    this.src = "";
    this.missing = "";
    this.fit = "cover";
    this.subject = { x: 0.5, y: 0.5 };
    this.frame = 2;
    this.ground = "spent";
    this.dim = false;
    this.letter = false;
    this.failedSrc = "";
  }

  override render() {
    const gone = this.src === "" || this.failedSrc === this.src;
    return html`<div class="tile" style=${this.frame > 0 ? `outline-width:${this.frame}px` : "outline:none"}>
      ${
        gone
          ? this.missing
            ? html`<span class=${this.letter ? "missing letter" : "missing"}>${this.missing}</span>`
            : nothing
          : html`<img
              class=${this.dim ? "dim" : ""}
              src=${this.src}
              alt=""
              loading="lazy"
              decoding="async"
              draggable="false"
              style=${
                this.fit === "cover"
                  ? `object-fit:cover;object-position:${this.subject.x * 100}% ${this.subject.y * 100}%`
                  : "object-fit:contain"
              }
              @load=${() => this.dispatchEvent(new CustomEvent("mc-image-load", { bubbles: true, composed: true }))}
              @error=${() => {
                this.failedSrc = this.src;
                const detail: PictureErrorDetail = { src: this.src };
                this.dispatchEvent(new CustomEvent("mc-image-error", { detail, bubbles: true, composed: true }));
              }}
            />`
      }
    </div>`;
  }
}
