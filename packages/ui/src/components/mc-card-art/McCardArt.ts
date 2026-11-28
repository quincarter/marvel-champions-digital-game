import { html, LitElement, type PropertyDeclarations } from "lit";
import { watchCard } from "../../shared/card-events.js";
import type { PictureSource } from "../../shared/picture.types.js";
import { ThemeStyles } from "../../shared/theme.styles.js";
import "../mc-picture-tile/mc-picture-tile.js";
import { McCardArtStyles } from "./mc-card-art.styles.js";

/**
 * # Card art
 * A card's picture (a scan fitted whole, or a hero's face cropped) that says "a card is here": a mouse over it raises the
 * card hover events and a hold or right-click raises Inspect (`watchCard`), which the client wires to the popover and to
 * the Inspect screen. It takes no press of its own: the part that holds it does (`onTap`, or a `McPress`).
 *
 * @element mc-card-art
 * @prop picture - The picture (`PictureSource`); null draws the plain ground.
 * @attr card-id - The card this stands for; empty: no hover and no Inspect.
 * @prop face - Which face of the card to show when it is not the default one.
 * @attr frame - The ink frame's width in px (2; 0 for none).
 * @attr ground - spent | ink | parchment (parchment).
 * @fires mc-card-hover - The mouse moved onto the picture (`watchCard`).
 * @fires mc-card-hover-end - The mouse left it.
 * @fires mc-card-inspect - A hold or a right-click.
 * @fires mc-image-error - A picture that carries a retry key failed to load (from the tile).
 */
export class McCardArt extends LitElement {
  static override styles = [ThemeStyles, McCardArtStyles];

  static override properties: PropertyDeclarations = {
    picture: { attribute: false },
    cardId: { type: String, attribute: "card-id" },
    face: { attribute: false },
    frame: { type: Number },
    ground: { type: String },
  };

  declare picture: PictureSource | null;
  declare cardId: string;
  declare face: unknown;
  declare frame: number;
  declare ground: "spent" | "ink" | "parchment";
  #unwatch: (() => void) | null = null;

  constructor() {
    super();
    this.picture = null;
    this.cardId = "";
    this.face = undefined;
    this.frame = 2;
    this.ground = "parchment";
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.#unwatch = watchCard(this, () =>
      this.cardId ? { cardId: this.cardId, ...(this.face !== undefined ? { face: this.face } : {}) } : null,
    );
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#unwatch?.();
    this.#unwatch = null;
  }

  override render() {
    return html`<mc-picture-tile
      .picture=${this.picture}
      .frame=${this.frame}
      .ground=${this.ground}
    ></mc-picture-tile>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-card-art": McCardArt;
  }
}
