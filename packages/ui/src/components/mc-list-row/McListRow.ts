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
    height: 76px;
    background: var(--mc-fill-paper);
    -webkit-tap-highlight-color: transparent;
    -webkit-touch-callout: none;
    user-select: none;
  }
  .border {
    position: absolute;
    inset: 0;
    box-shadow: inset 0 0 0 var(--mc-row-border, 2px) var(--mc-line-ink);
    pointer-events: none;
  }
  mc-picture {
    position: absolute;
    left: 10px;
    top: 10px;
    width: 56px;
    height: 56px;
  }
  .words {
    position: absolute;
    left: 76px;
    right: 110px;
    top: 8px;
  }
  .line {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .tap {
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    right: 108px;
    cursor: pointer;
  }
  .trailing {
    position: absolute;
    right: 10px;
    top: 16px;
    width: 92px;
    height: 44px;
  }
  ::slotted(*) {
    display: block;
    width: 100%;
    height: 100%;
  }
`;

/**
 * # List row
 * A row 76px high: a square picture, up to three lines of words and, at the right, a control in the `trailing` slot
 * (a Pick button, 92 by 44px). A tap on the row (not on the control) raises `mc-activate`; a swipe's lift does not.
 *
 * @element mc-list-row
 * @attr heavy - The heavier frame (selected, or in use).
 * @attr activate-key - The key `mc-activate` carries.
 * @slot trailing - The control at the right.
 * @fires mc-activate - `detail.key`: the row was tapped.
 */
export class McListRow extends LitElement {
  static override styles = [ThemeStyles, styles];

  static override properties: PropertyDeclarations = {
    picture: { attribute: false },
    lines: { attribute: false },
    heavy: { type: Boolean, reflect: true },
    activateKey: { type: String, attribute: "activate-key" },
  };

  declare picture: PictureSource;
  declare lines: readonly TextLine[];
  declare heavy: boolean;
  declare activateKey: string;

  constructor() {
    super();
    this.picture = { src: null };
    this.lines = [];
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
    this.style.setProperty("--mc-row-border", this.heavy ? "5px" : "2px");
    return html`<div class="border"></div>
      <mc-picture .picture=${this.picture} framed></mc-picture>
      <div class="words">${this.lines.map(lineOf)}</div>
      <div
        class="tap"
        ${tapped(() =>
          this.dispatchEvent(
            new CustomEvent("mc-activate", { detail: { key: this.activateKey }, bubbles: true, composed: true }),
          ),
        )}
      ></div>
      <div class="trailing"><slot name="trailing"></slot></div>`;
  }
}
