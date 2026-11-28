import { html, nothing, type PropertyDeclarations, type PropertyValues } from "lit";
import { ThemeStyles } from "@mc/ui";
import { ModStorePress } from "../shared/ModStorePress.js";
import { CardWatches } from "../shared/card-watches.js";
import type { ModStoreEventDetail } from "../shared/mod-store-events.types.js";
import { McPackCardStyles } from "./mc-pack-card.styles.js";
import type { GalleryTileModel, McPackCardProps } from "./mc-pack-card.types.js";

/**
 * # Pack card
 * One card of a pack's gallery: its picture (loaded lazily as the tile scrolls into view; a card with no picture says
 * its name where the picture would be) over a name and type line, with "×2" in the corner past one copy. A tap, or the
 * focus route's Enter and Inspect, reads it in Inspect; the mouse over the picture raises the card hover popover and a
 * hold or a right-click raises Inspect (`watchCard`).
 *
 * @element mc-pack-card
 * @fires mc-mod-store - `{ type: "card", key }`.
 * @fires mc-card-hover - From the picture, for the hover popover.
 */
export class McPackCard extends ModStorePress implements McPackCardProps {
  static override styles = [ThemeStyles, McPackCardStyles];

  static override properties: PropertyDeclarations = {
    ...ModStorePress.properties,
    card: { attribute: false },
  };

  declare card: GalleryTileModel | null;
  readonly #watches = new CardWatches();

  constructor() {
    super();
    this.card = null;
  }

  protected override pressed(): ModStoreEventDetail | null {
    return this.card ? { type: "card", key: this.card.key } : null;
  }

  protected override willUpdate(changed: PropertyValues): void {
    if (changed.has("card") && this.card) {
      this.stop = this.card.key;
      this.setAttribute("data-key", this.stop);
    }
  }

  protected override firstUpdated(): void {
    const picture = this.renderRoot.querySelector<HTMLElement>(".picture");
    if (picture) this.#watches.watch([picture], () => this.card?.hover ?? null);
  }

  override disconnectedCallback(): void {
    this.#watches.clear();
    super.disconnectedCallback();
  }

  override connectedCallback(): void {
    super.connectedCallback();
    // A card re-attached after a move (a section redrawn) is watched again.
    const picture = this.renderRoot?.querySelector<HTMLElement>(".picture");
    if (picture && this.hasUpdated) this.#watches.watch([picture], () => this.card?.hover ?? null);
  }

  override render() {
    const card = this.card;
    if (!card) return nothing;
    return html`<div class="picture">
        <mc-picture-tile
          .picture=${{ src: card.src, missing: card.missing, ...(card.retry ? { retry: card.retry } : {}) }}
          .frame=${0}
        ></mc-picture-tile>
        ${card.quantity > 1 ? html`<span class="quantity">×${card.quantity}</span>` : nothing}
      </div>
      <div class="name">${card.name}</div>
      <div class="type">${card.typeLine}</div>`;
  }
}
