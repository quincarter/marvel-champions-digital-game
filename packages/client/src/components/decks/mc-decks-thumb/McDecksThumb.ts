import { html, LitElement, type PropertyDeclarations } from "lit";
import { watchCard, type PictureSource } from "@mc/ui";
import { McDecksThumbStyles } from "./mc-decks-thumb.styles.js";

/**
 * # Decks thumbnail
 * A card scan fitted whole in a frame (the games lists and the pane's card view): a mouse over it opens the card hover
 * popover and a hold inspects it (`watchCard`), which the scene wires once for the page (`CardEvents`).
 *
 * @element mc-decks-thumb
 * @prop picture - The scan (`PictureSource`).
 * @prop cardId - The card it shows; with none, no hover.
 * @prop missing - What the box says while there is no scan, already translated.
 * @fires mc-card-hover - See `watchCard`.
 * @fires mc-card-hover-end - See `watchCard`.
 * @fires mc-card-inspect - See `watchCard`.
 */
export class McDecksThumb extends LitElement {
  static override styles = [McDecksThumbStyles];

  static override properties: PropertyDeclarations = {
    picture: { attribute: false },
    cardId: { type: String, attribute: "card-id" },
    missing: { type: String },
  };

  declare picture: PictureSource | null;
  declare cardId: string;
  declare missing: string;
  #unwatch: (() => void) | null = null;

  constructor() {
    super();
    this.picture = null;
    this.cardId = "";
    this.missing = "";
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.#unwatch = watchCard(this, () => (this.cardId ? { cardId: this.cardId, face: { kind: "front" } } : null));
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#unwatch?.();
    this.#unwatch = null;
  }

  override render() {
    const picture = this.picture ? { ...this.picture, missing: this.picture.missing ?? this.missing } : null;
    return html`<mc-picture-tile
      .picture=${picture}
      .fit=${"contain"}
      .frame=${0}
      .ground=${"parchment"}
    ></mc-picture-tile>`;
  }
}
