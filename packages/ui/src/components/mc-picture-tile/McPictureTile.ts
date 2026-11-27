import { html, LitElement, nothing, type PropertyDeclarations } from "lit";
import { objectPositionFor } from "../../shared/crop.js";
import { ThemeStyles } from "../../shared/theme.styles.js";
import type { PictureFit, PictureFocus, PictureGround, PictureSource } from "../../shared/picture.types.js";
import type { PictureErrorDetail } from "./mc-picture-tile.types.js";
import { McPictureTileStyles } from "./mc-picture-tile.styles.js";

/**
 * # Picture tile
 * A picture in a frame and nothing else: the file loads when it scrolls near (`loading="lazy"`), fills the box cropped
 * around a focal point (or fits whole with `fit="contain"`, a card scan), and says `missing` in a word when there is no
 * picture or it fails to load, so a missing picture never reads as an empty box. Decorative: the part that holds it
 * takes any press, hover and focus ring. Captions, chips and badges are compositions built from it
 * (`mc-picture-card`, `mc-list-row`, `mc-media-row`).
 *
 * The picture comes either as separate properties (`src`, `missing`, `fit`, `subject`) or as one `picture`
 * (`PictureSource`: src, fill, missing, cover with an optional centered crop, retry), which wins when set.
 *
 * @element mc-picture-tile
 * @attr src - The picture's URL; empty for none.
 * @attr missing - What the box says while there is no picture, already translated.
 * @attr fit - cover (default) | contain.
 * @prop subject - Where the subject sits (`PictureFocus`, 0 to 1 each way; centered by default). Used by `cover`.
 * @prop picture - The picture as one value (`PictureSource`); overrides `src`, `missing`, `fit` and `subject`.
 * @attr frame - The ink frame's width in px (2; 0 for none).
 * @attr ground - spent (default) | ink | parchment: what shows behind and round the picture.
 * @attr dim - A gray, faded ghost of the picture on its ground (a locked tile).
 * @attr letter - `missing` is one letter drawn big and faint (a pack initial) rather than a small caption.
 * @fires mc-image-load - The picture loaded.
 * @fires mc-image-error - The picture failed to load; `detail.src` (`PictureErrorDetail`), and `detail.key` (the
 *   `picture.retry`, once per key until one loads) when the picture names where its URL came from.
 */
export class McPictureTile extends LitElement {
  static override styles = [ThemeStyles, McPictureTileStyles];

  static override properties: PropertyDeclarations = {
    src: { type: String },
    missing: { type: String },
    fit: { type: String, reflect: true },
    subject: { attribute: false },
    picture: { attribute: false },
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
  declare picture: PictureSource | null;
  declare frame: number;
  declare ground: PictureGround;
  declare dim: boolean;
  declare letter: boolean;
  /** The URL that failed to load, so the box says `missing` for it and tries again for a new one. */
  declare failedSrc: string;
  /** Retry keys already asked about; cleared when one of their pictures loads. */
  readonly #retried = new Set<string>();
  /** The natural size of each picture that has loaded, for a crop centered on a focal point. */
  readonly #sizes = new Map<string, { width: number; height: number }>();

  constructor() {
    super();
    this.src = "";
    this.missing = "";
    this.fit = "cover";
    this.subject = { x: 0.5, y: 0.5 };
    this.picture = null;
    this.frame = 2;
    this.ground = "spent";
    this.dim = false;
    this.letter = false;
    this.failedSrc = "";
  }

  override render() {
    const p = this.picture;
    const src = p ? (p.src ?? "") : this.src;
    const missing = p ? (p.missing ?? "") : this.missing;
    const fit: PictureFit = p ? (p.cover ? "cover" : "contain") : this.fit;
    const subject = p?.cover ?? this.subject;
    const retry = p?.retry;
    const gone = src === "" || this.failedSrc === src;
    const outline = this.frame > 0 ? `outline-width:${this.frame}px` : "outline:none";
    return html`<div class="tile" style=${p?.fill ? `${outline};background:${p.fill}` : outline}>
      ${
        gone
          ? missing
            ? html`<span class=${this.letter ? "missing letter" : "missing"}>${missing}</span>`
            : nothing
          : html`<img
              class=${this.dim ? "dim" : ""}
              src=${src}
              alt=""
              loading="lazy"
              decoding="async"
              draggable="false"
              style=${fit === "cover" ? `object-fit:cover;object-position:${objectPositionFor(subject, this.#sizes.get(src), { width: this.clientWidth || 1, height: this.clientHeight || 1 })}` : "object-fit:contain"}
              @load=${(event: Event) => {
                if (retry !== undefined) this.#retried.delete(retry);
                const img = event.target as HTMLImageElement;
                if (subject.centered && !this.#sizes.has(src) && img.naturalWidth > 0) {
                  this.#sizes.set(src, { width: img.naturalWidth, height: img.naturalHeight });
                  this.requestUpdate();
                }
                this.dispatchEvent(new CustomEvent("mc-image-load", { bubbles: true, composed: true }));
              }}
              @error=${() => {
                this.failedSrc = src;
                const detail: PictureErrorDetail = { src, ...(retry !== undefined ? { key: retry } : {}) };
                // A picture that names its source asks once per key; one that does not reports every failure.
                if (retry !== undefined) {
                  if (this.#retried.has(retry)) return;
                  this.#retried.add(retry);
                }
                this.dispatchEvent(new CustomEvent("mc-image-error", { detail, bubbles: true, composed: true }));
              }}
            />`
      }
    </div>`;
  }
}
