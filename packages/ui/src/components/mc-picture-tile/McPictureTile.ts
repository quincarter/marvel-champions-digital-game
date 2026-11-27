import { css, html, LitElement, nothing, type PropertyDeclarations } from "lit";
import { ThemeStyles } from "../../shared/theme.styles.js";
import type { PictureFocusPoint } from "../../shared/display.types.js";

/**
 * # Picture tile
 * A picture in a box: a card scan, a hero or a villain. It loads lazily (only near the view) and decodes off the main
 * thread; with no `src`, or one that fails, the box says `missing` instead. Fitted whole by default, or `cover`-cropped
 * around `subject`. Decorative: hover and Inspect hooks live on the area the owner lays over it.
 *
 * @element mc-picture-tile
 * @attr src - The picture's URL; empty for none.
 * @attr missing - What the box says with no picture (already translated).
 * @attr cover - Fill the box, cropped, instead of fitting the whole picture.
 * @attr framed - A thin ink frame over the picture.
 */
export class McPictureTile extends LitElement {
  static override styles = [
    ThemeStyles,
    css`
      :host {
        display: block;
        position: relative;
        overflow: hidden;
        background: var(--mc-fill-parchment);
      }
      img {
        display: block;
        width: 100%;
        height: 100%;
        object-fit: contain;
        user-select: none;
      }
      :host([cover]) img {
        object-fit: cover;
      }
      :host([framed])::after {
        content: "";
        position: absolute;
        inset: 0;
        border: 1.5px solid color-mix(in srgb, var(--mc-line-ink) 60%, transparent);
        pointer-events: none;
      }
      .missing {
        position: absolute;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 4px;
        text-align: center;
        font-weight: 800;
        font-size: var(--mc-small-9, 9px);
        letter-spacing: 1.2px;
        opacity: 0.6;
      }
    `,
  ];
  static override properties: PropertyDeclarations = {
    src: { type: String },
    missing: { type: String },
    cover: { type: Boolean, reflect: true },
    framed: { type: Boolean, reflect: true },
    subject: { attribute: false },
    failed: { state: true },
  };
  declare src: string;
  declare missing: string;
  declare cover: boolean;
  declare framed: boolean;
  declare subject: PictureFocusPoint | undefined;
  declare failed: boolean;

  constructor() {
    super();
    this.src = "";
    this.missing = "";
    this.cover = false;
    this.framed = false;
    this.failed = false;
  }

  override willUpdate(changed: Map<string, unknown>): void {
    if (changed.has("src")) this.failed = false;
  }

  override render() {
    const gone = this.src === "" || this.failed;
    const position = this.subject ? `object-position:${this.subject.x * 100}% ${this.subject.y * 100}%` : nothing;
    if (gone) return this.missing ? html`<span class="missing">${this.missing}</span>` : nothing;
    return html`<img
      src=${this.src}
      alt=""
      loading="lazy"
      decoding="async"
      draggable="false"
      style=${position}
      @error=${() => (this.failed = true)}
    />`;
  }
}
