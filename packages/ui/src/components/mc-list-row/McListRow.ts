import { html, LitElement, nothing, type PropertyDeclarations, type PropertyValues } from "lit";
import { ThemeStyles } from "../../shared/theme.styles.js";
import { fitTextWithin } from "../../shared/fit-text.js";
import type { PictureSource } from "../../shared/picture.types.js";
import { tapped } from "../../shared/tapped.js";
import { lineOf } from "../../shared/text-line.js";
import type { TextLine } from "../../shared/text-line.types.js";
import "../mc-picture-tile/mc-picture-tile.js";
import type { McListRowModel } from "./mc-list-row.types.js";
import { McListRowStyles } from "./mc-list-row.styles.js";

/**
 * # List row
 * One row of a list, in one of two shapes:
 *
 * - **Badge row** (`model`, `McListRowModel`): a round badge, a title and a detail line. States read by more than
 *   color: a closed row dims its title and prints its detail as the red "what opens it" line, the current row inverts
 *   to ink. Decorative: the screen puts a tap area over it.
 * - **Picture row** (`picture` and/or `lines`): 76px high, a square `mc-picture-tile`, up to three `TextLine`s and, at
 *   the right, a control in the `trailing` slot (a Pick button, 92 by 44px). A `heavy` frame marks the selected row or
 *   the one in use. With an `activate-key` a tap on the row (not on the control) raises `mc-activate`; a swipe lift
 *   does not.
 *
 * @element mc-list-row
 * @prop model - A badge row (`McListRowModel`).
 * @prop picture - A picture row's picture (`PictureSource`).
 * @prop lines - A picture row's words.
 * @attr heavy - The heavier frame (picture row).
 * @attr activate-key - The key `mc-activate` carries; with none the row takes no press of its own.
 * @attr rich - Reflected: the row is a picture row.
 * @slot trailing - The control at the right of a picture row.
 * @fires mc-activate - `detail.key`: the picture row was tapped.
 */
export class McListRow extends LitElement {
  static override styles = [ThemeStyles, McListRowStyles];

  static override properties: PropertyDeclarations = {
    model: { attribute: false },
    picture: { attribute: false },
    lines: { attribute: false },
    heavy: { type: Boolean, reflect: true },
    activateKey: { type: String, attribute: "activate-key" },
    rich: { type: Boolean, reflect: true },
  };

  declare model: McListRowModel | null;
  declare picture: PictureSource | null;
  declare lines: readonly TextLine[];
  declare heavy: boolean;
  declare activateKey: string;
  declare rich: boolean;

  constructor() {
    super();
    this.model = null;
    this.picture = null;
    this.lines = [];
    this.heavy = false;
    this.activateKey = "";
    this.rich = false;
  }

  /** The picture element of a picture row: where a card hover popover is wanted. */
  get artElement(): HTMLElement | null {
    return this.renderRoot.querySelector("mc-picture-tile");
  }

  protected override willUpdate(_changed: PropertyValues): void {
    this.rich = this.picture !== null || this.lines.length > 0;
  }

  override updated(): void {
    fitTextWithin(this.renderRoot);
  }

  #activate = (): void => {
    this.dispatchEvent(
      new CustomEvent("mc-activate", { detail: { key: this.activateKey }, bubbles: true, composed: true }),
    );
  };

  override render() {
    if (this.rich) {
      this.classList.remove("closed", "active");
      this.style.setProperty("--mc-row-border", this.heavy ? "5px" : "2px");
      return html`<div class="border"></div>
        <mc-picture-tile .picture=${this.picture ?? { src: null }} .frame=${2}></mc-picture-tile>
        <div class="words">${this.lines.map(lineOf)}</div>
        ${this.activateKey ? html`<div class="tap" ${tapped(this.#activate)}></div>` : nothing}
        <div class="trailing"><slot name="trailing"></slot></div>`;
    }
    const m = this.model;
    if (!m) return nothing;
    this.classList.toggle("closed", !m.open);
    this.classList.toggle("active", m.active);
    return html`
      <span class=${m.open ? "badge" : "badge closed"}>${m.leading}</span>
      <span class="title-words">
        <span class="title">${m.title}</span>
        <span class=${m.open ? "detail" : "detail alert"}>${m.detail}</span>
      </span>
    `;
  }
}
