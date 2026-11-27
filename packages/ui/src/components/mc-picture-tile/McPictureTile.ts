import { html, LitElement, nothing, type PropertyDeclarations } from "lit";
import { ThemeStyles } from "../../shared/theme.styles.js";
import { McPictureTileStyles } from "./mc-picture-tile.styles.js";

/**
 * # Picture tile
 * A picture in a frame: the file loads when it scrolls near (`loading="lazy"`), fills the box cropped around a focal
 * point (or fits whole with `fit="contain"`, a card scan), and says `missing` in a word when there is no picture or it
 * fails to load, so a missing picture never reads as an empty box. Decorative: the part that holds it takes any press.
 *
 * @element mc-picture-tile
 * @attr src - The picture's URL; empty for none.
 * @attr missing - What the box says while there is no picture, already translated.
 * @attr fit - cover (default) | contain.
 * @attr focus-x - Where the subject sits across the picture, 0 to 1 (cover).
 * @attr focus-y - Where the subject sits down the picture, 0 to 1 (cover).
 * @attr frame - The ink frame's width in px (0 for none).
 * @fires mc-image-load - The picture loaded.
 * @fires mc-image-error - The picture failed to load; `detail.src`.
 */
export class McPictureTile extends LitElement {
  static override styles = [ThemeStyles, McPictureTileStyles];

  static override properties: PropertyDeclarations = {
    src: { type: String },
    missing: { type: String },
    fit: { type: String, reflect: true },
    focusX: { type: Number, attribute: "focus-x" },
    focusY: { type: Number, attribute: "focus-y" },
    frame: { type: Number },
    failedSrc: { state: true },
  };

  declare src: string;
  declare missing: string;
  declare fit: "cover" | "contain";
  declare focusX: number;
  declare focusY: number;
  declare frame: number;
  /** The URL that failed to load, so the box says `missing` for it and tries again for a new one. */
  declare failedSrc: string;

  constructor() {
    super();
    this.src = "";
    this.missing = "";
    this.fit = "cover";
    this.focusX = 0.5;
    this.focusY = 0.5;
    this.frame = 2;
    this.failedSrc = "";
  }

  override render() {
    const gone = this.src === "" || this.failedSrc === this.src;
    return html`<div class="tile" style=${this.frame > 0 ? `outline-width:${this.frame}px` : "outline:none"}>
      ${
        gone
          ? this.missing
            ? html`<span class="missing">${this.missing}</span>`
            : nothing
          : html`<img
              src=${this.src}
              alt=""
              loading="lazy"
              decoding="async"
              draggable="false"
              style=${
                this.fit === "cover"
                  ? `object-fit:cover;object-position:${this.focusX * 100}% ${this.focusY * 100}%`
                  : "object-fit:contain"
              }
              @load=${() => this.dispatchEvent(new CustomEvent("mc-image-load", { bubbles: true, composed: true }))}
              @error=${() => {
                this.failedSrc = this.src;
                this.dispatchEvent(
                  new CustomEvent("mc-image-error", { detail: { src: this.src }, bubbles: true, composed: true }),
                );
              }}
            />`
      }
    </div>`;
  }
}
