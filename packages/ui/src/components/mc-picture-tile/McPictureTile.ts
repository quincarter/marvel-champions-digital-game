import { css, html, LitElement, type PropertyDeclarations } from "lit";
import { ThemeStyles } from "../../shared/theme.styles.js";
import { fitTextWithin } from "../../shared/fit-text.js";
import type { PictureSource } from "../../shared/picture.types.js";
import { tapped } from "../../shared/tapped.js";
import { lineOf } from "../../shared/text-line.js";
import type { TextLine } from "../../shared/text-line.types.js";
import "../mc-picture/mc-picture.js";

const styles = css`
  :host {
    display: block;
    position: relative;
    background: var(--mc-fill-paper);
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    -webkit-touch-callout: none;
    user-select: none;
  }
  mc-picture {
    position: absolute;
    left: 0;
    top: 0;
    right: 0;
    height: var(--mc-tile-art, 100px);
  }
  .stripe {
    position: absolute;
    left: 0;
    right: 0;
    top: calc(var(--mc-tile-art, 100px) - 7px);
    height: 7px;
    display: flex;
  }
  .stripe span {
    flex: 1;
  }
  .words {
    position: absolute;
    left: 8px;
    right: 8px;
    top: calc(var(--mc-tile-art, 100px) + 6px);
  }
  .line {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .border {
    position: absolute;
    inset: 0;
    box-shadow: inset 0 0 0 var(--mc-tile-border, 2px) var(--mc-line-ink);
    pointer-events: none;
  }
  .tap {
    position: absolute;
    inset: 0;
  }
`;

/**
 * # Picture tile
 * A tile: a picture (`mc-picture`) over its words, an optional stripe of colours across the picture's foot, and a frame
 * that grows heavier when the tile is `heavy` (selected, or the one in use). A tap raises `mc-activate`; a swipe's
 * lift does not. Its size is its parent's (a grid cell); the picture's height is `art-height`.
 *
 * @element mc-picture-tile
 * @attr art-height - The picture's height in px.
 * @attr heavy - The heavier frame.
 * @attr activate-key - The key `mc-activate` carries.
 * @fires mc-activate - `detail.key`: the tile was tapped.
 */
export class McPictureTile extends LitElement {
  static override styles = [ThemeStyles, styles];

  static override properties: PropertyDeclarations = {
    picture: { attribute: false },
    lines: { attribute: false },
    stripe: { attribute: false },
    artHeight: { type: Number, attribute: "art-height" },
    heavy: { type: Boolean, reflect: true },
    activateKey: { type: String, attribute: "activate-key" },
  };

  declare picture: PictureSource;
  declare lines: readonly TextLine[];
  /** Stripe colours across the picture's foot (CSS colours), equal shares. */
  declare stripe: readonly string[];
  declare artHeight: number;
  declare heavy: boolean;
  declare activateKey: string;

  constructor() {
    super();
    this.picture = { src: null };
    this.lines = [];
    this.stripe = [];
    this.artHeight = 100;
    this.heavy = false;
    this.activateKey = "";
  }

  /** The picture's element: where a card hover popover is wanted. */
  get artElement(): HTMLElement | null {
    return this.renderRoot.querySelector("mc-picture");
  }

  override updated(): void {
    fitTextWithin(this.renderRoot);
  }

  override render() {
    this.style.setProperty("--mc-tile-art", `${this.artHeight}px`);
    this.style.setProperty("--mc-tile-border", this.heavy ? "5px" : "2px");
    return html`<mc-picture .picture=${this.picture} framed></mc-picture>
      <div class="stripe">${this.stripe.map((color) => html`<span style=${`background:${color}`}></span>`)}</div>
      <div class="words">${this.lines.map(lineOf)}</div>
      <div class="border"></div>
      <div
        class="tap"
        ${tapped(() =>
          this.dispatchEvent(
            new CustomEvent("mc-activate", { detail: { key: this.activateKey }, bubbles: true, composed: true }),
          ),
        )}
      ></div>`;
  }
}
