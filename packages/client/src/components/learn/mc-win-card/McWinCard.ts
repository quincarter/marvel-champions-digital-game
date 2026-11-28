import { watchCard, type PictureSource } from "@mc/ui";
import { html, LitElement, nothing, type PropertyDeclarations } from "lit";
import { McWinCardStyles } from "./mc-win-card.styles.js";
import type { WinCardLayout, WinCardProps, WinCardTone } from "./mc-win-card.types.js";

/**
 * # Win card
 * One way to win or lose, as a framed card: a WIN or LOSE stamp, a title, the card scan it is about and its words (the
 * default slot). The scan is a card picture: a mouse over it raises the card hover popover (`watchCard`) and a hold
 * raises Inspect. Beside the words (`row`) or over them (`column`, the wide screen's tall WIN card); a scan that is a
 * landscape card (a main scheme) keeps its own shape.
 *
 * @element mc-win-card
 * @attr tag - The stamp's word (WIN, LOSE), already translated.
 * @attr tone - heal | red: the stamp's fill.
 * @attr heading - The card's title, already translated.
 * @prop picture - The scan (`PictureSource`), or none.
 * @attr card-id - The card the scan is of, for hover and Inspect.
 * @prop face - Which face of it (`CardRef.face`), when not the default.
 * @attr art - portrait (a hero or villain scan) | landscape (a main scheme).
 * @attr layout - row | column.
 * @attr fill - The scan takes the card's whole height (the wide screen's LOSE cards).
 * @attr scan-key - Names the scan in the page (`data-key`), for tests.
 * @slot - The card's words.
 * @fires mc-card-hover - From the scan (`@mc/ui` `watchCard`).
 * @fires mc-card-hover-end - From the scan.
 * @fires mc-card-inspect - A hold on the scan.
 * @fires mc-image-error - The scan's URL failed to load.
 */
export class McWinCard extends LitElement implements WinCardProps {
  static override styles = [McWinCardStyles];

  static override properties: PropertyDeclarations = {
    tag: { type: String },
    tone: { type: String },
    heading: { type: String },
    picture: { attribute: false },
    cardId: { type: String, attribute: "card-id" },
    face: { attribute: false },
    art: { type: String, reflect: true },
    layout: { type: String, reflect: true },
    fill: { type: Boolean, reflect: true },
    scanKey: { type: String, attribute: "scan-key" },
  };

  declare tag: string;
  declare tone: WinCardTone;
  declare heading: string;
  declare picture: PictureSource | null;
  declare cardId: string;
  declare face: unknown;
  declare art: "portrait" | "landscape";
  declare layout: WinCardLayout;
  declare fill: boolean;
  declare scanKey: string;
  #unwatch: (() => void) | null = null;

  constructor() {
    super();
    this.tag = "";
    this.tone = "red";
    this.heading = "";
    this.picture = null;
    this.cardId = "";
    this.face = undefined;
    this.art = "portrait";
    this.layout = "row";
    this.fill = false;
    this.scanKey = "";
  }

  override disconnectedCallback(): void {
    this.#unwatch?.();
    this.#unwatch = null;
    super.disconnectedCallback();
  }

  protected override updated(): void {
    const scan = this.renderRoot.querySelector<HTMLElement>(".art");
    if (!scan || this.#unwatch) return;
    this.#unwatch = watchCard(scan, () =>
      this.cardId ? { cardId: this.cardId, ...(this.face !== undefined ? { face: this.face } : {}) } : null,
    );
  }

  override render() {
    return html`<div class="card">
      <div class="art" data-key=${this.scanKey || nothing}>
        ${this.picture ? html`<mc-picture-tile .picture=${this.picture} .frame=${0} ground="parchment"></mc-picture-tile>` : nothing}
      </div>
      <div class="copy">
        <mc-stamp tone=${this.tone} label=${this.tag}></mc-stamp>
        <h3 class="heading">${this.heading}</h3>
        <div class="body"><slot></slot></div>
      </div>
    </div>`;
  }
}
