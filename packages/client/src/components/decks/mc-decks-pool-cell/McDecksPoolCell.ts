import { html, nothing, type PropertyDeclarations } from "lit";
import { McPress, watchCard } from "@mc/ui";
import type { DecksPoolCard } from "../decks.types.js";
import { McDecksPoolCellStyles } from "./mc-decks-pool-cell.styles.js";

/**
 * # Pool cell
 * One card of the card pool: its scan (fitted whole, never cropped), a cost pip, the name, the type line with how many the
 * deck holds, and a "x2" mark with a heavier frame when the deck holds any. A tap raises `mc-pressed` with the card id; the
 * picture raises the card hover and Inspect events (`watchCard`), so a mouse over it opens the popover and a hold inspects.
 * The cell's size comes from its parent (`--cell-width`, `--art-height`, `--caption-height`).
 *
 * @element mc-decks-pool-cell
 * @prop card - The card (`DecksPoolCard`).
 * @attr shown - It is the card the stats pane shows: the heavier frame even with no copies.
 * @fires mc-pressed - `{ action: <card id>, hold: false }` (`PressDetail`).
 */
export class McDecksPoolCell extends McPress {
  static override styles = [McDecksPoolCellStyles];

  static override properties: PropertyDeclarations = {
    ...McPress.properties,
    card: { attribute: false },
    shown: { type: Boolean, reflect: true },
  };

  declare card: DecksPoolCard | null;
  declare shown: boolean;
  #unwatch: (() => void) | null = null;

  constructor() {
    super();
    this.card = null;
    this.shown = false;
  }

  /** The picture box: where the popover is anchored. */
  get art(): HTMLElement | null {
    return this.renderRoot.querySelector<HTMLElement>(".art");
  }

  protected override willUpdate(): void {
    this.action = this.card?.cardId ?? null;
  }

  protected override updated(changed: Map<PropertyKey, unknown>): void {
    super.updated(changed);
    const art = this.art;
    if (!art || this.#unwatch) return;
    this.#unwatch = watchCard(art, () => (this.card ? { cardId: this.card.cardId, face: { kind: "front" } } : null));
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#unwatch?.();
    this.#unwatch = null;
  }

  override render() {
    const card = this.card;
    if (!card) return nothing;
    return html`<div class="frame" data-held=${card.quantity > 0 || this.shown ? "true" : "false"}>
      <div class="art">
        <mc-picture-tile
          .picture=${card.picture}
          .fit=${"contain"}
          .frame=${0}
          .ground=${"parchment"}
        ></mc-picture-tile>
        ${card.cost === null ? nothing : html`<span class="pip">${card.cost}</span>`}
      </div>
      <div class="caption">
        <span class="title">${card.title}</span>
        <span class="line">${card.caption}</span>
      </div>
      ${card.quantity > 0 ? html`<span class="held">×${card.quantity}</span>` : nothing}
    </div>`;
  }
}
